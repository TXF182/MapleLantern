# 灯台布景图库 — 确定性打包（与 MapleLantern 本体分离）
# 用法：pwsh -File pack-image.ps1 [-Force]
# 产物：dist\MapleLantern-ImagePack-<version>.mod.zip + SHA256-decor.txt
param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$src = Join-Path $root "imagepack"
$dist = Join-Path $root "dist"

if (-not (Test-Path -LiteralPath $src -PathType Container)) { throw "缺少 imagepack 目录: $src" }
if (-not (Test-Path -LiteralPath $dist -PathType Container)) { New-Item -ItemType Directory -Path $dist | Out-Null }

$bootPath = Join-Path $src "boot.json"
$boot = Get-Content -LiteralPath $bootPath -Raw -Encoding utf8 | ConvertFrom-Json
$version = [string]$boot.version
$out = Join-Path $dist ("MapleLantern-ImagePack-{0}.mod.zip" -f $version)
if (Test-Path -LiteralPath $out -PathType Leaf) {
  if (-not $Force) { throw "同名产物已存在：$out。确认要重打请加 -Force" }
}

$files = Get-ChildItem -LiteralPath $src -File -Recurse | Sort-Object { $_.FullName.Substring($src.Length + 1) }
$names = @($files | ForEach-Object { $_.FullName.Substring($src.Length + 1).Replace("\", "/") })
if ($names -cnotcontains "boot.json") { throw "boot.json 必须位于 zip 根目录" }
if (-not ($boot.PSObject.Properties.Name -contains "imgFileList")) { throw "boot.json 缺少 imgFileList" }
foreach ($rel in @($boot.imgFileList)) {
  if ($names -cnotcontains ([string]$rel)) { throw "boot.json 引用了不存在的图: $rel" }
}
$images = @($boot.imgFileList)
$bgImages = @($images | Where-Object { ([string]$_).StartsWith("img/decorations/ml/background1/") })
$fgImages = @($images | Where-Object { ([string]$_).StartsWith("img/decorations/ml/foreground1/") })
if ($bgImages.Count -ne 105) { throw "背景图条目数 $($bgImages.Count) != 105" }
if ($fgImages.Count -ne 105) { throw "前景图条目数 $($fgImages.Count) != 105" }
if (($bgImages.Count + $fgImages.Count) -ne $images.Count) { throw "imgFileList 含背景/前景之外的路径" }
$bgNames = @($bgImages | ForEach-Object { [IO.Path]::GetFileNameWithoutExtension([string]$_) })
$fgNames = @($fgImages | ForEach-Object { [IO.Path]::GetFileNameWithoutExtension([string]$_) })
$nameDiff = Compare-Object -CaseSensitive -ReferenceObject $bgNames -DifferenceObject $fgNames
if ($nameDiff) { throw "背景/前景文件名未一一对应" }
foreach ($rel in $images) {
  if (-not (([string]$rel).StartsWith("img/decorations/ml/background1/") -or ([string]$rel).StartsWith("img/decorations/ml/foreground1/"))) { throw "图库路径越界: $rel" }
}
if ($names.Count -ne ($images.Count + 2)) { throw "imagepack 条目数 $($names.Count) != 图 $($images.Count) + boot + README" }

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

$read = [IO.Compression.ZipFile]::OpenRead($out)
try {
  $entries = @($read.Entries | ForEach-Object { $_.FullName })
  if ($entries -cnotcontains "boot.json") { throw "回读失败：根目录没有 boot.json" }
  if ($entries.Count -ne $names.Count) { throw "回读失败：条目数量 $($entries.Count) != $($names.Count)" }
  $diff = Compare-Object -CaseSensitive -ReferenceObject $names -DifferenceObject $entries
  if ($diff) { throw "回读失败：条目集合与 imagepack 不一致" }
  foreach ($e in $entries) {
    if ($e.Contains("\")) { throw "回读失败：条目含反斜杠 $e" }
    if ($e.Contains("..")) { throw "回读失败：路径穿越 $e" }
  }
} finally { $read.Dispose() }

$sha = (Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $out).Length
$lines = @(
  "file: $(Split-Path -Leaf $out)",
  "sha256: $sha",
  "bytes: $size",
  "entries: $($entries.Count)",
  "images: $($images.Count)",
  "built: deterministic (mtime 1980-01-01, forward slashes)"
)
[IO.File]::WriteAllText((Join-Path $dist "SHA256-decor.txt"), ($lines -join "`n") + "`n", (New-Object Text.UTF8Encoding $false))

Write-Output ("打包完成: {0}" -f $out)
Write-Output ("SHA256: {0}" -f $sha)
Write-Output ("条目: {0} / 图: {1} / 体积: {2} B" -f $entries.Count, $images.Count, $size)
