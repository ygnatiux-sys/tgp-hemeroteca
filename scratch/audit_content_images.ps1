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
        
        $title = if ($jsonObj -and $jsonObj.title) { $jsonObj.title } else { "Sin Título" }
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
                        $firstWmUrl = if ($wmObj.selectedItems[0].thumbUrl) { $wmObj.selectedItems[0].thumbUrl } else { $wmObj.selectedItems[0].url }
                    }
                }
            } catch {}
        }
        
        $galleryCount = 0
        if ($jsonObj -and $jsonObj.gallery) {
            $galleryCount = $jsonObj.gallery.Count
        }
        
        $assetDir = "c:\Users\ygnat\tgp-hemeroteca\src\assets\$col\$slug"
        $diskAssetCount = 0
        if (Test-Path $assetDir) {
            $diskAssetCount = (Get-ChildItem -Path $assetDir -File | Where-Object { $_.Extension -match '\.(jpg|jpeg|png|webp|avif|gif)$' }).Count
        }
        
        $bodyLength = $mdocText.Length
        if ($jsonObj -and $jsonObj.generadorTexto) {
            $bodyLength += $jsonObj.generadorTexto.Length
        }
        
        $hasAnyImage = ($coverImage -ne $null) -or ($wmCount -gt 0) -or ($galleryCount -gt 0) -or ($diskAssetCount -gt 0)
        $hasBody = ($bodyLength -gt 20)
        
        $status = "OK"
        if (-not $hasAnyImage -and -not $hasBody) {
            $status = "CANDIDATO_ELIMINAR_VACIO"
        } elseif (-not $coverImage -and ($wmCount -gt 0 -or $diskAssetCount -gt 0 -or $galleryCount -gt 0)) {
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
            GalleryCount = $galleryCount
            DiskCount = $diskAssetCount
            BodyLength = $bodyLength
            Status = $status
        }
    }
}

$summary | Format-Table -AutoSize | Out-String -Width 240
