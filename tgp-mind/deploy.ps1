$ErrorActionPreference = "Stop"

$PROJECT_ID = "tgp-mind"
$REGION = "us-central1"
$SERVICE_NAME = "tgp-mind"

Write-Host "[TGP Mind] Leyendo variables de entorno desde .env..." -ForegroundColor Cyan
$envFile = Join-Path $PSScriptRoot ".env"
$envMap = @{}

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line -split "=", 2
            $key = $parts[0].Trim()
            $val = $parts[1].Trim().Trim('"').Trim("'")
            if ($val) {
                $envMap[$key] = $val
            }
        }
    }
    # Cloud Run gestiona automáticamente el puerto (8080)
    $envMap.Remove("PORT")
    Write-Host "[TGP Mind] Variables a inyectar: $($envMap.Keys -join ', ')" -ForegroundColor DarkGray
} else {
    Write-Host "[TGP Mind] ADVERTENCIA: No se encontró el archivo .env" -ForegroundColor Yellow
}

$envVarsList = @()
foreach ($key in $envMap.Keys) {
    $envVarsList += "$key=$($envMap[$key])"
}
$envVarsString = $envVarsList -join ","

Write-Host "[TGP Mind] Iniciando despliegue a Cloud Run (actualizando imagen de código)..." -ForegroundColor Cyan
Write-Host "Proyecto: $PROJECT_ID | Región: $REGION | Servicio: $SERVICE_NAME" -ForegroundColor Yellow

gcloud config set project $PROJECT_ID

if ($envVarsString) {
    gcloud run deploy $SERVICE_NAME `
      --source . `
      --region $REGION `
      --platform managed `
      --allow-unauthenticated `
      --clear-base-image `
      --set-env-vars "$envVarsString"
} else {
    gcloud run deploy $SERVICE_NAME `
      --source . `
      --region $REGION `
      --platform managed `
      --allow-unauthenticated `
      --clear-base-image
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[TGP Mind] Error en el despliegue." -ForegroundColor Red
    exit $LASTEXITCODE
} else {
    Write-Host "[TGP Mind] Despliegue completado con éxito e inyección de variables verificada." -ForegroundColor Green
}
