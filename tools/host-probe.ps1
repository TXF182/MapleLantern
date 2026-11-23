# host-probe.ps1 — 灯台宿主页装配探针（一条命令跑完，避免服务根错位）
#
# 为什么要有这个脚本：tests/custom-host.html 里脚本写的是 ../src/*.js。
# 若从 tests\ 目录起 HTTP 服务，URL 会解析成 /src/*.js（404），五个脚本全不加载，
# 探针结果全 false —— 看起来像代码回归，实际是服务根错了（ERR-20261118-009）。
#
# 用法：
#   pwsh -NoProfile -File tools\host-probe.ps1
#   pwsh -NoProfile -File tools\host-probe.ps1 -Port 8810
#
# 判据：core/custom/theme/panel 四个全局都装配成功；Core.VERSION 与 src\boot.json 一致；
#       自定义设置里 card 六键 + bg 键存在。任一不成立 exit 1。

param(
  [int]$Port = 8801,
  [string]$Moli = "C:\Users\27352\AppData\Local\moli\moli-v1.1.22-x86_64-pc-windows-msvc\moli.exe",
  [int]$WaitSec = 3
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot          # 工程根（MapleLantern）
$probe = Join-Path $PSScriptRoot "host-probe.js"
$pageUrl = "http://127.0.0.1:$Port/tests/custom-host.html"
$bootPath = Join-Path $root "src\boot.json"
$log = Join-Path $env:TEMP "ml_host_probe_$Port.txt"
$err = Join-Path $env:TEMP "ml_host_probe_${Port}_err.txt"

if (-not (Test-Path -LiteralPath $Moli)) { throw "找不到 moli: $Moli" }
if (-not (Test-Path -LiteralPath $probe)) { throw "找不到探针: $probe" }
$boot = Get-Content -LiteralPath $bootPath -Raw -Encoding utf8 | ConvertFrom-Json

# 服务根必须是工程根（不是 tests\），这是本脚本存在的主要理由
$srv = Start-Process -FilePath "python" -ArgumentList "-m","http.server","$Port","--bind","127.0.0.1" `
  -WorkingDirectory $root -WindowStyle Hidden -PassThru
Start-Sleep -Seconds $WaitSec

$fail = @()
$raw = $null
try {
  $resp = Invoke-WebRequest -Uri $pageUrl -UseBasicParsing -TimeoutSec 10
  if ($resp.StatusCode -ne 200) { $fail += "宿主页 HTTP $($resp.StatusCode)" }
  $src = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/src/dossier-core.js" -UseBasicParsing -TimeoutSec 10
  if ($src.StatusCode -ne 200) { $fail += "/src/dossier-core.js HTTP $($src.StatusCode)" }

  $raw = & $Moli fetch --profile-dir "$env:TEMP\moli_host_probe_$Port" `
    --eval-file $probe --wait load --timeout 60000 $pageUrl 2>&1 | Out-String
  if ($raw) { Set-Content -LiteralPath $log -Value $raw -Encoding utf8 }
  $json = ($raw | Select-String -Pattern '\{"ready".*\}' -AllMatches).Matches
  if (-not $json -or $json.Count -eq 0) {
    $fail += "moli 未返回探针 JSON（原始输出见 $log）"
  } else {
    $r = $json[-1].Value | ConvertFrom-Json
    if ($r.ready -ne "complete") { $fail += "ready=$($r.ready)" }
    foreach ($k in @("core", "custom", "theme", "panel", "deco", "decoPanel")) {
      if (-not $r.$k) { $fail += "全局未装配: $k" }
    }
    if (-not $r.decoCatalog) { $fail += "布景图库不是 83 项" }
    if ($r.version -ne $boot.version) { $fail += "VERSION=$($r.version) ≠ boot=$($boot.version)" }
    if (-not $r.cardKeys) { $fail += "CUSTOM_DEFAULTS 缺 card 六键" }
    if (-not $r.bgKeys) { $fail += "CUSTOM_DEFAULTS 缺 bg 键" }
    "probe: version=$($r.version) cardKeys=$($r.cardKeys) bgKeys=$($r.bgKeys) scripts=$($r.scripts)"
  }
} catch {
  $fail += $_.Exception.Message
  if ($raw) { Set-Content -LiteralPath $log -Value $raw -Encoding utf8 }
} finally {
  if ($srv -and -not $srv.HasExited) { Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue }
  if ($fail.Count -eq 0) {
    Set-Content -LiteralPath $log -Value "" -Encoding utf8
  } elseif (-not $raw) {
    Set-Content -LiteralPath $log -Value "moli 未产生输出；请检查 moli 路径与端口" -Encoding utf8
  }
}

if ($fail.Count -gt 0) {
  "FAIL:"
  $fail | ForEach-Object { "  - $_" }
  exit 1
}
"PASS: 宿主页装配完整（服务根=$root）"
exit 0
