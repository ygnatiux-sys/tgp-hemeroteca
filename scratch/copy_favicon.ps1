$src = "C:\Users\ygnat\.gemini\antigravity-ide\brain\f60371bf-3f2d-41e9-ba90-a4da6fb98285\.user_uploaded\media_1787309969011.png"
$dest1 = "c:\Users\ygnat\tgp-hemeroteca\public\faviconTGP.png"
$dest2 = "c:\Users\ygnat\tgp-hemeroteca\public\images\faviconTGP.png"
$dest3 = "c:\Users\ygnat\tgp-hemeroteca\public\favicon.png"

# Ensure target directories exist
$imgDir = "c:\Users\ygnat\tgp-hemeroteca\public\images"
if (-not (Test-Path $imgDir)) { New-Item -ItemType Directory -Path $imgDir -Force | Out-Null }

Copy-Item -Path $src -Destination $dest1 -Force
Copy-Item -Path $src -Destination $dest2 -Force
Copy-Item -Path $src -Destination $dest3 -Force

Write-Host "Favicon successfully placed:"
Write-Host "1: $dest1 ($((Get-Item $dest1).Length) bytes)"
Write-Host "2: $dest2 ($((Get-Item $dest2).Length) bytes)"
Write-Host "3: $dest3 ($((Get-Item $dest3).Length) bytes)"
