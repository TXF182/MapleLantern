# 灯台 MapleLantern — 确定性打包
# 用法：pwsh -File pack.ps1 [-OutDir <目录>] [-Force]
# 产物：<OutDir>\MapleLantern-<version>.mod.zip + SHA256.txt
# 纪律：先过 tools\verify.ps1，再出包；同名产物已存在时默认拒绝覆盖（需 -Force）；
#       zip 根目录必须有 boot.json；条目时间戳固定；条目名正斜杠；
#       条目集合与 src 完全一致；同一输入两次打包哈希一致。

param(
  [string]$OutDir = (Join-Path $PSScriptRoot "dist"),
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$src = Join-Path $root "src"
. (Join-Path $root "tools\verify-lib.ps1")
if (-not [IO.Path]::IsPathRooted($OutDir)) { $OutDir = Join-Path $root $OutDir }
$dist = [IO.Path]::GetFullPath($OutDir)
if (-not (Test-Path -LiteralPath $src -PathType Container)) { throw "缺少 src 目录: $src" }
if (-not (Test-Path -LiteralPath $dist -PathType Container)) { New-Item -ItemType Directory -Path $dist | Out-Null }

$bootPath = Join-Path $src "boot.json"
$boot = Get-Content -LiteralPath $bootPath -Raw -Encoding utf8 | ConvertFrom-Json
$version = [string]$boot.version
$out = Join-Path $dist ("MapleLantern-{0}.mod.zip" -f $version)
if (Test-Path -LiteralPath $out -PathType Leaf) {
  if (-not $Force) {
    throw "同名产物已存在：$out。已发布版本不要覆盖；确认要重打请加 -Force（建议先升版）"
  }
}

# —— 先验证，后打包：不通过就不产生新产物 ——
Write-Output "[pack 1/4] 验证门禁"
& pwsh -NoProfile -File (Join-Path $root "tools\verify.ps1") -Root $root
if ($LASTEXITCODE -ne 0) { throw "验证门禁失败，拒绝打包（exit=$LASTEXITCODE）" }
$stampPath = Join-Path $root "dist\verify.json"
if (-not (Test-Path -LiteralPath $stampPath -PathType Leaf)) { throw "缺少验证指纹: $stampPath" }
$stamp = Get-Content -LiteralPath $stampPath -Raw -Encoding utf8 | ConvertFrom-Json
$current = Get-MapleLanternSourceHash -Root $root
if ($stamp.sourceHash -ne $current.hash) {
  throw "验证指纹与当前源码不一致，拒绝打包（stamp=$($stamp.sourceHash) now=$($current.hash)）"
}
Write-Output ("  PASS 指纹 {0} / 源码 {1} 文件" -f $stamp.stampId, $current.files)

# —— 包内清单：boot.json 必须在根目录，其余按路径排序保证确定性 ——
$files = Get-ChildItem -LiteralPath $src -File -Recurse | Sort-Object { $_.FullName.Substring($src.Length + 1) }
$names = @($files | ForEach-Object { $_.FullName.Substring($src.Length + 1).Replace("\", "/") })
if ($names -cnotcontains "boot.json") { throw "boot.json 必须位于 zip 根目录" }
Write-Output "[pack 2/4] 包内清单"
foreach ($list in @("scriptFileList", "scriptFileList_inject_early", "styleFileList", "tweeFileList", "imgFileList")) {
  if (-not ($boot.PSObject.Properties.Name -contains $list)) { throw "boot.json 缺少必填列表: $list" }
  foreach ($rel in @($boot.$list)) {
    if ($names -cnotcontains ([string]$rel)) { throw "boot.json 的 $list 引用了不存在的文件: $rel" }
  }
}
if ($names.Count -eq 0) { throw "src 目录为空" }
Write-Output ("  PASS boot 列表齐全 / {0} 条目" -f $names.Count)

Write-Output "[pack 3/4] 构建确定性 zip"

if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
$fixed = [DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)

Add-Type -AssemblyName System.IO.Compression
$fs = [IO.File]::Open($out, [IO.FileMode]::CreateNew)
try {
  $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($f in $files) {
      $rel = $f.FullName.Substring($src.Length + 1).Replace("\", "/")
      $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = $fixed
      $in = [IO.File]::OpenRead($f.FullName)
      try {
        $s = $entry.Open()
        try { $in.CopyTo($s) } finally { $s.Dispose() }
      } finally { $in.Dispose() }
    }
  } finally { $zip.Dispose() }
} finally { $fs.Dispose() }

# —— 回读校验：条目集合必须与 src 完全一致，不能多也不能少 ——
Write-Output "[pack 4/4] 回读 / 结构校验"
$read = [IO.Compression.ZipFile]::OpenRead($out)
try {
  $entries = @($read.Entries | ForEach-Object { $_.FullName })
  if ($entries -cnotcontains "boot.json") { throw "回读失败：根目录没有 boot.json" }
  foreach ($e in $entries) {
    if ($e.Contains("\")) { throw "回读失败：条目含反斜杠 $e" }
    if ($e.Contains("..")) { throw "回读失败：路径穿越 $e" }
  }
  if ($entries.Count -ne $names.Count) {
    throw "回读失败：条目数量 $($entries.Count) != src $($names.Count)"
  }
  $entryDiff = Compare-Object -CaseSensitive -ReferenceObject $names -DifferenceObject $entries
  if ($entryDiff) {
    throw ("回读失败：条目集合与 src 不一致`n" + (($entryDiff | ForEach-Object { "{0} {1}" -f $_.SideIndicator, $_.InputObject }) -join "`n"))
  }
  Write-Output ("  PASS 条目集合 {0} 条与 src 一致" -f $entries.Count)
} finally { $read.Dispose() }

# —— 独立包结构校验器（dol-ui-design skill）：CRC/路径/清单/幽灵语言/回退口径 ——
$uiCheck = Join-Path $env:USERPROFILE "Doubao\skills\dol-ui-design\scripts\check_ui_mod.py"
if (-not (Test-Path -LiteralPath $uiCheck -PathType Leaf)) { throw "缺少 UI 包结构校验器: $uiCheck" }
$checkRaw = & python $uiCheck $out 2>&1 | Out-String
Write-Output $checkRaw.TrimEnd()
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $out -Force -ErrorAction SilentlyContinue
  throw "UI 包结构校验失败，已删除不合格产物（exit=$LASTEXITCODE）"
}

$sha = (Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $out).Length
$lines = @(
  "file: $(Split-Path -Leaf $out)",
  "sha256: $sha",
  "bytes: $size",
  "entries: $($entries.Count)",
  "verify: $($stamp.stampId) (version $($stamp.version) / tests $($stamp.tests.pass) / host PASS)",
  "built: deterministic (mtime 1980-01-01, forward slashes)"
)
$shaFile = Join-Path $dist "SHA256.txt"
[IO.File]::WriteAllText($shaFile, ($lines -join "`n") + "`n", (New-Object Text.UTF8Encoding $false))

Write-Output ("打包完成: {0}" -f $out)
Write-Output ("SHA256: {0}" -f $sha)
Write-Output ("条目: {0} / 体积: {1} B" -f $entries.Count, $size)
$entries | ForEach-Object { Write-Output ("  - " + $_) }
