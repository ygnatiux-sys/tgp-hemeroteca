# scripts/auditar-todo.ps1
$ErrorActionPreference = "SilentlyContinue"
$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
$contentDir = Join-Path $rootDir "src\content"

$collections = @(
    @{ id = "ensayos"; name = "Ensayos"; dir = Join-Path $contentDir "ensayos" },
    @{ id = "georreferencias"; name = "Georreferencias Arqueosemioticas"; dir = Join-Path $contentDir "georreferencias" },
    @{ id = "arquetipos-globales"; name = "Arquetipos Globales"; dir = Join-Path $contentDir "arquetipos-globales" },
    @{ id = "ensayos-cinematicos"; name = "Ensayos Cinematicos (GSAP)"; dir = Join-Path $contentDir "ensayos-cinematicos" }
)

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   TGP HEMEROTECA - RELEVAMIENTO INTEGRAL DE CONTENIDO" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$totalPosts = 0
$totalOk = 0
$totalIncompletos = 0
$totalSinFoto = 0
$totalSinTexto = 0

foreach ($col in $collections) {
    if (-not (Test-Path $col.dir)) { continue }
    
    $dirs = Get-ChildItem -Path $col.dir -Directory | Where-Object { $_.Name -ne ".gitkeep" } | Sort-Object Name
    Write-Host ""
    Write-Host ("COLECCION: " + $col.name.ToUpper() + " (" + $dirs.Count + " posts)") -ForegroundColor Yellow
    Write-Host ("------------------------------------------------------------") -ForegroundColor DarkGray

    if ($dirs.Count -eq 0) {
        Write-Host "  (Vacia)" -ForegroundColor DarkGray
        continue
    }

    foreach ($d in $dirs) {
        $totalPosts++
        $slug = $d.Name
        $jsonPath = Join-Path $d.FullName "index.json"
        $mdocPath = Join-Path $d.FullName "content.mdoc"

        $faltantes = [System.Collections.ArrayList]::new()
        $title = $slug
        $hasImage = $false
        $imageDetail = "Sin foto"
        $hasContent = $false
        $contentDetail = "Sin contenido"
        $isDraft = $false

        if (Test-Path $jsonPath) {
            try {
                $raw = Get-Content -Path $jsonPath -Raw
                $data = $raw | ConvertFrom-Json
                if ($data.title) { $title = $data.title } else { [void]$faltantes.Add("Titulo vacio") }
                if (-not $data.date) { [void]$faltantes.Add("Sin fecha") }
                if (-not $data.excerpt -and -not $data.dek) { [void]$faltantes.Add("Sin Excerpt/Dek") }
                if ($data.draft -eq $true) { $isDraft = $true }

                # Revisar imagen
                $rawImg = $null
                if ($data.coverImage) { $rawImg = [string]$data.coverImage }
                elseif ($data.image) { $rawImg = [string]$data.image }
                elseif ($data.portada) { $rawImg = [string]$data.portada }

                if (-not $rawImg -and $data.generadorTexto) {
                    try {
                        $pGen = $data.generadorTexto | ConvertFrom-Json
                        if ($pGen.image) { $rawImg = [string]$pGen.image }
                    } catch {}
                }

                if ($rawImg -and $rawImg.Trim().Length -gt 0) {
                    if ($rawImg.StartsWith("data:image/")) {
                        $hasImage = $true
                        $imageDetail = "Imagen Base64 IA (embebida en JSON)"
                        [void]$faltantes.Add("Foto en Base64 IA (no es archivo fisico en disco)")
                    } elseif ($rawImg.StartsWith("http")) {
                        $hasImage = $true
                        $imageDetail = "URL remota (" + $rawImg.Substring(0, [Math]::Min(50, $rawImg.Length)) + "...)"
                    } elseif ($rawImg.StartsWith("/src/assets/") -or $rawImg.StartsWith("src/assets/")) {
                        $clean = $rawImg.TrimStart("/").Replace("/", "\")
                        $diskImg = Join-Path $rootDir $clean
                        if (Test-Path $diskImg) {
                            $hasImage = $true
                            $imageDetail = "Archivo OK en disco (" + $rawImg + ")"
                        } else {
                            $hasImage = $false
                            $imageDetail = "Archivo ROTO no encontrado (" + $rawImg + ")"
                            [void]$faltantes.Add("Foto ROTA (archivo fisico no existe en disco)")
                        }
                    } else {
                        $hasImage = $true
                        $imageDetail = "Ruta: " + $rawImg
                    }
                } else {
                    [void]$faltantes.Add("Sin Foto de Portada")
                }

                # Revisar texto
                $mdocLen = 0
                if (Test-Path $mdocPath) {
                    $mdocText = Get-Content -Path $mdocPath -Raw
                    if ($mdocText) { $mdocLen = $mdocText.Trim().Length }
                }

                $aiLen = 0
                $aiField = ""
                if ($data.generadorGeoref) {
                    $aiLen = ([string]$data.generadorGeoref).Trim().Length
                    $aiField = "generadorGeoref"
                } elseif ($data.generadorTexto) {
                    $aiField = "generadorTexto"
                    try {
                        $pGen = $data.generadorTexto | ConvertFrom-Json
                        if ($pGen.text) { $aiLen = ([string]$pGen.text).Trim().Length }
                        else { $aiLen = ([string]$data.generadorTexto).Trim().Length }
                    } catch {
                        $aiLen = ([string]$data.generadorTexto).Trim().Length
                    }
                }

                if ($mdocLen -gt 150) {
                    $hasContent = $true
                    $contentDetail = "content.mdoc (" + $mdocLen + " caracteres)"
                } elseif ($aiLen -gt 150) {
                    $hasContent = $true
                    $contentDetail = "Texto en " + $aiField + " (" + $aiLen + " caracteres)"
                    [void]$faltantes.Add("Texto solo en campo IA (" + $aiField + "), content.mdoc esta vacio")
                } elseif ($mdocLen -gt 0 -or $aiLen -gt 0) {
                    $hasContent = $true
                    $contentDetail = "Texto muy breve (<150 caracteres)"
                    [void]$faltantes.Add("Contenido extremadamente corto")
                } else {
                    $hasContent = $false
                    [void]$faltantes.Add("Sin Contenido de Texto (0 caracteres)")
                }

            } catch {
                [void]$faltantes.Add("Error leyendo index.json: " + $_)
            }
        } else {
            [void]$faltantes.Add("Falta index.json")
        }

        if (-not $hasImage) { $totalSinFoto++ }
        if (-not $hasContent) { $totalSinTexto++ }

        $draftTag = if ($isDraft) { " [BORRADOR]" } else { "" }
        if ($faltantes.Count -eq 0) {
            $totalOk++
            Write-Host ""
            Write-Host ("  [OK] [" + $slug + "] `"" + $title + "`"" + $draftTag) -ForegroundColor Green
            Write-Host ("       Foto:  " + $imageDetail) -ForegroundColor DarkGray
            Write-Host ("       Texto: " + $contentDetail) -ForegroundColor DarkGray
        } else {
            $totalIncompletos++
            Write-Host ""
            Write-Host ("  [INCOMPLETO] [" + $slug + "] `"" + $title + "`"" + $draftTag) -ForegroundColor Yellow
            Write-Host ("       Foto:  " + $imageDetail) -ForegroundColor DarkGray
            Write-Host ("       Texto: " + $contentDetail) -ForegroundColor DarkGray
            Write-Host ("       QUE LE FALTA:") -ForegroundColor Red
            foreach ($f in $faltantes) {
                Write-Host ("         - " + $f) -ForegroundColor Red
            }
        }
    }
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "RESUMEN EJECUTIVO:" -ForegroundColor Cyan
Write-Host ("  Total posts en todas las colecciones: " + $totalPosts)
Write-Host ("  Completos y listos:                  " + $totalOk) -ForegroundColor Green
Write-Host ("  Con algun faltante:                  " + $totalIncompletos) -ForegroundColor Yellow
Write-Host ("  Sin foto o con foto rota:            " + $totalSinFoto) -ForegroundColor Magenta
Write-Host ("  Sin texto o texto vacio:             " + $totalSinTexto) -ForegroundColor Red
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
