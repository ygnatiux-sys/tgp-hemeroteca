$results = Get-Content "c:\Users\ygnat\tgp-hemeroteca\scratch\audit_results.json" -Raw | ConvertFrom-Json

Write-Host "=== CANDIDATOS PARA ELIMINAR (SIN IMAGEN Y SIN TEXTO / SOLO TITULO O VACIO) ==="
$empty = $results | Where-Object { $_.Status -eq 'CANDIDATO_ELIMINAR_VACIO' }
$empty | Select-Object Collection, Slug, Title, Draft | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "`n=== ARTICULOS CON FOTOS INTERNAS O WIKIMEDIA PERO SIN COVERIMAGE ASIGNADO ==="
$hasInternal = $results | Where-Object { $_.Status -eq 'TIENE_FOTOS_INTERNAS_SIN_COVER' }
$hasInternal | Select-Object Collection, Slug, Title, WmCount, DiskAssets, GalleryCount, BodyLength | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "`n=== ARTICULOS CON TEXTO PERO SIN FOTOS EN NINGUN LADO ==="
$textOnly = $results | Where-Object { $_.Status -eq 'TIENE_TEXTO_SIN_FOTOS' }
$textOnly | Select-Object Collection, Slug, Title, BodyLength | Format-Table -AutoSize | Out-String | Write-Host
