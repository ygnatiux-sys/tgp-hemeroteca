"""Capa 0: Traducción ontológica con Gemini vía Vertex AI (google-genai async).

Usa exclusivamente ADC local (`gcloud auth application-default login`) en desarrollo
o la Service Account del servicio en Cloud Run, sin Grounding y con Structured Output JSON.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from typing import Any

import google.auth
from google.auth.exceptions import DefaultCredentialsError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google import genai
from google.genai import types
from pydantic import BaseModel

from .schemas import EditorialLine, TranslatorOutput

logger = logging.getLogger("tgp.translator")

_CACHE_TTL_SECONDS = 1800
_translation_cache: dict[tuple[str, str], tuple[float, TranslatorOutput, str]] = {}


class _VertexTranslationSchema(BaseModel):
    canonical_queries: list[str]
    context_note: str


_ALTERNATIVE_SYSTEM_PROMPT = """Eres el curador jefe de archivo documental de The Great Puzzle Project (línea TGP Alternative).
Tu tarea es traducir una consulta en español (aunque contenga términos míticos, apócrifos, anómalos u opacos) hacia exactamente 3 búsquedas canónicas en inglés archivístico para consultar Wikimedia Commons y Wellcome Collection.

Reglas estrictas:
1. Traduce siempre al referente geográfico, geológico, arqueológico o museístico REAL y verificable en inglés (ejemplo: "pirámide de la Antártida" -> ["Ellsworth Mountains Antarctica peak", "Heritage Range nunatak Antarctica", "Vinson Massif glacier peak"]).
2. NO uses palabras como "alien", "UFO", "conspiracy" ni misticismo barato en las consultas; usa topónimos, formaciones geológicas, sitios excavados, piezas de museo o manuscritos catalogados.
3. Cada una de las 3 consultas debe aportar un ángulo visual complementario (vista general/sitio, formación/estructura concreta, archivo/expedición histórica) y tener entre 2 y 5 palabras en inglés para maximizar aciertos en CirrusSearch y Wellcome.
4. En context_note (español, 1-2 frases concisas), explica con honestidad material qué referente físico real devolverán los archivos frente al término de búsqueda original."""

_OFFICIAL_SYSTEM_PROMPT = """Eres un bibliotecario académico e investigador histórico de The Great Puzzle Project (línea TGP Hemeroteca).
Tu tarea es traducir una consulta histórica, arqueológica o codicológica en español hacia exactamente 3 búsquedas canónicas precisas en inglés archivístico para consultar Wikimedia Commons y Wellcome Collection.

