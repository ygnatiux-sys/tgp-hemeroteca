# PowerShell script to validate all index.json files parse successfully

$directories = @(
    "src\content\ensayos",
    "src\content\arquetipos-globales",
    "src\content\georreferencias",
    "src\content\ensayos-cinematicos"
)

$errors = 0
$total = 0

foreach ($dir in $directories) {
    if (Test-Path $dir) {
        $files = Get-ChildItem -Path $dir -Filter "index.json" -Recurse
        foreach ($file in $files) {
            $total++
            try {
                $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
                $null = $text | ConvertFrom-Json
            } catch {
                $errors++
                Write-Error "Invalid JSON in: $($file.FullName) - $_"
            }
        }
    }
}

Write-Host "Validation complete! Checked $total files. Errors found: $errors"
