$files = Get-ChildItem -Path "c:\Users\ygnat\tgp-hemeroteca\src" -Recurse -Include *.astro,*.tsx,*.ts,*.css
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $original = $content
    
    $content = $content -replace '(?i)#D4A352', '#E3DDD3'
    $content = $content -replace '(?i)#C8A98B', '#E3DDD3'
    $content = $content -replace '212\s*,\s*163\s*,\s*82', '227, 221, 211'
    $content = $content -replace '200\s*,\s*169\s*,\s*139', '227, 221, 211'
    
    if ($content -cne $original) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        Write-Host "Updated $($file.FullName)"
    }
}
