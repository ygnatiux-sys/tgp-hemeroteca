"""Esquemas Pydantic v2 para TGP Editorial Core."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

EditorialLine = Literal["alternative", "official"]
CurateMode = Literal["magazines", "ebooks_thesis", "hero", "remotion", "medieval"]
Orientation = Literal["landscape", "portrait", "square"]
SourceRepo = Literal["wikimedia", "wellcome"]

MODE_DEFAULT_LIMITS: dict[str, int] = {
    "magazines": 35,
    "ebooks_thesis": 40,
    "hero": 5,
    "remotion": 5,
    "medieval": 30,
}


class CurateRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=300, description="Consulta temática en español o inglés.")
    editorial_line: EditorialLine = Field(
        default="alternative",
        description="Línea editorial: 'alternative' (referente geográfico/museístico real) u 'official' (nomenclatura académica).",
    )
    mode: CurateMode = Field(
        default="magazines",
        description="Modo de curaduría documental.",
    )
    limit: Optional[int] = Field(
        default=None,
        ge=1,
        le=100,
        description="Cantidad máxima de láminas. Si se omite, aplica el default del modo.",
    )

    def effective_limit(self) -> int:
        return self.limit if self.limit is not None else MODE_DEFAULT_LIMITS[self.mode]


class TranslatorOutput(BaseModel):
    canonical_queries: list[str] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Exactamente 3 consultas canónicas en inglés para Wikimedia Commons / Wellcome Collection.",
    )
    context_note: str = Field(
        ...,
        min_length=5,
        description="Nota editorial breve en español explicando el referente real o alcance archivístico.",
    )


class CuratedImage(BaseModel):
    title: str
    original_url: str
    thumb_url: str
    width: int
    height: int
    aspect_ratio: float
    orientation: Orientation
    license: str
    author: str
    description: str
    description_url: str
    score: int
    source_repo: SourceRepo
    attribution_text: str


class RemotionSlide(BaseModel):
    index: int
    title: str
    image_url: str
    thumb_url: str
    effect: Literal["zoom-in-slow", "pan-left-right"]
    duration_frames: int
    attribution_text: str


class RemotionPayload(BaseModel):
    fps: int = 30
    width: int = 1920
    height: int = 1080
    total_frames: int
    slides: list[RemotionSlide]
    render_command: str


class CurateResponse(BaseModel):
    query: str
    editorial_line: EditorialLine
    mode: CurateMode
    site_id: str = "unspecified"
    canonical_queries: list[str]
    queries_used: list[str]
    context_note: str
    model_used: str
    commercial_filter_applied: bool
    total_scanned: int
    total_returned: int
    warnings: list[str] = Field(default_factory=list)
    images: list[CuratedImage]
    remotion_payload: Optional[RemotionPayload] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    project: str
    location: str
    capa0_model: str
    capa0_fallback_model: str
    auth_mode: str
    adc_principal: str
    vertex_ready: bool
    vertex_error: Optional[str] = None
    auth_required: bool
