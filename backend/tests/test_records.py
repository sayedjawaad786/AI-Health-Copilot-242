"""
tests/test_records.py - FastAPI TestClient tests for the records router.

Gemini service is monkeypatched / settings overridden so tests run without
a real API key and without hitting the live Gemini service.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock

from app.main import app
from app.schemas.health import (
    HealthRecordBundle,
    HealthSummary,
    SupportedLanguage,
)
from app.services.disclaimers import get_disclaimer
from app.routers.records import _build_sample_bundle

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sample_bundle_dict(language: str = "en") -> dict:
    """Build a sample bundle as a dict suitable for JSON POST bodies."""
    lang = SupportedLanguage(language)
    bundle = _build_sample_bundle(language=lang)
    return bundle.model_dump(mode="json")


def _mock_summary(language: SupportedLanguage) -> HealthSummary:
    return HealthSummary(
        language=language,
        overview=f"Mock overview in {language.value}",
        key_findings=["finding 1"],
        abnormal_findings_explained=["finding explained 1"],
        questions_for_doctor=["Q1"],
        lifestyle_notes=["note 1"],
        disclaimer=get_disclaimer(language),
    )


# ---------------------------------------------------------------------------
# Context manager: force no-API-key path in the translate endpoint
# ---------------------------------------------------------------------------

def _no_api_key():
    """Patch settings so the translate endpoint uses the fallback path."""
    import app.routers.records as records_module
    fake = MagicMock()
    fake.gemini_api_key = ""
    return patch.object(records_module, "settings", fake)


# ---------------------------------------------------------------------------
# GET /api/records/sample
# ---------------------------------------------------------------------------


class TestSampleEndpoint:
    def test_sample_default_language(self):
        resp = client.get("/api/records/sample")
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["language"] == "en"
        assert "bundle_id" in data

    def test_sample_hindi(self):
        resp = client.get("/api/records/sample", params={"language": "hi"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["language"] == "hi"
        assert data["summary"]["disclaimer"] == get_disclaimer(SupportedLanguage.hi)

    def test_sample_telugu(self):
        resp = client.get("/api/records/sample", params={"language": "te"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["language"] == "te"
        assert data["summary"]["disclaimer"] == get_disclaimer(SupportedLanguage.te)

    def test_sample_tamil(self):
        resp = client.get("/api/records/sample", params={"language": "ta"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["language"] == "ta"
        assert data["summary"]["disclaimer"] == get_disclaimer(SupportedLanguage.ta)

    def test_sample_invalid_language_422(self):
        """FastAPI/Pydantic rejects an unknown language code with 422."""
        resp = client.get("/api/records/sample", params={"language": "xx"})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/records/translate — stateless (no cache dependency)
# All tests patch settings so gemini_api_key is empty → fallback path used.
# ---------------------------------------------------------------------------


class TestTranslateEndpoint:
    """
    All translate tests force the no-API-key fallback path by patching
    app.routers.records.settings so gemini_api_key is empty.
    This ensures tests are deterministic and don't hit live Gemini.
    """

    def test_translate_unknown_bundle_id_returns_200(self):
        """
        A bundle with a random / 'unknown' bundle_id must still return 200.
        This is the core regression test for the original 404 bug.
        """
        with _no_api_key():
            bundle = _sample_bundle_dict("en")
            # Replace the bundle_id with a random unknown UUID
            bundle["bundle_id"] = "00000000-0000-0000-0000-000000000000"
            resp = client.post(
                "/api/records/translate",
                json={"bundle": bundle, "language": "hi"},
            )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["language"] == "hi"

    def test_translate_en(self):
        with _no_api_key():
            bundle = _sample_bundle_dict("en")
            resp = client.post(
                "/api/records/translate",
                json={"bundle": bundle, "language": "en"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["language"] == "en"
        assert data["summary"]["disclaimer"] == get_disclaimer(SupportedLanguage.en)

    def test_translate_hi(self):
        with _no_api_key():
            bundle = _sample_bundle_dict("en")
            resp = client.post(
                "/api/records/translate",
                json={"bundle": bundle, "language": "hi"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["language"] == "hi"
        assert data["summary"]["disclaimer"] == get_disclaimer(SupportedLanguage.hi)

    def test_translate_te(self):
        with _no_api_key():
            bundle = _sample_bundle_dict("en")
            resp = client.post(
                "/api/records/translate",
                json={"bundle": bundle, "language": "te"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["language"] == "te"
        assert data["summary"]["disclaimer"] == get_disclaimer(SupportedLanguage.te)

    def test_translate_ta(self):
        with _no_api_key():
            bundle = _sample_bundle_dict("en")
            resp = client.post(
                "/api/records/translate",
                json={"bundle": bundle, "language": "ta"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["language"] == "ta"
        assert data["summary"]["disclaimer"] == get_disclaimer(SupportedLanguage.ta)

    def test_translate_invalid_language_422(self):
        with _no_api_key():
            bundle = _sample_bundle_dict("en")
            resp = client.post(
                "/api/records/translate",
                json={"bundle": bundle, "language": "xx"},
            )
        assert resp.status_code == 422

    def test_translate_missing_bundle_422(self):
        """Missing bundle field returns 422."""
        with _no_api_key():
            resp = client.post(
                "/api/records/translate",
                json={"language": "hi"},
            )
        assert resp.status_code == 422

    def test_translate_with_live_gemini_monkeypatched(self):
        """
        With Gemini service mocked at the service layer, translate returns
        the mocked summary with correct language + server-side disclaimer.
        The key insight: we patch settings to have a key (so the live path runs)
        AND mock get_extractor inside gemini_service so no real API call is made.
        """
        import app.routers.records as records_module
        import app.services.gemini_service as gemini_module

        async def _fake_summarize(extraction, language):
            return _mock_summary(language)

        fake_settings = MagicMock()
        fake_settings.gemini_api_key = "fake-key-for-test"

        mock_extractor = MagicMock()
        mock_extractor.summarize = _fake_summarize

        with (
            patch.object(records_module, "settings", fake_settings),
            patch.object(gemini_module, "_extractor_instance", mock_extractor),
        ):
            bundle = _sample_bundle_dict("en")
            resp = client.post(
                "/api/records/translate",
                json={"bundle": bundle, "language": "hi"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["language"] == "hi"
        # Disclaimer must be the server-side approved text
        assert data["summary"]["disclaimer"] == get_disclaimer(SupportedLanguage.hi)

    def test_translate_response_has_only_summary_field(self):
        """Response model only contains 'summary', not the full bundle."""
        with _no_api_key():
            bundle = _sample_bundle_dict("en")
            resp = client.post(
                "/api/records/translate",
                json={"bundle": bundle, "language": "hi"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "summary" in data
        # Must NOT contain top-level bundle fields
        assert "bundle_id" not in data
        assert "patient" not in data
        assert "medications" not in data

    def test_translate_disclaimer_overwritten_server_side(self):
        """The disclaimer in the response must match the server-side string."""
        for lang_code in ["en", "hi", "te", "ta"]:
            lang = SupportedLanguage(lang_code)
            with _no_api_key():
                bundle = _sample_bundle_dict("en")
                resp = client.post(
                    "/api/records/translate",
                    json={"bundle": bundle, "language": lang_code},
                )
            assert resp.status_code == 200, f"Failed for {lang_code}: {resp.text}"
            data = resp.json()
            assert data["summary"]["disclaimer"] == get_disclaimer(lang), (
                f"Wrong disclaimer for {lang_code}"
            )
