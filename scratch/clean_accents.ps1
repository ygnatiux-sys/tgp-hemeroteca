# PowerShell script to clean up any mojibake in dek fields and save strictly as UTF-8 without BOM

$directories = @(
    "src\content\ensayos",
    "src\content\arquetipos-globales",
    "src\content\georreferencias",
    "src\content\ensayos-cinematicos"
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$cleanMap = @{
    "Ã¡" = "á"
    "Ã©" = "é"
    "Ã­" = "í"
    "Ã³" = "ó"
    "Ãº" = "ú"
    "Ã±" = "ñ"
    "Ã" = "Á"
    "Ã‰" = "É"
    "Ã" = "Í"
    "Ã“" = "Ó"
    "Ãš" = "Ú"
    "Ã‘" = "Ñ"
    "Â"  = ""
    ""  = ""
}

foreach ($dir in $directories) {
    if (Test-Path $dir) {
        $files = Get-ChildItem -Path $dir -Filter "index.json" -Recurse
        foreach ($file in $files) {
            $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
            $changed = $false
            foreach ($k in $cleanMap.Keys) {
                if ($text.Contains($k)) {
                    $text = $text.Replace($k, $cleanMap[$k])
                    $changed = $true
                }
            }
            if ($changed) {
                [System.IO.File]::WriteAllText($file.FullName, $text, $utf8NoBom)
                Write-Host "Sanitized accents in: $($file.Name)"
            }
        }
    }
}

Write-Host "Sanitization complete!"
