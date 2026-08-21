# 1. Delete the duplicate folders
$dupsToDelete = @(
  "src/content/ensayos/aramu-muru-puerta-de-los-dioses",
  "src/content/ensayos/atila-y-el-papa-copy",
  "src/content/georreferencias/la-cueva-de-lascaux-2",
  "src/content/georreferencias/stonehenge-bis-1"
)

Write-Host "=== ELIMINANDO ARTICULOS DUPLICADOS ==="
foreach ($d in $dupsToDelete) {
  $path = Join-Path "c:\Users\ygnat\tgp-hemeroteca" $d
  if (Test-Path $path) {
    Remove-Item -Path $path -Recurse -Force
    Write-Host "Eliminado duplicado: $d"
  } else {
    Write-Host "No encontrado o ya eliminado: $d"
  }
}

# 2. Update category to "test" for test posts
$testPostsJson = Get-Content "c:\Users\ygnat\tgp-hemeroteca\scratch\test_posts_to_update.json" -Raw | ConvertFrom-Json

Write-Host "`n=== ACTUALIZANDO CATEGORIA A 'test' PARA POSTS DE PRUEBA ==="
foreach ($post in $testPostsJson) {
  $jsonPath = $post.JsonPath
  if (Test-Path $jsonPath) {
    try {
      $raw = Get-Content -Path $jsonPath -Raw -Encoding UTF8
      $jsonObj = ConvertFrom-Json $raw
      
      # Update category to "test"
      $jsonObj.category = "test"
      
      # Save back as JSON
      $updatedRaw = ConvertTo-Json $jsonObj -Depth 20
      
      # Write with UTF8 without BOM
      $utf8NoBom = New-Object System.Text.UTF8Encoding $false
      [System.IO.File]::WriteAllText($jsonPath, $updatedRaw, $utf8NoBom)
      
      Write-Host "Actualizado category -> 'test' en: $($post.Collection)/$($post.Slug)"
    } catch {
      Write-Host "Error actualizando: $($post.Collection)/$($post.Slug) - $_"
    }
  } else {
    Write-Host "Archivo JSON no encontrado para: $($post.Collection)/$($post.Slug)"
  }
}
