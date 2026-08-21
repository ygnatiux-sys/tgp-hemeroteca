$collections = @('ensayos','arquetipos-globales','georreferencias','ensayos-cinematicos')
$baseDir = 'c:\Users\ygnat\tgp-hemeroteca\src\content'

$allPosts = @()
foreach ($col in $collections) {
  $colDir = Join-Path $baseDir $col
  if (-not (Test-Path $colDir)) { continue }
  $dirs = Get-ChildItem -Path $colDir -Directory
  foreach ($d in $dirs) {
    $slug = $d.Name
    $jsonPath = Join-Path $d.FullName 'index.json'
    $mdocPath = Join-Path $d.FullName 'content.mdoc'
    $jsonObj = $null
    if (Test-Path $jsonPath) {
      try { $jsonObj = Get-Content -Path $jsonPath -Raw | ConvertFrom-Json } catch {}
    }
    $mdocText = ''
    if (Test-Path $mdocPath) { $mdocText = (Get-Content -Path $mdocPath -Raw).Trim() }
    $title = $jsonObj?.title ?? ''
    $category = $jsonObj?.category ?? ''
    # combine body
    $bodyParts = @()
    if ($mdocText) { $bodyParts += $mdocText }
    if ($jsonObj?.generadorTexto) { $bodyParts += $jsonObj.generadorTexto.Trim() }
    if ($jsonObj?.generadorGeoref) { $bodyParts += $jsonObj.generadorGeoref.Trim() }
    $fullBody = ($bodyParts -join "`n").Trim()
    $bodyHash = ''
    if ($fullBody.Length -gt 50) {
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
      BodyHash = $bodyHash
      JsonPath = $jsonPath
    }
  }
}

# Duplicates
$duplicates = $allPosts | Where-Object { $_.BodyHash -ne '' } | Group-Object BodyHash | Where-Object { $_.Count -gt 1 }
Write-Host "=== DUPLICATES AFTER CLEANUP ==="
if ($duplicates.Count -eq 0) { Write-Host 'No duplicate body content found.' }
else { foreach ($g in $duplicates) { Write-Host "Hash: $($g.Name)"; $g.Group | Format-Table Collection, Slug, Title -AutoSize } }

# Test posts category check
Write-Host "\n=== TEST POSTS CATEGORY CHECK ==="
$testPosts = $allPosts | Where-Object { $_.Title -like '*Test*' -or $_.Title -like '*Prueba*' -or $_.Slug -like '*test*' -or $_.Slug -like '*prueba*' }
foreach ($p in $testPosts) {
  Write-Host "[$($p.Collection)/$($p.Slug)] Title: $($p.Title) Category: $($p.Category)"
}
