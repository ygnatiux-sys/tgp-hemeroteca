"""TGP Editorial Core — API FastAPI Desk-First."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from . import load_local_env
from .schemas import CurateRequest, CurateResponse, HealthResponse
from .search_archives import curate_archives
from .translator import check_vertex_health, get_vertex_settings, translate_editorial_query

# Carga únicamente tgp-editorial-core/.env (si existe), jamás el .env del monorepo.
load_local_env()

DEFAULT_CORS_ORIGINS = [
    "http://localhost:4321",
    "http://127.0.0.1:4321",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def _get_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        return DEFAULT_CORS_ORIGINS
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _is_secret_required() -> bool:
    return os.getenv("TGP_REQUIRE_SECRET", "0").strip().lower() in {"1", "true", "yes"}


async def verify_tgp_secret(
    x_tgp_secret: Optional[str] = Header(default=None, alias="x-tgp-secret"),
) -> None:
    if not _is_secret_required():
        return
    expected = os.getenv("TGP_SHARED_SECRET", "").strip()
    if not expected or x_tgp_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cabecera x-tgp-secret inválida o ausente.",
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        app.state.http_client = client
        yield


app = FastAPI(
    title="TGP Editorial Core",
    version="2.0.0",
    description="Cerebro FastAPI Desk-First para curaduría documental de TGP.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def ensure_utf8_json_charset(request: Request, call_next):
    """Agrega charset=utf-8 a application/json para compatibilidad con PowerShell 5.1."""
    response = await call_next(request)
    ct = response.headers.get("content-type", "")
    if ct.lower().startswith("application/json") and "charset=" not in ct.lower():
        response.headers["content-type"] = "application/json; charset=utf-8"
    return response


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    project, location, model_chain = get_vertex_settings()
    primary_model = model_chain[0] if model_chain else "gemini-3.8-flash"
    fallback_model = model_chain[1] if len(model_chain) > 1 else primary_model
    vertex = await check_vertex_health()
    return HealthResponse(
        status="ok" if vertex["vertex_ready"] else "degraded",
        service="tgp-editorial-core",
        version="2.0.0",
        project=project,
        location=location,
        capa0_model=primary_model,
        capa0_fallback_model=fallback_model,
        auth_mode=vertex["auth_mode"],
        adc_principal=vertex["adc_principal"],
        vertex_ready=vertex["vertex_ready"],
        vertex_error=vertex["vertex_error"],
        auth_required=_is_secret_required(),
    )


@app.post(
    "/api/v1/curate",
    response_model=CurateResponse,
    dependencies=[Depends(verify_tgp_secret)],
)
async def curate(
    payload: CurateRequest,
    request: Request,
    x_tgp_site: Optional[str] = Header(default="unspecified", alias="X-TGP-Site"),
) -> CurateResponse:
    try:
        translation, model_used = await translate_editorial_query(
            query=payload.query,
            editorial_line=payload.editorial_line,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    http_client: httpx.AsyncClient = request.app.state.http_client
    try:
        return await curate_archives(
            request=payload,
            translation=translation,
            model_used=model_used,
            client=http_client,
            site_id=x_tgp_site or "unspecified",
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
