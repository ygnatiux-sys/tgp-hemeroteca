#!/bin/bash
# -----------------------------------------------------------------------------
# Script de Despliegue de TGP Mind a Google Cloud Run
# -----------------------------------------------------------------------------

set -e

PROJECT_ID="tgp-mind"
REGION="us-central1"
SERVICE_NAME="tgp-mind"

echo "[TGP Mind] Compilando TypeScript..."
npm run build

echo "[TGP Mind] Iniciando despliegue a Cloud Run..."
echo "Proyecto: $PROJECT_ID | Región: $REGION | Servicio: $SERVICE_NAME"

gcloud config set project "$PROJECT_ID"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --clear-base-image

echo "[TGP Mind] Despliegue completado con éxito."
