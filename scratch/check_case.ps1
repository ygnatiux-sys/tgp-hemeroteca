$rootDir = (Get-Location).Path

# Get all files in src and config
$files = Get-ChildItem -Path "$rootDir\src", "$rootDir\astro.config.mjs", "$rootDir\keystatic.config.ts" -Recurse -File | Where-Object {
    $_.FullName -notmatch '\\(node_modules|\.git|\.astro|dist)\\'
}

# Create a lookup map of lower-case full paths to actual full paths with exact casing
$fileMap = @{}
$files | ForEach-Object {
    $normalized = $_.FullName.Replace('\', '/')
    $fileMap[$normalized.ToLower()] = $normalized
}

$mismatches = @()

$importRegex = [regex]'(?:import|from|require|injectRoute)\s*\(?[''"`]([^''"`]+)[''"`]'

foreach ($file in $files) {
    if ($file.Extension -notmatch '^\.(astro|ts|tsx|js|jsx|mjs|css)$') { continue }
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $matches = $importRegex.Matches($content)
    
    $fileDir = $file.DirectoryName.Replace('\', '/')
    $fileNorm = $file.FullName.Replace('\', '/')
    
    foreach ($m in $matches) {
        $importPath = $m.Groups[1].Value
        if ($importPath.StartsWith('.')) {
            $exts = @('', '.ts', '.tsx', '.js', '.jsx', '.astro', '.mjs', '.css', '/index.ts', '/index.js', '/index.tsx', '/index.astro')
            
            # Resolve relative path
            # Combine
            try {
                $baseUri = New-Object System.Uri("file:///$fileDir/")
                $resolvedUri = New-Object System.Uri($baseUri, $importPath)
                $resolvedBase = $resolvedUri.LocalPath.Replace('\', '/')
            } catch {
                continue
            }
            
            foreach ($ext in $exts) {
                $target = $resolvedBase + $ext
                $targetLower = $target.ToLower()
                if ($fileMap.ContainsKey($targetLower)) {
                    $actual = $fileMap[$targetLower]
                    if ($actual -ne $target) {
                        # Case mismatch!
                        $mismatches += [PSCustomObject]@{
                            SourceFile = $fileNorm.Replace($rootDir.Replace('\','/') + '/', '')
                            Import = $importPath
                            Target = $target.Replace($rootDir.Replace('\','/') + '/', '')
                            ActualFile = $actual.Replace($rootDir.Replace('\','/') + '/', '')
                        }
                    }
                    break
                }
            }
        }
    }
}

Write-Output "TOTAL MISMATCHES: $($mismatches.Count)"
$mismatches | Format-Table -AutoSize
