$paths = @(
  "src/content/ensayos/cueva-de-las-manos-patagonia-argentina",
  "src/content/ensayos/los-esenios",
  "src/content/ensayos/el-naufragio-de-medusa",
  "src/content/ensayos/san-agustin-y-su-pasado-1",
  "src/content/ensayos/san-agustin-y-su-pasado-2",
  "src/content/georreferencias/huayna-picchu",
  "src/content/georreferencias/yakusugi-rock"
)
foreach ($p in $paths) {
  $fullPath = Join-Path "c:\Users\ygnat\tgp-hemeroteca" $p
  if (Test-Path $fullPath) {
    Remove-Item -Path $fullPath -Recurse -Force
    Write-Host "Deleted: $p"
  } else {
    Write-Host "Not found: $p"
  }
}
