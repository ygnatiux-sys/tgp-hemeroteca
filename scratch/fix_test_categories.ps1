$testPostsJson = Get-Content "c:\Users\ygnat\tgp-hemeroteca\scratch\test_posts_to_update.json" -Raw | ConvertFrom-Json

Write-Host "=== CORRIGIENDO CATEGORIAS EN POSTS DE PRUEBA ==="
foreach ($post in $testPostsJson) {
  $jsonPath = $post.JsonPath
  if (Test-Path $jsonPath) {
    try {
      $raw = Get-Content -Path $jsonPath -Raw -Encoding UTF8
      $jsonObj = ConvertFrom-Json $raw
      
      # Set or Add category property
      if ($jsonObj.PSObject.Properties['category']) {
        $jsonObj.category = "test"
      } else {
        $jsonObj | Add-Member -NotePropertyName "category" -NotePropertyValue "test"
      }
      
      # Save back as JSON
      $updatedRaw = ConvertTo-Json $jsonObj -Depth 20
      
      # Write with UTF8 without BOM
      $utf8NoBom = New-Object System.Text.UTF8Encoding $false
      [System.IO.File]::WriteAllText($jsonPath, $updatedRaw, $utf8NoBom)
      
      Write-Host "Completado -> 'test' en: $($post.Collection)/$($post.Slug)"
    } catch {
      Write-Host "Error actualizando $($post.Collection)/$($post.Slug): $_"
    }
  }
}
