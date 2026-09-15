#!/usr/bin/env bash
# =============================================================================
# TGP MIND — Script de deploy a Google Cloud Run
# Uso: bash deploy.sh
# Requisitos: gcloud CLI autenticado, Docker, proyecto GCP configurado
# =============================================================================

set -euo pipefail

# -- Variables — editá estos valores antes de ejecutar -------------------------
PROJECT_ID="${TGP_PROJECT_ID:-TU_PROJECT_ID}"
REGION="us-central1"
SERVICE_NAME="tgp-mind"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Leemos variables secretas desde el entorno (o un .env local)
if [ -f .env ]; then
  set -a; source .env; set +a
fi

TELEGRAM_TOKEN="${TELEGRAM_TOKEN:?Falta TELEGRAM_TOKEN}"
GEMINI_API_KEY="${GEMINI_API_KEY:?Falta GEMINI_API_KEY}"
TGP_MIND_API_KEY="${TGP_MIND_API_KEY:?Falta TGP_MIND_API_KEY}"
DIALOGFLOW_PROJECT="${DIALOGFLOW_PROJECT:-}"
DIALOGFLOW_LOCATION="${DIALOGFLOW_LOCATION:-us-central1}"
DIALOGFLOW_AGENT_ID="${DIALOGFLOW_AGENT_ID:-}"

echo ">>> [1/4] Compilando TypeScript..."
npm run build

echo ">>> [2/4] Construyendo imagen Docker: ${IMAGE_NAME}"
gcloud builds submit \
  --tag "${IMAGE_NAME}" \
  --project "${PROJECT_ID}"

echo ">>> [3/4] Desplegando en Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 5 \
  --set-env-vars \
"TELEGRAM_TOKEN=${TELEGRAM_TOKEN},\
GEMINI_API_KEY=${GEMINI_API_KEY},\
TGP_MIND_API_KEY=${TGP_MIND_API_KEY},\
DIALOGFLOW_PROJECT=${DIALOGFLOW_PROJECT},\
DIALOGFLOW_LOCATION=${DIALOGFLOW_LOCATION},\
DIALOGFLOW_AGENT_ID=${DIALOGFLOW_AGENT_ID},\
PORT=8080"

# -- Obtener URL del servicio --------------------------------------------------
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format "value(status.url)")

echo ""
echo ">>> [4/4] Registrando webhook en Telegram..."
curl -sS "https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${SERVICE_URL}/webhook/telegram" | jq .

echo ""
echo "======================================================================"
echo "  TGP Mind desplegado exitosamente!"
echo "  URL: ${SERVICE_URL}"
echo "  Webhook Telegram: ${SERVICE_URL}/webhook/telegram"
echo "  API Mind (sidebar): ${SERVICE_URL}/api/mind"
echo "======================================================================"
echo ""
echo "  Copiá esta URL en tu .env local del proyecto Astro:"
echo "  TGP_MIND_ENDPOINT=${SERVICE_URL}/api/mind"
echo "======================================================================"
