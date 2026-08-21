$collections = @("ensayos", "arquetipos-globales", "georreferencias", "ensayos-cinematicos")
$baseDir = "c:\Users\ygnat\tgp-hemeroteca\src\content"

$summary = @()

foreach ($col in $collections) {
    $colDir = Join-Path $baseDir $col
    if (-not (Test-Path $colDir)) { continue }
    
    $dirs = Get-ChildItem -Path $colDir -Directory
    foreach ($d in $dirs) {
        $slug = $d.Name
        $jsonPath = Join-Path $d.FullName "index.json"
        $mdocPath = Join-Path $d.FullName "content.mdoc"
        
        $jsonObj = $null
        if (Test-Path $jsonPath) {
            try {
                $raw = Get-Content -Path $jsonPath -Raw -Encoding UTF8
                $jsonObj = ConvertFrom-Json $raw -ErrorAction SilentlyContinue
            } catch {}
        }
        
        $mdocText = ""
        if (Test-Path $mdocPath) {
            try {
                $mdocText = (Get-Content -Path $mdocPath -Raw -Encoding UTF8).Trim()
            } catch {}
        }
        
        $title = if ($jsonObj -and $jsonObj.title) { $jsonObj.title } else { "" }
        $draft = if ($jsonObj -and ($jsonObj.draft -eq $true)) { $true } else { $false }
        $category = if ($jsonObj -and $jsonObj.category) { $jsonObj.category } else { "" }
        $coverImage = if ($jsonObj -and $jsonObj.coverImage) { $jsonObj.coverImage } else { $null }
        
        $wmCount = 0
        $firstWmUrl = $null
        if ($jsonObj -and $jsonObj.bancoImagenesWikimedia) {
            try {
                $wmRaw = $jsonObj.bancoImagenesWikimedia
                $wmObj = if ($wmRaw -is [string]) { ConvertFrom-Json $wmRaw -ErrorAction SilentlyContinue } else { $wmRaw }
                if ($wmObj -and $wmObj.selectedItems) {
                    $wmCount = $wmObj.selectedItems.Count
                    if ($wmCount -gt 0) {
                        $heroItem = $wmObj.selectedItems | Where-Object { $_.role -eq "HERO" } | Select-Object -First 1
                        if (-not $heroItem) { $heroItem = $wmObj.selectedItems[0] }
                        $firstWmUrl = if ($heroItem.thumbUrl) { $heroItem.thumbUrl } else { $heroItem.url }
                    }
                }
            } catch {}
        }
        
        $galleryCount = 0
        if ($jsonObj -and $jsonObj.gallery) {
            $galleryCount = $jsonObj.gallery.Count
        }
        
        $assetDir = "c:\Users\ygnat\tgp-hemeroteca\src\assets\$col\$slug"
        $diskAssets = @()
        if (Test-Path $assetDir) {
            $diskAssets = Get-ChildItem -Path $assetDir -File | Where-Object { $_.Extension -match '\.(jpg|jpeg|png|webp|avif|gif)$' } | Select-Object -ExpandProperty Name
        }
        
        $bodyLength = $mdocText.Length
        if ($jsonObj -and $jsonObj.generadorTexto) {
            $bodyLength += $jsonObj.generadorTexto.Length
        }
        if ($jsonObj -and $jsonObj.generadorGeoref) {
            $bodyLength += $jsonObj.generadorGeoref.Length
        }
        if ($jsonObj -and $jsonObj.notasInvestigador) {
            $bodyLength += $jsonObj.notasInvestigador.Length
        }
        
        $hasAnyImage = ($coverImage -ne $null) -or ($wmCount -gt 0) -or ($galleryCount -gt 0) -or ($diskAssets.Count -gt 0)
        $hasBody = ($bodyLength -gt 30)
        
        $status = "OK"
        if (-not $hasAnyImage -and -not $hasBody) {
            $status = "CANDIDATO_ELIMINAR_VACIO"
        } elseif (-not $coverImage -and ($wmCount -gt 0 -or $diskAssets.Count -gt 0 -or $galleryCount -gt 0)) {
            $status = "TIENE_FOTOS_INTERNAS_SIN_COVER"
        } elseif (-not $hasAnyImage -and $hasBody) {
            $status = "TIENE_TEXTO_SIN_FOTOS"
        }
        
        $summary += [PSCustomObject]@{
            Collection = $col
            Slug = $slug
            Title = $title
            Category = $category
            Draft = $draft
            HasCover = ($coverImage -ne $null)
            CoverPath = $coverImage
            WmCount = $wmCount
            FirstWmUrl = $firstWmUrl
            GalleryCount = $galleryCount
            DiskAssets = ($diskAssets -join ", ")
            BodyLength = $bodyLength
            Status = $status
        }
    }
}

$summary | ConvertTo-Json -Depth 5 | Set-Content -Path "scratch/audit_results_v2.json" -Encoding UTF8

Write-Host "=== CANDIDATOS PARA ELIMINAR (SIN IMAGEN Y SIN TEXTO / SOLO TITULO O VACIO) ==="
$empty = $summary | Where-Object { $_.Status -eq 'CANDIDATO_ELIMINAR_VACIO' }
$empty | Select-Object Collection, Slug, Title, Draft | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "`n=== ARTICULOS CON FOTOS INTERNAS O WIKIMEDIA PERO SIN COVERIMAGE DIRECTO (SE PUEDEN RESOLVER AUTOMATICAMENTE) ==="
$hasInternal = $summary | Where-Object { $_.Status -eq 'TIENE_FOTOS_INTERNAS_SIN_COVER' }
$hasInternal | Select-Object Collection, Slug, Title, WmCount, GalleryCount, DiskAssets | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "`n=== ARTICULOS CON TEXTO PERO SIN FOTOS EN NINGUN LADO ==="
$textOnly = $summary | Where-Object { $_.Status -eq 'TIENE_TEXTO_SIN_FOTOS' }
$textOnly | Select-Object Collection, Slug, Title, BodyLength | Format-Table -AutoSize | Out-String | Write-Host
