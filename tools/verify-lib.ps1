# verify-lib.ps1 — 灯台验证/打包共用的源码指纹
# 只统计会改变运行时或判据的文件；dist / .selfcheck / 浏览器 profile 不进指纹。

function Get-MapleLanternSourceFiles {
  param([Parameter(Mandatory = $true)][string]$Root)

  $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
  $files = New-Object System.Collections.Generic.List[string]

  foreach ($file in Get-ChildItem -LiteralPath (Join-Path $rootPath "src") -File -Recurse) {
    $files.Add($file.FullName)
  }
  foreach ($file in Get-ChildItem -LiteralPath (Join-Path $rootPath "tests") -File) {
    if (@(".js", ".md", ".html", ".py") -contains $file.Extension.ToLowerInvariant()) {
      $files.Add($file.FullName)
    }
  }
  foreach ($file in Get-ChildItem -LiteralPath (Join-Path $rootPath "tools") -File) {
    if (@(".ps1", ".js", ".md", ".py") -contains $file.Extension.ToLowerInvariant()) {
      $files.Add($file.FullName)
    }
  }
  $pack = Join-Path $rootPath "pack.ps1"
  if (Test-Path -LiteralPath $pack -PathType Leaf) { $files.Add($pack) }

  return @($files | Sort-Object -Unique)
}

function Get-MapleLanternSourceHash {
  param([Parameter(Mandatory = $true)][string]$Root)

  $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
  $files = Get-MapleLanternSourceFiles -Root $rootPath
  $lines = foreach ($file in $files) {
    $rel = $file.Substring($rootPath.Length + 1).Replace('\', '/')
    $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    "$rel=$hash"
  }
  $payload = [Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $digest = $sha.ComputeHash($payload) } finally { $sha.Dispose() }
  return @{
    hash = ([BitConverter]::ToString($digest)).Replace('-', '').ToLowerInvariant()
    files = $files.Count
  }
}
