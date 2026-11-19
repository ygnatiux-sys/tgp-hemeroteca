"""Motor documental de archivos: Wikimedia Commons + Wellcome Collection API v2.

Porta las defensas probadas de SOMA v1.2 (whitelist MIME anti-TIFF/OOM, exclusión
de SVGs/banderas/logos/localizadores, sanitización HTML, desduplicación y warnings
forenses) e incorpora filtro comercial estricto, fallback multiconsulta, caché TTL
y control de concurrencia.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any
from urllib.parse import urlparse

import httpx

from .licensing import evaluate_license, format_attribution, strip_html
from .schemas import (
    CuratedImage,
    CurateRequest,
    CurateResponse,
    Orientation,
    RemotionPayload,
    RemotionSlide,
    TranslatorOutput,
)

logger = logging.getLogger("tgp.archives")

WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php"
WELLCOME_API_URL = "https://api.wellcomecollection.org/catalogue/v2/images"

WIKIMEDIA_USER_AGENT = (
    "TGP-Editorial-Core/2.0 (https://thegreatpuzzleproject.com; editorial@thegreatpuzzleproject.com)"
)
WIKIMEDIA_HEADERS = {
    "User-Agent": WIKIMEDIA_USER_AGENT,
    "Api-User-Agent": WIKIMEDIA_USER_AGENT,
    "Accept": "application/json",
}

# Regla de oro anti-OOM portada de SOMA v1.2: cero TIFF, cero SVG, cero video/PDF.
ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp"}
FORBIDDEN_EXT_RE = re.compile(r"\.(?:svg|tif|tiff|pdf|djvu|ogv|webm|mp4|gif|xcf)$", re.IGNORECASE)
ALLOWED_HOSTS = ("wikimedia.org", "wellcomecollection.org")

BASE_GARBAGE_TITLE_RE = re.compile(
    r"\b(?:svg|flag|coat of arms|escudo|bandera|locator|blank map|logo|icon|symbol|"
    r"signature|stamp|seal|pdf|djvu|user:|talk:|template:)\b",
    re.IGNORECASE,
)

MAP_DIAGRAM_TITLE_RE = re.compile(
    r"\b(?:map|mapa|diagram|diagrama|plan|plano|chart|graph|schematic|blueprint|topograph(?:y|ic))\b",
    re.IGNORECASE,
)

GENERIC_AUTHORS = {"", "wikimedia", "wikimedia commons", "unknown", "anonymous", "anon"}

_ARCHIVE_SEMAPHORE = asyncio.Semaphore(3)
_ARCHIVE_CACHE_TTL = 600
_archive_cache: dict[tuple[Any, ...], tuple[float, dict[str, Any]]] = {}


def _is_allowed_host(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
        return any(host == dom or host.endswith(f".{dom}") for dom in ALLOWED_HOSTS)
    except Exception:
        return False


def _compute_orientation(width: int, height: int) -> tuple[float, Orientation]:
    safe_w = max(1, width)
    safe_h = max(1, height)
    ratio = round(safe_w / safe_h, 4)
    if ratio >= 1.15:
        orientation: Orientation = "landscape"
    elif ratio <= 0.88:
        orientation = "portrait"
    else:
        orientation = "square"
    return ratio, orientation


def _compute_score(
    width: int,
    height: int,
    aspect_ratio: float,
    description: str,
    author: str,
    is_pd_or_cc0: bool,
    prefer_landscape: bool = False,
) -> int:
    score = 35
    max_dim = max(width, height)
    if max_dim >= 2500:
        score += 25
    elif max_dim >= 1920:
        score += 20
    elif max_dim >= 1400:
        score += 12
    elif max_dim >= 1100:
        score += 6

    if len(description) > 80:
        score += 12
    elif len(description) > 20:
        score += 8

    if author.strip().lower() not in GENERIC_AUTHORS:
        score += 10

    if is_pd_or_cc0:
        score += 15
    else:
        score += 5

    if prefer_landscape and 1.33 <= aspect_ratio <= 2.35:
        score += 10

    return max(0, min(100, score))


async def _get_json_with_retry(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, str],
    headers: dict[str, str],
) -> dict[str, Any]:
    cache_key = (url, tuple(sorted(params.items())))
    cached = _ARCHIVE_CACHE_TTL and _archive_cache.get(cache_key)
    if cached and (time.monotonic() - cached[0]) < _ARCHIVE_CACHE_TTL:
        return cached[1]

    last_exc: Exception | None = None
    async with _ARCHIVE_SEMAPHORE:
        for attempt in range(3):
            try:
                res = await client.get(url, params=params, headers=headers)
                if res.status_code in {429, 502, 503, 504}:
                    retry_after = float(res.headers.get("Retry-After", "0") or 0)
                    wait_s = min(6.0, retry_after if retry_after > 0 else 1.2 * (2**attempt))
                    logger.warning("HTTP %s desde %s (reintento %s en %.1fs)", res.status_code, url, attempt + 1, wait_s)
                    await asyncio.sleep(wait_s)
                    continue
                res.raise_for_status()
                data = res.json()
                _archive_cache[cache_key] = (time.monotonic(), data)
                return data
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                last_exc = exc
                if attempt < 2:
                    await asyncio.sleep(1.0 * (2**attempt))
            except httpx.HTTPStatusError as exc:
                last_exc = exc
                break

    raise RuntimeError(f"Error consultando {url}: {last_exc}")


async def _fetch_wikimedia_page(
    client: httpx.AsyncClient,
    canonical_query: str,
    *,
    offset: int,
    min_max_dim: int,
    min_short_dim: int,
    allow_maps_diagrams: bool,
    min_aspect_ratio: float | None = None,
    prefer_landscape: bool = False,
) -> tuple[list[CuratedImage], int, dict[str, int]]:
    if allow_maps_diagrams:
        cirrus = (
            f"{canonical_query} filetype:bitmap "
            "-intitle:svg -intitle:flag -intitle:logo -intitle:locator"
        )
    else:
        cirrus = (
            f"{canonical_query} filetype:bitmap "
            "-intitle:map -intitle:diagram -intitle:plan "
            "-intitle:svg -intitle:flag -intitle:logo -intitle:locator"
        )

    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrnamespace": "6",
        "gsrsearch": cirrus,
        "gsrlimit": "40",
        "gsroffset": str(offset),
        "prop": "imageinfo",
        "iiprop": "url|size|dimensions|mime|extmetadata",
        "iiurlwidth": "1440",
    }

    data = await _get_json_with_retry(client, WIKIMEDIA_API_URL, params, WIKIMEDIA_HEADERS)
    pages = (data.get("query") or {}).get("pages") or {}

    stats = {
        "scanned": len(pages),
        "skipped_mime_or_tiff": 0,
        "skipped_garbage_or_map": 0,
        "skipped_license": 0,
        "skipped_resolution_or_aspect": 0,
    }
    accepted: list[CuratedImage] = []

    for page in pages.values():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]

        raw_title = re.sub(r"^File:", "", str(page.get("title") or ""), flags=re.IGNORECASE)
        mime = str(info.get("mime") or "").lower()
        original_url = str(info.get("url") or "")
        thumb_url = str(info.get("thumburl") or original_url)
        description_url = str(
            info.get("descriptionurl")
            or f"https://commons.wikimedia.org/?curid={page.get('pageid', '')}"
        )

        if mime not in ALLOWED_MIMES or FORBIDDEN_EXT_RE.search(raw_title) or FORBIDDEN_EXT_RE.search(original_url):
            stats["skipped_mime_or_tiff"] += 1
            continue

        if not original_url or not _is_allowed_host(original_url):
            stats["skipped_garbage_or_map"] += 1
            continue

        if BASE_GARBAGE_TITLE_RE.search(raw_title):
            stats["skipped_garbage_or_map"] += 1
            continue

        if not allow_maps_diagrams and MAP_DIAGRAM_TITLE_RE.search(raw_title):
            stats["skipped_garbage_or_map"] += 1
            continue

        width = int(info.get("width") or 0)
        height = int(info.get("height") or 0)
        aspect_ratio, orientation = _compute_orientation(width, height)

        if max(width, height) < min_max_dim or min(width, height) < min_short_dim:
            stats["skipped_resolution_or_aspect"] += 1
            continue

        if min_aspect_ratio is not None and aspect_ratio < min_aspect_ratio:
            stats["skipped_resolution_or_aspect"] += 1
            continue

        ext = info.get("extmetadata") or {}
        lic_short = (ext.get("LicenseShortName") or {}).get("value", "")
        usage_terms = (ext.get("UsageTerms") or {}).get("value", "")
        restrictions = (ext.get("Restrictions") or {}).get("value", "")
        non_free = (ext.get("NonFree") or {}).get("value", "")

        lic_eval = evaluate_license(
            license_short=lic_short,
            usage_terms=usage_terms,
            restrictions=restrictions,
            non_free=non_free,
        )
        if not lic_eval.is_commercially_safe:
            stats["skipped_license"] += 1
            continue

        artist_clean = strip_html((ext.get("Artist") or {}).get("value", ""))
        credit_clean = strip_html((ext.get("Credit") or {}).get("value", ""))
        author = artist_clean or credit_clean or "Wikimedia Commons"
        description = strip_html((ext.get("ImageDescription") or {}).get("value", ""))
        clean_title = re.sub(r"\.[a-z0-9]{2,5}$", "", raw_title, flags=re.IGNORECASE).replace("_", " ").strip()

        score = _compute_score(
            width=width,
            height=height,
            aspect_ratio=aspect_ratio,
            description=description,
            author=author,
            is_pd_or_cc0=lic_eval.is_pd_or_cc0,
            prefer_landscape=prefer_landscape,
        )

        accepted.append(
            CuratedImage(
                title=clean_title or "Sin título",
                original_url=original_url,
                thumb_url=thumb_url,
                width=width,
                height=height,
                aspect_ratio=aspect_ratio,
                orientation=orientation,
                license=lic_eval.normalized,
                author=author,
                description=description or clean_title,
                description_url=description_url,
                score=score,
                source_repo="wikimedia",
                attribution_text=format_attribution(clean_title, author, lic_eval.normalized, "wikimedia"),
            )
        )

    return accepted, len(pages), stats


def _extract_wellcome_iiif(item: dict[str, Any]) -> tuple[str | None, str, str]:
    thumb = item.get("thumbnail") or {}
    thumb_url = str(thumb.get("url") or "")
    thumb_lic = thumb.get("license") or {}
    lic_id = str(thumb_lic.get("id") or "")
    lic_label = str(thumb_lic.get("label") or "")

    for loc in item.get("locations") or []:
        loc_type = ((loc.get("locationType") or {}).get("id") or "").lower()
        if loc_type == "iiif-image":
            loc_url = str(loc.get("url") or thumb_url)
            loc_lic = loc.get("license") or thumb_lic
            lic_id = str(loc_lic.get("id") or lic_id)
            lic_label = str(loc_lic.get("label") or lic_label)
            if loc_url:
                thumb_url = loc_url
            break

    if not thumb_url:
        return None, lic_id, lic_label

    iiif_base = re.sub(r"/info\.json$", "", thumb_url).rstrip("/")
    if not _is_allowed_host(iiif_base):
        return None, lic_id, lic_label
    return iiif_base, lic_id, lic_label


async def _fetch_wellcome_images(
    client: httpx.AsyncClient,
    query_text: str,
    *,
    license_filter: str = "pdm,cc0",
    page_size: int = 40,
    min_aspect_ratio: float | None = None,
) -> tuple[list[CuratedImage], int, dict[str, int]]:
    params = {
        "query": query_text,
        "locations.license": license_filter,
        "pageSize": str(min(100, page_size)),
    }
    headers = {"User-Agent": WIKIMEDIA_USER_AGENT, "Accept": "application/json"}
    data = await _get_json_with_retry(client, WELLCOME_API_URL, params, headers)
    results = data.get("results") or []

    stats = {"scanned": len(results), "skipped_license": 0, "skipped_invalid": 0}
    accepted: list[CuratedImage] = []

    for item in results:
        iiif_base, lic_id, lic_label = _extract_wellcome_iiif(item)
        if not iiif_base:
            stats["skipped_invalid"] += 1
            continue

        lic_eval = evaluate_license(
            license_short=lic_label,
            wellcome_license_id=lic_id,
        )
        if not lic_eval.is_commercially_safe:
            stats["skipped_license"] += 1
            continue

        raw_ratio = float(item.get("aspectRatio") or 1.33)
        raw_ratio = max(0.25, min(4.0, raw_ratio))
        width = 1600
        height = max(1, round(width / raw_ratio))
        aspect_ratio, orientation = _compute_orientation(width, height)

        if min_aspect_ratio is not None and aspect_ratio < min_aspect_ratio:
            stats["skipped_invalid"] += 1
            continue

        source = item.get("source") or {}
        source_id = str(source.get("id") or item.get("id") or "")
        title = strip_html(source.get("title") or "Wellcome Archival Plate")
        author = "Wellcome Collection"
        description = title
        desc_url = f"https://wellcomecollection.org/works/{source_id}" if source_id else "https://wellcomecollection.org/images"

        original_url = f"{iiif_base}/full/1600,/0/default.jpg"
        thumb_url = f"{iiif_base}/full/1440,/0/default.jpg"

        score = _compute_score(
            width=width,
            height=height,
            aspect_ratio=aspect_ratio,
            description=description,
            author=author,
            is_pd_or_cc0=lic_eval.is_pd_or_cc0,
            prefer_landscape=False,
        )

        accepted.append(
            CuratedImage(
                title=title,
                original_url=original_url,
                thumb_url=thumb_url,
                width=width,
                height=height,
                aspect_ratio=aspect_ratio,
                orientation=orientation,
                license=lic_eval.normalized,
                author=author,
                description=description,
                description_url=desc_url,
                score=score,
                source_repo="wellcome",
                attribution_text=format_attribution(title, author, lic_eval.normalized, "wellcome"),
            )
        )

    return accepted, len(results), stats


def _short_archival_variants(canonical_queries: list[str]) -> list[str]:
    """Genera variantes de 2-3 palabras para Wellcome si las consultas largas dan 0 aciertos."""
    variants: list[str] = []
    seen: set[str] = {q.lower() for q in canonical_queries}
    for q in canonical_queries:
        words = [w for w in re.split(r"\s+", q.strip()) if len(w) > 2]
        if len(words) > 2:
            short = " ".join(words[:2])
            if short.lower() not in seen:
                seen.add(short.lower())
                variants.append(short)
    return canonical_queries + variants


def _merge_unique(existing: list[CuratedImage], incoming: list[CuratedImage]) -> list[CuratedImage]:
    by_url: dict[str, CuratedImage] = {
        img.original_url.split("?")[0].lower(): img for img in existing
    }
    for img in incoming:
        key = img.original_url.split("?")[0].lower()
        prev = by_url.get(key)
        if prev is None or img.score > prev.score:
            by_url[key] = img
    return sorted(by_url.values(), key=lambda i: (-i.score, -i.width))


def _format_warnings(stats: dict[str, int], extra: list[str]) -> list[str]:
    warnings = list(extra)
    if stats.get("skipped_mime_or_tiff"):
        warnings.append(f"Omitidos {stats['skipped_mime_or_tiff']} candidatos no bitmap/TIFF/SVG (protección SOMA anti-OOM).")
    if stats.get("skipped_license"):
        warnings.append(f"Excluidas {stats['skipped_license']} láminas por licencia no comercial/SA/NC/ND.")
    if stats.get("skipped_garbage_or_map"):
        warnings.append(f"Descartados {stats['skipped_garbage_or_map']} candidatos por banderas/logos/mapas excluidos en este modo.")
    if stats.get("skipped_resolution_or_aspect"):
        warnings.append(f"Filtradas {stats['skipped_resolution_or_aspect']} imágenes por resolución o relación de aspecto.")
    return warnings


async def curate_archives(
    request: CurateRequest,
    translation: TranslatorOutput,
    model_used: str,
    client: httpx.AsyncClient,
    site_id: str = "unspecified",
) -> CurateResponse:
    target_limit = request.effective_limit()
    queries_used: list[str] = []
    extra_warnings: list[str] = []
    agg_stats = {
        "scanned": 0,
        "skipped_mime_or_tiff": 0,
        "skipped_garbage_or_map": 0,
        "skipped_license": 0,
        "skipped_resolution_or_aspect": 0,
    }
    pool: list[CuratedImage] = []

    def _acc(st: dict[str, int]) -> None:
        for k, v in st.items():
            agg_stats[k] = agg_stats.get(k, 0) + v

    if request.mode == "magazines":
        for idx, cq in enumerate(translation.canonical_queries):
            queries_used.append(cq)
            for offset in (0, 40):
                items, scanned, st = await _fetch_wikimedia_page(
                    client,
                    cq,
                    offset=offset,
                    min_max_dim=1400,
                    min_short_dim=700,
                    allow_maps_diagrams=False,
                )
                agg_stats["scanned"] += scanned
                _acc(st)
                pool = _merge_unique(pool, items)
                if len(pool) >= target_limit or scanned < 40:
                    break
            if len(pool) >= target_limit:
                break
            if idx < len(translation.canonical_queries) - 1:
                extra_warnings.append(
                    f"Fallback automático tras '{cq}' ({len(pool)}/{target_limit} válidas)."
                )

    elif request.mode == "ebooks_thesis":
        wiki_pool: list[CuratedImage] = []
        for idx, cq in enumerate(translation.canonical_queries):
            queries_used.append(cq)
            for offset in (0, 40):
                items, scanned, st = await _fetch_wikimedia_page(
                    client,
                    cq,
                    offset=offset,
                    min_max_dim=1100,
                    min_short_dim=500,
                    allow_maps_diagrams=True,
                )
                agg_stats["scanned"] += scanned
                _acc(st)
                wiki_pool = _merge_unique(wiki_pool, items)
                if len(wiki_pool) >= target_limit or scanned < 40:
                    break
            if len(wiki_pool) >= target_limit:
                break
            if idx < len(translation.canonical_queries) - 1:
                extra_warnings.append(
                    f"Fallback automático en Wikimedia tras '{cq}' ({len(wiki_pool)}/{target_limit})."
                )

        # Combinar con Wellcome Collection CC0 / PDM (fallback a CC BY si CC0 puro da 0)
        wellcome_pool: list[CuratedImage] = []
        wellcome_target = min(15, max(8, target_limit // 3))
        for wq in _short_archival_variants(translation.canonical_queries):
            w_items, w_scanned, w_st = await _fetch_wellcome_images(
                client, wq, license_filter="pdm,cc0", page_size=25
            )
            agg_stats["scanned"] += w_scanned
            _acc(w_st)
            if w_items:
                if wq not in queries_used:
                    queries_used.append(wq)
                wellcome_pool = _merge_unique(wellcome_pool, w_items)
            if len(wellcome_pool) >= wellcome_target:
                break

        if not wellcome_pool:
            for wq in _short_archival_variants(translation.canonical_queries)[:3]:
                w_items, w_scanned, w_st = await _fetch_wellcome_images(
                    client, wq, license_filter="pdm,cc0,cc-by", page_size=25
                )
                agg_stats["scanned"] += w_scanned
                _acc(w_st)
                if w_items:
                    wellcome_pool = _merge_unique(wellcome_pool, w_items)
                    break

        # Reserva cupo visible de Wellcome CC0/PDM si encontró láminas y mezcla por score.
        reserved_wellcome = wellcome_pool[:wellcome_target]
        remaining_slots = max(0, target_limit - len(reserved_wellcome))
        merged = _merge_unique(reserved_wellcome, wiki_pool[:remaining_slots] if remaining_slots else [])
        if len(merged) < target_limit:
            merged = _merge_unique(merged, wiki_pool)
        pool = merged

    elif request.mode in {"hero", "remotion"}:
        # Paso 1: paisaje estricto >= 1800px
        for idx, cq in enumerate(translation.canonical_queries):
            queries_used.append(cq)
            items, scanned, st = await _fetch_wikimedia_page(
                client,
                cq,
                offset=0,
                min_max_dim=1800,
                min_short_dim=900,
                allow_maps_diagrams=False,
                min_aspect_ratio=1.25,
                prefer_landscape=True,
            )
            agg_stats["scanned"] += scanned
            _acc(st)
            pool = _merge_unique(pool, items)
            if len(pool) >= target_limit:
                break
            if idx < len(translation.canonical_queries) - 1:
                extra_warnings.append(f"Fallback Hero >=1800px tras '{cq}'.")

        # Paso 2: fallback a >= 1200px si no alcanzó
        if len(pool) < target_limit:
            extra_warnings.append("Fallback automático de resolución Hero: ampliando umbral a >= 1200px landscape.")
            for cq in translation.canonical_queries:
                items, scanned, st = await _fetch_wikimedia_page(
                    client,
                    cq,
                    offset=0,
                    min_max_dim=1200,
                    min_short_dim=650,
                    allow_maps_diagrams=False,
                    min_aspect_ratio=1.25,
                    prefer_landscape=True,
                )
                agg_stats["scanned"] += scanned
                _acc(st)
                pool = _merge_unique(pool, items)
                if len(pool) >= target_limit:
                    break

    elif request.mode == "medieval":
        for wq in _short_archival_variants(translation.canonical_queries):
            queries_used.append(wq)
            w_items, w_scanned, w_st = await _fetch_wellcome_images(
                client, wq, license_filter="pdm,cc0,cc-by", page_size=50
            )
            agg_stats["scanned"] += w_scanned
            _acc(w_st)
            pool = _merge_unique(pool, w_items)
            if len(pool) >= target_limit:
                break

    final_images = pool[:target_limit]

    remotion_payload: RemotionPayload | None = None
    if request.mode == "remotion":
        slides = [
            RemotionSlide(
                index=i + 1,
                title=img.title,
                image_url=img.original_url,
                thumb_url=img.thumb_url,
                effect="zoom-in-slow" if i % 2 == 0 else "pan-left-right",
                duration_frames=150,
                attribution_text=img.attribution_text,
            )
            for i, img in enumerate(final_images)
        ]
        remotion_payload = RemotionPayload(
            fps=30,
            width=1920,
            height=1080,
            total_frames=len(slides) * 150,
            slides=slides,
            render_command="npx remotion render src/index.ts TgpMegalithReel out/reel.mp4 --props=./remotion_props.json",
        )

    return CurateResponse(
        query=request.query,
        editorial_line=request.editorial_line,
        mode=request.mode,
        site_id=site_id,
        canonical_queries=translation.canonical_queries,
        queries_used=queries_used,
        context_note=translation.context_note,
        model_used=model_used,
        commercial_filter_applied=True,
        total_scanned=agg_stats["scanned"],
        total_returned=len(final_images),
        warnings=_format_warnings(agg_stats, extra_warnings),
        images=final_images,
        remotion_payload=remotion_payload,
    )
