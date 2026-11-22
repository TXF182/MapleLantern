# snap.ps1 — 改码前基线快照
# 用法：pwsh -NoProfile -File tools\snap.ps1 [-Tag before]
# 输出：.selfcheck\<yyyyMMdd-HHmmss>-<version>-snapshot.txt
# 内容：git HEAD/状态、版本三源、源码树指纹、逐文件 SHA256；.selfcheck 在 .gitignore 内，不进提交。

param(
  [string]$Tag = "snapshot",
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
. (Join-Path $PSScriptRoot "verify-lib.ps1")
$selfcheck = Join-Path $rootPath ".selfcheck"
if (-not (Test-Path -LiteralPath $selfcheck -PathType Container)) { New-Item -ItemType Directory -Path $selfcheck | Out-Null }

$boot = Get-Content -LiteralPath (Join-Path $rootPath "src\boot.json") -Raw -Encoding utf8 | ConvertFrom-Json
$version = [string]$boot.version
$hash = Get-MapleLanternSourceHash -Root $rootPath
$git = "C:\Users\27352\Git\cmd\git.exe"
$head = (& $git -C $rootPath rev-parse HEAD 2>$null | Out-String).Trim()
$status = (& $git -C $rootPath status --short 2>$null | Out-String).TrimEnd()
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeTag = ($Tag -replace '[^\w\-]+', '_')
$out = Join-Path $selfcheck ("{0}-{1}-{2}.txt" -f $stamp, $version, $safeTag)

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("snapshot: $($out.Substring($rootPath.Length + 1).Replace('\', '/'))")
$lines.Add("createdAt: $((Get-Date).ToString('o'))")
$lines.Add("version: $version")
$lines.Add("gitHead: $head")
$lines.Add("gitStatus:")
foreach ($line in ($status -split "`n")) { if ($line) { $lines.Add("  $line") } }
$lines.Add(("sourceHash: {0} ({1} files)" -f $hash.hash, $hash.files))
$lines.Add("files:")
foreach ($file in Get-MapleLanternSourceFiles -Root $rootPath) {
  $rel = $file.Substring($rootPath.Length + 1).Replace('\', '/')
  $sha = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  $lines.Add("  $sha  $rel")
}
[IO.File]::WriteAllText($out, ($lines -join "`n") + "`n", (New-Object Text.UTF8Encoding $false))

Write-Output ("基线快照: {0}" -f $out)
Write-Output ("版本 {0} / git {1} / 源码 {2}" -f $version, $head.Substring(0, [Math]::Min(8, $head.Length)), $hash.hash.Substring(0, 16))
exit 0
