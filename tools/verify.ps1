# verify.ps1 — 灯台单入口验证（打包前置）
# 用法：pwsh -NoProfile -File tools\verify.ps1
# 判据：[1/4] 全量测试 [2/4] 宿主装配 [3/4] 验证期间源码不漂移 [4/4] 写指纹
# 任一失败 exit 1；不通过就不允许 pack.ps1 出包。

param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
. (Join-Path $PSScriptRoot "verify-lib.ps1")
$dist = Join-Path $rootPath "dist"
if (-not (Test-Path -LiteralPath $dist -PathType Container)) { New-Item -ItemType Directory -Path $dist | Out-Null }

$boot = Get-Content -LiteralPath (Join-Path $rootPath "src\boot.json") -Raw -Encoding utf8 | ConvertFrom-Json
$before = Get-MapleLanternSourceHash -Root $rootPath

# [1/4] 全量测试：只按实际输出判 PASS，任何 fail / cancelled / skipped 都不算全绿
Write-Output "[1/4] 全量测试"
$testFiles = @(Get-ChildItem -LiteralPath (Join-Path $rootPath "tests") -Filter "*.test.js" -File | Sort-Object Name | ForEach-Object FullName)
if ($testFiles.Count -eq 0) { throw "找不到 tests\*.test.js" }
$testRaw = & node --test @testFiles 2>&1 | Out-String
$testLog = Join-Path $env:TEMP "ml_verify_tests.log"
Set-Content -LiteralPath $testLog -Value $testRaw -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "全量测试失败（exit=$LASTEXITCODE，日志：$testLog）" }
$testSummary = [regex]::Match($testRaw, '(?m)^# tests (\d+)\r?\n(?:# suites \d+\r?\n)?# pass (\d+)\r?\n# fail (\d+)\r?\n# cancelled (\d+)\r?\n# skipped (\d+)')
if (-not $testSummary.Success) { throw "无法解析测试汇总（日志：$testLog）" }
$tests = [int]$testSummary.Groups[1].Value
$passed = [int]$testSummary.Groups[2].Value
$failed = [int]$testSummary.Groups[3].Value
$cancelled = [int]$testSummary.Groups[4].Value
$skipped = [int]$testSummary.Groups[5].Value
if ($failed -ne 0 -or $cancelled -ne 0 -or $skipped -ne 0) {
  throw "测试未全绿：pass=$passed fail=$failed cancelled=$cancelled skipped=$skipped（日志：$testLog）"
}
Write-Output ("  PASS {0}/{1}（fail 0 / cancelled 0 / skipped 0）" -f $passed, $tests)

# [2/4] 宿主装配：服务根、四个全局、版本双源、card/bg 键
Write-Output "[2/4] 宿主装配探针"
$hostRaw = & pwsh -NoProfile -File (Join-Path $rootPath "tools\host-probe.ps1") 2>&1 | Out-String
$hostLog = Join-Path $env:TEMP "ml_verify_host.log"
Set-Content -LiteralPath $hostLog -Value $hostRaw -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "宿主装配探针失败（exit=$LASTEXITCODE，日志：$hostLog）" }
if ($hostRaw -notmatch "PASS:") { throw "宿主探针未返回 PASS（日志：$hostLog）" }
Write-Output "  PASS"

# [3/4] 验证期间源码不得变化；否则指纹会指向验证前的旧内容
Write-Output "[3/4] 验证期间源码防漂移"
$after = Get-MapleLanternSourceHash -Root $rootPath
if ($before.hash -ne $after.hash) {
  throw "验证期间源码发生变化，拒绝生成验证指纹（before=$($before.hash) after=$($after.hash)）"
}
Write-Output ("  PASS {0} 文件 / {1}" -f $before.files, $before.hash.Substring(0, 16))

# [4/4] 指纹：只记录验证结论，不把“未验证”写成已验证
$stamp = [ordered]@{
  schema = 1
  version = [string]$boot.version
  gitHead = (& "C:\Users\27352\Git\cmd\git.exe" -C $rootPath rev-parse HEAD 2>$null | Out-String).Trim()
  gitStatus = (& "C:\Users\27352\Git\cmd\git.exe" -C $rootPath status --short 2>$null | Out-String).Trim()
  sourceHash = $before.hash
  sourceFiles = $before.files
  tests = [ordered]@{ total = $tests; pass = $passed; fail = $failed; cancelled = $cancelled; skipped = $skipped }
  hostProbe = "PASS"
  createdAt = (Get-Date).ToString("o")
}
$stampIdSource = "{0}|{1}|{2}|{3}" -f $stamp.sourceHash, $stamp.version, $stamp.tests.pass, $stamp.hostProbe
$bytes = [Text.Encoding]::UTF8.GetBytes($stampIdSource)
$sha = [Security.Cryptography.SHA256]::Create()
try { $digest = $sha.ComputeHash($bytes) } finally { $sha.Dispose() }
$stamp.stampId = ([BitConverter]::ToString($digest)).Replace('-', '').ToLowerInvariant()
$stamp | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $dist "verify.json") -Encoding utf8
Write-Output ("[4/4] PASS 指纹 {0}" -f $stamp.stampId)
exit 0
