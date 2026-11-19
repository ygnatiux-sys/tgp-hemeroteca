"""Tests unitarios del filtro comercial estricto y sanitización."""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.licensing import evaluate_license, format_attribution, strip_html


class TestStripHtml(unittest.TestCase):
    def test_removes_tags_scripts_and_entities(self) -> None:
        raw = '<p>Foto de <b>Juan &amp; Mar&iacute;a</b><script>alert(1)</script>  en <i>Cusco</i></p>'
        self.assertEqual(strip_html(raw), "Foto de Juan & María en Cusco")

    def test_handles_none_and_empty(self) -> None:
        self.assertEqual(strip_html(None), "")
        self.assertEqual(strip_html("   "), "")


class TestCommercialLicensing(unittest.TestCase):
    def test_allows_public_domain_and_cc0_variants(self) -> None:
        allowed_cases = [
            ("Public domain", "Public domain"),
            ("PD-old-100", "This work is in the public domain in its country of origin."),
            ("PD-USGov-NASA", "Public domain"),
            ("PDM 1.0", "Public Domain Mark 1.0"),
            ("CC0", "Creative Commons Zero, Public Domain Dedication"),
            ("CC0 1.0", "CC0 1.0 Universal"),
            ("No restrictions", "No known copyright restrictions"),
        ]
        for short, terms in allowed_cases:
            with self.subTest(short=short):
                res = evaluate_license(license_short=short, usage_terms=terms)
                self.assertTrue(res.is_commercially_safe, f"Debe permitir {short}")
                self.assertTrue(res.is_pd_or_cc0, f"Debe marcar PD/CC0 {short}")
                self.assertFalse(res.attribution_required)

    def test_allows_cc_by_simple_attribution_only(self) -> None:
        allowed_cc_by = [
            ("CC BY 4.0", "Creative Commons Attribution 4.0 International"),
            ("CC BY 3.0", "Creative Commons Attribution 3.0 Unported"),
            ("CC-BY-2.0", "Attribution 2.0 Generic (CC BY 2.0)"),
            ("CC BY 3.0 IGO", "Creative Commons Attribution 3.0 IGO"),
            ("CC BY 2.5 de", "Attribution 2.5 Germany"),
        ]
        for short, terms in allowed_cc_by:
            with self.subTest(short=short):
                res = evaluate_license(license_short=short, usage_terms=terms)
                self.assertTrue(res.is_commercially_safe, f"Debe permitir {short}")
                self.assertFalse(res.is_pd_or_cc0)
                self.assertTrue(res.attribution_required)

    def test_rejects_sharealike_nc_nd_and_copyleft(self) -> None:
        forbidden_cases = [
            ("CC BY-SA 4.0", "Creative Commons Attribution-ShareAlike 4.0 International"),
            ("CC BY-SA 3.0", "Attribution-Share Alike 3.0 Unported"),
            ("CC-BY-SA-2.5", "ShareAlike"),
            ("CC BY-NC 4.0", "Creative Commons Attribution-NonCommercial 4.0"),
            ("CC BY-NC-SA 4.0", "NonCommercial-ShareAlike"),
            ("CC BY-ND 4.0", "NoDerivatives"),
            ("CC BY-NC-ND 4.0", "Attribution-NonCommercial-NoDerivatives"),
            ("CC-SA-1.0", "ShareAlike"),
            ("GFDL", "GNU Free Documentation License"),
            ("Fair use", "Fair use rationale"),
            ("All rights reserved", "Copyrighted work"),
            ("In copyright", "In copyright"),
            ("FAL", "Free Art License"),
            # Caso tramposo: mezcla Public domain con CC BY-SA en usage_terms
            ("Public domain", "Public domain or CC BY-SA 4.0"),
            # Sin metadatos
            ("", ""),
        ]
        for short, terms in forbidden_cases:
            with self.subTest(short=short, terms=terms):
                res = evaluate_license(license_short=short, usage_terms=terms)
                self.assertFalse(res.is_commercially_safe, f"Debe RECHAZAR {short} / {terms}")
                self.assertIsNotNone(res.rejection_reason)

    def test_rejects_nonfree_and_restrictive_flags(self) -> None:
        res_nf = evaluate_license(license_short="Public domain", non_free="true")
        self.assertFalse(res_nf.is_commercially_safe)
        self.assertEqual(res_nf.rejection_reason, "non_free_metadata")

        res_rest = evaluate_license(
            license_short="CC BY 4.0",
            restrictions="Trademarked architectural monument; permission required",
        )
        self.assertFalse(res_rest.is_commercially_safe)
        self.assertEqual(res_rest.rejection_reason, "restrictive_metadata")

    def test_wellcome_license_ids(self) -> None:
        self.assertTrue(
            evaluate_license(license_short="Public Domain Mark", wellcome_license_id="pdm").is_commercially_safe
        )
        self.assertTrue(
            evaluate_license(license_short="CC0", wellcome_license_id="cc0").is_commercially_safe
        )
        self.assertTrue(
            evaluate_license(license_short="Attribution 4.0 International (CC BY 4.0)", wellcome_license_id="cc-by").is_commercially_safe
        )
        for bad_id in ("inc", "cc-by-sa", "cc-by-nc", "cc-by-nd", "cc-by-nc-sa", "cne", "unk"):
            with self.subTest(bad_id=bad_id):
                res = evaluate_license(license_short="Wellcome", wellcome_license_id=bad_id)
                self.assertFalse(res.is_commercially_safe, f"Debe rechazar wellcome id {bad_id}")

    def test_format_attribution(self) -> None:
        text = format_attribution("Papiro de <b>Ipuwer</b>", "Museo de Leiden", "Public domain", "wikimedia")
        self.assertEqual(text, "Papiro de Ipuwer — Museo de Leiden (Public domain · Wikimedia Commons)")


if __name__ == "__main__":
    unittest.main()
