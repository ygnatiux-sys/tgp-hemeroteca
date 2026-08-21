$baseDir = 'c:\Users\ygnat\tgp-hemeroteca\src\content'
$testCollection = Join-Path $baseDir 'test'
if (-not (Test-Path $testCollection)) {
  New-Item -ItemType Directory -Path $testCollection | Out-Null
  Write-Host "Created collection folder: test"
}

# Load list of test posts (generated previously)
$testPostsPath = 'c:\Users\ygnat\tgp-hemeroteca\scratch\test_posts_to_update.json'
if (-not (Test-Path $testPostsPath)) {
  Write-Error "Test posts JSON not found at $testPostsPath"
  exit 1
}
$testPosts = Get-Content $testPostsPath -Raw | ConvertFrom-Json

foreach ($post in $testPosts) {
  $src = $post.FolderPath
  $dest = Join-Path $testCollection (Split-Path $src -Leaf)
  if (Test-Path $src) {
    # Move folder to new collection
    Move-Item -Path $src -Destination $dest -Force
    Write-Host "Moved $($post.Collection)/$($post.Slug) -> test collection"
  } else {
    Write-Host "Source folder not found (already moved?): $src"
  }
}

Write-Host "All test posts have been moved to the 'test' collection."
