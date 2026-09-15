$ErrorActionPreference = "Stop"

$PROJECT_ID = "tgp-mind"
$REGION = "us-central1"
$SERVICE_NAME = "tgp-mind"

Write-Host "[TGP Mind] Iniciando despliegue a Cloud Run..." -ForegroundColor Cyan
Write-Host "Proyecto: $PROJECT_ID | Región: $REGION | Servicio: $SERVICE_NAME" -ForegroundColor Yellow

gcloud config set project $PROJECT_ID

gcloud run deploy $SERVICE_NAME `
  --source . `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --clear-base-image

if ($LASTEXITCODE -ne 0) {
    Write-Host "[TGP Mind] Error en el despliegue." -ForegroundColor Red
    exit $LASTEXITCODE
} else {
    Write-Host "[TGP Mind] Despliegue completado con éxito." -ForegroundColor Green
}
