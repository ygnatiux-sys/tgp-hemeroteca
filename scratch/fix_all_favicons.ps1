$src = "C:\Users\ygnat\tgp-hemeroteca\.user_uploaded\media_1787309969011.png"
if (-not (Test-Path $src)) {
    $src = "C:\Users\ygnat\.gemini\antigravity-ide\brain\f60371bf-3f2d-41e9-ba90-a4da6fb98285\.user_uploaded\media_1787309969011.png"
}

$targets = @(
    "c:\Users\ygnat\tgp-hemeroteca\public\favicon.png",
    "c:\Users\ygnat\tgp-hemeroteca\public\faviconTGP.png",
    "c:\Users\ygnat\tgp-hemeroteca\public\images\favicon.TGP.webp",
    "c:\Users\ygnat\tgp-hemeroteca\public\images\faviconTGP.png",
    "c:\Users\ygnat\tgp-hemeroteca\public\images\favicon.png",
    "c:\Users\ygnat\tgp-hemeroteca\public\images\favicon.TGP.png"
)

# Ensure folders exist
$imgDir = "c:\Users\ygnat\tgp-hemeroteca\public\images"
if (-not (Test-Path $imgDir)) { New-Item -ItemType Directory -Path $imgDir -Force | Out-Null }

foreach ($t in $targets) {
    Copy-Item -Path $src -Destination $t -Force
    Write-Host "Created: $t ($((Get-Item $t).Length) bytes)"
}
