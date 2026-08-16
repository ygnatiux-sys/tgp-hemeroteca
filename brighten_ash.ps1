$files = Get-ChildItem -Path "c:\Users\ygnat\tgp-hemeroteca\src" -Recurse -Include *.astro,*.tsx,*.ts,*.css
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $original = $content
    
    $content = $content -replace '(?i)#E3DDD3', '#EFEBE3'
    $content = $content -replace '227\s*,\s*221\s*,\s*211', '239, 235, 227'
    
    if ($content -cne $original) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        Write-Host "Updated $($file.FullName)"
    }
}
