# 灯台 MapleLantern — 确定性打包
# 用法：pwsh -File pack.ps1
# 产物：dist\MapleLantern-<version>.mod.zip + dist\SHA256.txt
# 纪律：zip 根目录必须有 boot.json；条目时间戳固定；条目名正斜杠；同一输入两次打包哈希一致。

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$src = Join-Path $root "src"
$dist = Join-Path $root "dist"
if (-not (Test-Path -LiteralPath $src -PathType Container)) { throw "缺少 src 目录: $src" }
if (-not (Test-Path -LiteralPath $dist -PathType Container)) { New-Item -ItemType Directory -Path $dist | Out-Null }

$bootPath = Join-Path $src "boot.json"
$boot = Get-Content -LiteralPath $bootPath -Raw -Encoding utf8 | ConvertFrom-Json
$version = [string]$boot.version
$out = Join-Path $dist ("MapleLantern-{0}.mod.zip" -f $version)

# —— 包内清单：boot.json 必须在根目录，其余按路径排序保证确定性 ——
$files = Get-ChildItem -LiteralPath $src -File -Recurse | Sort-Object { $_.FullName.Substring($src.Length + 1) }
$names = @($files | ForEach-Object { $_.FullName.Substring($src.Length + 1).Replace("\", "/") })
if ($names -notcontains "boot.json") { throw "boot.json 必须位于 zip 根目录" }
foreach ($list in @("scriptFileList", "styleFileList", "tweeFileList", "imgFileList")) {
  if (-not ($boot.PSObject.Properties.Name -contains $list)) { throw "boot.json 缺少必填列表: $list" }
  foreach ($rel in @($boot.$list)) {
    if ($names -notcontains ([string]$rel)) { throw "boot.json 的 $list 引用了不存在的文件: $rel" }
  }
}

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

# —— 回读校验 ——
$read = [IO.Compression.ZipFile]::OpenRead($out)
try {
  $entries = @($read.Entries | ForEach-Object { $_.FullName })
  if ($entries -notcontains "boot.json") { throw "回读失败：根目录没有 boot.json" }
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
  "built: deterministic (mtime 1980-01-01, forward slashes)"
)
$shaFile = Join-Path $dist "SHA256.txt"
[IO.File]::WriteAllText($shaFile, ($lines -join "`n") + "`n", (New-Object Text.UTF8Encoding $false))

Write-Output ("打包完成: {0}" -f $out)
Write-Output ("SHA256: {0}" -f $sha)
Write-Output ("条目: {0} / 体积: {1} B" -f $entries.Count, $size)
$entries | ForEach-Object { Write-Output ("  - " + $_) }