Reglas estrictas:
1. Emplea nomenclatura museística, académica, geográfica o codicológica oficial en inglés (ejemplo: "Códices mayas del período clásico" -> ["Maya codex Dresden Madrid manuscript", "Mesoamerican Maya hieroglyphic codex", "Pre-Columbian Maya bark-paper manuscript"]).
2. Cada una de las 3 consultas debe mantener entre 2 y 5 palabras en inglés para que tanto CirrusSearch como el catálogo de Wellcome devuelvan resultados abundantes y precisos.
3. En context_note (español, 1-2 frases concisas), resume el alcance archivístico y material de las consultas generadas."""


def get_vertex_settings() -> tuple[str, str, str, str]:
    project = os.getenv("GOOGLE_CLOUD_PROJECT", "tgp-mind").strip() or "tgp-mind"
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1").strip() or "us-central1"
    primary_model = os.getenv("TGP_CAPA0_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
    fallback_model = os.getenv("TGP_CAPA0_FALLBACK_MODEL", "gemini-3.5-flash-lite").strip() or "gemini-3.5-flash-lite"
    return project, location, primary_model, fallback_model


def _clean_queries(raw_queries: list[str], original_query: str) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in raw_queries:
        q = re.sub(r"[\"'`]+", "", str(item or "")).strip()
        q = re.sub(r"\s+", " ", q)
        if not q:
            continue
        low = q.lower()
        if low not in seen:
            seen.add(low)
            cleaned.append(q)
    base_clean = re.sub(r"[\"'`¿?¡!]+", "", original_query).strip() or original_query.strip()
    while len(cleaned) < 3:
        candidate = base_clean if len(cleaned) == 0 else f"{cleaned[0]} archive"
        if candidate.lower() in seen:
            candidate = f"{cleaned[0]} historical"
        seen.add(candidate.lower())
        cleaned.append(candidate)
    return cleaned[:3]


def _check_adc_sync() -> dict[str, Any]:
    gac = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    try:
        creds, detected_project = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        creds.refresh(GoogleAuthRequest())
        sa_email = getattr(creds, "service_account_email", None)
        if gac:
            auth_mode = "service_account_env"
            principal = sa_email or gac
        elif sa_email and sa_email != "default":
            auth_mode = "cloud_run_sa"
            principal = sa_email
        else:
            auth_mode = "user_adc"
            principal = f"ADC válido (proyecto cuotas: {getattr(creds, 'quota_project_id', None) or detected_project or 'tgp-mind'})"
        return {
            "auth_mode": auth_mode,
            "adc_principal": principal,
            "vertex_ready": True,
            "vertex_error": None,
        }
    except DefaultCredentialsError as exc:
        return {
            "auth_mode": "missing",
            "adc_principal": "none",
            "vertex_ready": False,
            "vertex_error": f"Sin credenciales ADC. Ejecuta: gcloud auth application-default login ({exc})",
        }
    except Exception as exc:
        return {
            "auth_mode": "error",
            "adc_principal": "unknown",
            "vertex_ready": False,
            "vertex_error": str(exc),
        }


async def check_vertex_health() -> dict[str, Any]:
    """Verifica credenciales ADC/GCP sin consumir cuota de inferencia."""
    return await asyncio.to_thread(_check_adc_sync)


async def translate_editorial_query(
    query: str,
    editorial_line: EditorialLine,
) -> tuple[TranslatorOutput, str]:
    """Ejecuta la Capa 0 en Vertex AI con fallback de modelo/región si es necesario."""
    cache_key = (query.strip().lower(), editorial_line)
    cached = _translation_cache.get(cache_key)
    if cached and (time.monotonic() - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1], f"{cached[2]} (cache)"

    project, location, primary_model, fallback_model = get_vertex_settings()
    system_prompt = _ALTERNATIVE_SYSTEM_PROMPT if editorial_line == "alternative" else _OFFICIAL_SYSTEM_PROMPT

    attempts: list[tuple[str, str]] = [
        (primary_model, location),
        (fallback_model, location),
    ]
    if location != "global":
        attempts.append((fallback_model, "global"))
        attempts.append(("gemini-3.8-flash", "global"))

    # Desduplicar secuencia manteniendo el orden exacto.
    dedup_attempts: list[tuple[str, str]] = []
    for pair in attempts:
        if pair not in dedup_attempts:
            dedup_attempts.append(pair)

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.0,
        response_mime_type="application/json",
        response_json_schema=_VertexTranslationSchema.model_json_schema(),
    )

    last_error: Exception | None = None
    for model_name, loc in dedup_attempts:
        try:
            client = genai.Client(vertexai=True, project=project, location=loc)
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=f"Consulta original ({editorial_line}): {query}",
                config=config,
            )
            raw_text = (response.text or "").strip()
            if not raw_text:
                raise ValueError(f"Respuesta vacía desde Vertex AI ({model_name}@{loc})")
            parsed = _VertexTranslationSchema.model_validate_json(raw_text)
            normalized = TranslatorOutput(
                canonical_queries=_clean_queries(parsed.canonical_queries, query),
                context_note=parsed.context_note.strip() or f"Traducción documental ({editorial_line}) para {query}.",
            )
            model_tag = f"{model_name}@{loc}"
            _translation_cache[cache_key] = (time.monotonic(), normalized, model_tag)
            return normalized, model_tag
        except DefaultCredentialsError as exc:
            raise RuntimeError(
                "No hay credenciales ADC válidas para Vertex AI. "
                "Ejecuta en PowerShell: gcloud auth application-default login"
            ) from exc
        except Exception as exc:
            msg = str(exc)
            if "DefaultCredentialsError" in msg or "Reauthentication is needed" in msg or "invalid_grant" in msg:
                raise RuntimeError(
                    "Las credenciales ADC de Google Cloud expiraron o faltan. "
                    f"Ejecuta: gcloud auth application-default login ({msg})"
                ) from exc
            logger.warning("Capa 0 falló con %s@%s: %s", model_name, loc, msg)
            last_error = exc

    raise RuntimeError(
        f"Capa 0 Vertex AI no pudo resolver la traducción en proyecto '{project}': {last_error}"
    )
