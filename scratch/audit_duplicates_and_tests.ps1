$collections = @("ensayos", "arquetipos-globales", "georreferencias", "ensayos-cinematicos")
$baseDir = "c:\Users\ygnat\tgp-hemeroteca\src\content"

$allPosts = @()

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
        
        # Combine bodies
        $bodyParts = @()
        if ($mdocText) { $bodyParts += $mdocText }
        if ($jsonObj -and $jsonObj.generadorTexto) { $bodyParts += $jsonObj.generadorTexto.Trim() }
        if ($jsonObj -and $jsonObj.generadorGeoref) { $bodyParts += $jsonObj.generadorGeoref.Trim() }
        
        $fullBody = ($bodyParts -join "`n").Trim()
        
        # Hash body content if not empty
        $bodyHash = ""
        if ($fullBody.Length -gt 50) {
            # Normalize whitespace/newlines before hashing to catch minor variations
            $normalized = $fullBody -replace '\s+', ' '
            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
            $hashBytes = $sha256.ComputeHash($bytes)
            $bodyHash = [System.BitConverter]::ToString($hashBytes) -replace '-'
        }
        
        $allPosts += [PSCustomObject]@{
            Collection = $col
            Slug = $slug
            Title = $title
            Category = $category
            Draft = $draft
            BodyHash = $bodyHash
            BodyLength = $fullBody.Length
            FolderPath = $d.FullName
            JsonPath = $jsonPath
        }
    }
}

# 1. Group by BodyHash to find duplicate content
$duplicates = $allPosts | Where-Object { $_.BodyHash -ne "" } | Group-Object BodyHash | Where-Object { $_.Count -gt 1 }

Write-Host "=== ARTICULOS CON EL MISMO CUERPO DE TEXTO (REPETIDOS) ==="
$dupList = @()
foreach ($g in $duplicates) {
    Write-Host "`nGrupo Duplicado: $($g.Name)"
    $g.Group | Select-Object Collection, Slug, Title, BodyLength | Format-Table -AutoSize | Out-String | Write-Host
    # Keep the first, mark others for deletion
    for ($i = 1; $i -lt $g.Group.Count; $i++) {
        $dupList += $g.Group[$i]
    }
}

Write-Host "`nTotal de duplicados para eliminar (conservando el primero de cada grupo): $($dupList.Count)"
$dupList | Select-Object Collection, Slug, Title | Format-Table -AutoSize | Out-String | Write-Host

# Save duplicate deletion candidates for next step
$dupList | ConvertTo-Json | Set-Content -Path "scratch/dup_deletion_candidates.json" -Encoding UTF8

# 2. Find posts with "Test" or "Prueba" in Title/Slug/Category
Write-Host "`n=== ARTICULOS QUE CONTIENEN 'Test' o 'Prueba' ==="
$testPosts = $allPosts | Where-Object {
    ($_.Title -like "*Test*") -or ($_.Title -like "*Prueba*") -or 
    ($_.Slug -like "*test*") -or ($_.Slug -like "*prueba*") -or 
    ($_.Category -like "*test*") -or ($_.Category -like "*prueba*")
}

$testPosts | Select-Object Collection, Slug, Title, Category | Format-Table -AutoSize | Out-String | Write-Host

# Save test posts for updating
$testPosts | ConvertTo-Json | Set-Content -Path "scratch/test_posts_to_update.json" -Encoding UTF8
