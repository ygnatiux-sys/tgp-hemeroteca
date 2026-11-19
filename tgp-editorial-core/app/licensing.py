"""Filtro comercial estricto y sanitización de metadatos de archivo.

Política legal TGP (ebooks comerciales / revistas):
- PERMITIDO únicamente: Public Domain (PD, PDM, PD-*), CC0 / CC-0 y CC BY (atribución simple).
- RECHAZADO siempre: cualquier variante ShareAlike (CC BY-SA, SA), NonCommercial (NC),
  NoDerivatives (ND), GFDL, Fair Use, In Copyright (InC), All Rights Reserved,
  NonFree=true o restricciones de personalidad/marca.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from typing import Optional

_SCRIPT_STYLE_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")

_NON_FREE_VALUES = {"true", "yes", "1", "non-free", "nonfree"}

_RESTRICTIONS_BLOCK_RE = re.compile(
    r"\b(?:copyright|non[- ]?commercial|fair\s+use|all\s+rights\s+reserved|"
    r"permission\s+required|personality|trademark(?:ed)?)\b",
    re.IGNORECASE,
)

# Se evalúa SIEMPRE antes que la allowlist para evitar falsos positivos en cadenas mixtas.
_FORBIDDEN_LICENSE_RE = re.compile(
    r"(?:"
    r"\b(?:cc[-_\s]*)?by[-_\s]*sa\b"
    r"|\bshare[-_\s]*alike\b"
    r"|\bsa\b"
    r"|(?:-|_)sa\b"
    r"|\b(?:cc[-_\s]*)?by[-_\s]*nc\b"
    r"|\bnon[-_\s]*commercial\b"
    r"|\bnc\b"
    r"|(?:-|_)nc\b"
    r"|\b(?:cc[-_\s]*)?by[-_\s]*nd\b"
    r"|\bno[-_\s]*deriv(?:ative)?s?\b"
    r"|\bnd\b"
    r"|(?:-|_)nd\b"
    r"|\bgfdl\b"
    r"|\bgnu\s+free\b"
    r"|\bfair\s+use\b"
    r"|\ball\s+rights\s+reserved\b"
    r"|\bin\s+copyright\b"
    r"|\bcopyrighted\b"
    r"|\bcne\b"
    r"|\bunk\b"
    r"|\barr\b"
    r"|\bfal\b"
    r"|\bfree\s+art\b"
    r")",
    re.IGNORECASE,
)

_FORBIDDEN_EXACT_TOKENS = {"inc", "in-copyright", "in copyright"}

_WELLCOME_PD_CC0_IDS = {"pdm", "cc0", "cc-0", "pd"}
_WELLCOME_CC_BY_IDS = {"cc-by", "cc-by-4.0", "cc-by-3.0", "cc-by-2.5", "cc-by-2.0", "cc-by-1.0"}

_PD_CC0_ALLOW_RE = re.compile(
    r"(?:"
    r"\bpublic\s+domain\b"
    r"|\bpdm(?:\s+1\.0)?\b"
    r"|\bcc0(?:\s+1\.0)?\b"
    r"|\bcc-0\b"
    r"|\bno\s+(?:known\s+copyright\s+)?restrictions\b"
    r"|^pd(?:$|[-_\s/].*)"
    r")",
    re.IGNORECASE,
)

_CC_BY_ALLOW_RE = re.compile(
    r"(?:"
    r"^cc[-_\s]?by(?:\s*\d+(?:\.\d+)?)?(?:[-_\s][a-z0-9.]+)*$"
    r"|\bcreative\s+commons\s+attribution\b"
    r"|\battribution\s+\d+(?:\.\d+)?\s+(?:unported|generic|international)\b"
    r"|\(cc[-_\s]?by(?:\s*\d+(?:\.\d+)?)?\)"
    r")",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class LicenseEvaluation:
    normalized: str
    is_commercially_safe: bool
    is_pd_or_cc0: bool
    attribution_required: bool
    rejection_reason: Optional[str] = None


def strip_html(raw: object) -> str:
    """Elimina HTML/scripts, decodifica entidades y colapsa espacios."""
    if raw is None:
        return ""
    text = str(raw)
    if not text:
        return ""
    text = _SCRIPT_STYLE_RE.sub(" ", text)
    text = _HTML_TAG_RE.sub(" ", text)
    text = html.unescape(text)
    return _WHITESPACE_RE.sub(" ", text).strip()


def evaluate_license(
    license_short: str = "",
    usage_terms: str = "",
    restrictions: str = "",
    non_free: str = "",
    wellcome_license_id: str = "",
) -> LicenseEvaluation:
    """Evalúa estrictamente si una lámina es apta para uso comercial sin riesgo copyleft."""
    short_clean = strip_html(license_short)
    terms_clean = strip_html(usage_terms)
    restr_clean = strip_html(restrictions)
    non_free_clean = strip_html(non_free).lower()
    wid = strip_html(wellcome_license_id).lower()

    if non_free_clean in _NON_FREE_VALUES:
        return LicenseEvaluation(
            normalized=short_clean or "Non-Free",
            is_commercially_safe=False,
            is_pd_or_cc0=False,
            attribution_required=True,
            rejection_reason="non_free_metadata",
        )

    if restr_clean and _RESTRICTIONS_BLOCK_RE.search(restr_clean):
        return LicenseEvaluation(
            normalized=short_clean or "Restricted",
            is_commercially_safe=False,
            is_pd_or_cc0=False,
            attribution_required=True,
            rejection_reason="restrictive_metadata",
        )

    combined = " ".join(p for p in (wid, short_clean, terms_clean) if p)
    if (
        wid in _FORBIDDEN_EXACT_TOKENS
        or short_clean.lower() in _FORBIDDEN_EXACT_TOKENS
        or (combined and _FORBIDDEN_LICENSE_RE.search(combined))
    ):
        return LicenseEvaluation(
            normalized=short_clean or wellcome_license_id or "Restricted",
            is_commercially_safe=False,
            is_pd_or_cc0=False,
            attribution_required=True,
            rejection_reason="forbidden_license_clause",
        )

    # Chequeo específico de Wellcome Collection ID
    if wid:
        if wid in _WELLCOME_PD_CC0_IDS:
            label = short_clean or ("CC0" if "cc" in wid else "Public Domain Mark")
            return LicenseEvaluation(
                normalized=label,
                is_commercially_safe=True,
                is_pd_or_cc0=True,
                attribution_required=False,
            )
        if wid in _WELLCOME_CC_BY_IDS:
            label = short_clean or "CC BY 4.0"
            return LicenseEvaluation(
                normalized=label,
                is_commercially_safe=True,
                is_pd_or_cc0=False,
                attribution_required=True,
            )
        return LicenseEvaluation(
            normalized=short_clean or wid,
            is_commercially_safe=False,
            is_pd_or_cc0=False,
            attribution_required=True,
            rejection_reason="wellcome_license_not_allowed",
        )

    if not short_clean and not terms_clean:
        return LicenseEvaluation(
            normalized="Unknown",
            is_commercially_safe=False,
            is_pd_or_cc0=False,
            attribution_required=True,
            rejection_reason="missing_license_metadata",
        )

    for candidate in (short_clean, terms_clean):
        if candidate and _PD_CC0_ALLOW_RE.search(candidate):
            normalized = short_clean or ("CC0" if "cc0" in candidate.lower() else "Public domain")
            return LicenseEvaluation(
                normalized=normalized,
                is_commercially_safe=True,
                is_pd_or_cc0=True,
                attribution_required=False,
            )

    for candidate in (short_clean, terms_clean):
        if candidate and _CC_BY_ALLOW_RE.search(candidate):
            return LicenseEvaluation(
                normalized=short_clean or "CC BY",
                is_commercially_safe=True,
                is_pd_or_cc0=False,
                attribution_required=True,
            )

    return LicenseEvaluation(
        normalized=short_clean or "Unverified",
        is_commercially_safe=False,
        is_pd_or_cc0=False,
        attribution_required=True,
        rejection_reason="not_in_commercial_allowlist",
    )


def format_attribution(title: str, author: str, license_name: str, source_repo: str) -> str:
    """Devuelve texto limpio listo para pie de lámina o colofón (Typst / Pandoc)."""
    safe_title = strip_html(title) or "Sin título"
    safe_author = strip_html(author) or "Archivo Patrimonial"
    safe_license = strip_html(license_name) or "Public domain"
    repo_label = "Wellcome Collection" if source_repo == "wellcome" else "Wikimedia Commons"
    return f"{safe_title} — {safe_author} ({safe_license} · {repo_label})"
