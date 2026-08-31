# PowerShell script to remove UTF-8 BOM from all JSON files in src/content

$directories = @(
    "src\content\ensayos",
    "src\content\arquetipos-globales",
    "src\content\georreferencias",
    "src\content\ensayos-cinematicos"
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$fixed = 0

foreach ($dir in $directories) {
    if (Test-Path $dir) {
        $files = Get-ChildItem -Path $dir -Filter "index.json" -Recurse
        foreach ($file in $files) {
            $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
            
            # Check if bytes start with UTF-8 BOM (0xEF, 0xBB, 0xBF)
            $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
            
            # Also clean up any double-encoded accents in the text
            $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
            
            # Test JSON.parse validity
            try {
                $null = ConvertFrom-Json $text
                # Write back strictly WITHOUT BOM
                [System.IO.File]::WriteAllText($file.FullName, $text, $utf8NoBom)
                if ($hasBom) {
                    $fixed++
                    Write-Host "Removed BOM from: $($file.FullName)"
                }
            } catch {
                Write-Warning "Invalid JSON in: $($file.FullName) - $_"
            }
        }
    }
}

Write-Host "Total files fixed without BOM: $fixed"
