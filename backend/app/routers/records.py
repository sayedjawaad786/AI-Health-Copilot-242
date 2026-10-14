"""
routers/records.py - Health record analysis endpoints.

Endpoints:
  POST /api/records/analyze    Upload a health document; run Gemini extraction +
                               timeline build + summarization; return HealthRecordBundle.
  POST /api/records/translate  Re-run summarization on a previously analyzed bundle
                               in a different language without re-uploading the file.
  GET  /api/records/sample     Return a hardcoded demo bundle (no API key required).

In-memory cache
---------------
_extraction_cache maps bundle_id -> ExtractionResult for the translate endpoint.
HACKATHON-ONLY: this is process-local, not shared across workers, and unbounded.
Replace with Redis or a DB-backed store for production.
"""

# (no __future__ annotations import — Pydantic v2 needs eager type resolution)

import logging
from datetime import date, datetime, timezone
from typing import Dict

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import get_settings
from app.schemas.health import (
    AbhaProfile,
    Diagnosis,
    DocumentMeta,
    ExtractionResult,
    HealthRecordBundle,
    HealthSummary,
    LabObservation,
    Medication,
    Severity,
    SupportedLanguage,
    TimelineEvent,
    generate_mock_abha,
)
from app.services.timeline import build_timeline

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/records", tags=["Records"])

# ---------------------------------------------------------------------------
# HACKATHON-ONLY in-memory caches (process-local, unbounded).
# Replace with Redis / database for any production deployment.
# ---------------------------------------------------------------------------
_extraction_cache: Dict[str, ExtractionResult] = {}
_bundle_cache: Dict[str, HealthRecordBundle] = {}  # for FHIR export

# ---------------------------------------------------------------------------
# Request/response models for the translate endpoint
# ---------------------------------------------------------------------------


class TranslateRequest(BaseModel):
    """Request body for POST /api/records/translate."""

    bundle_id: str = Field(description="bundle_id from a previous /analyze response.")
    language: SupportedLanguage = Field(
        default=SupportedLanguage.en,
        description="Target language for the new summary.",
    )


# ---------------------------------------------------------------------------
# MIME type inference helper
# ---------------------------------------------------------------------------

_CONTENT_TYPE_MAP: dict[str, str] = {
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
    "application/pdf": "application/pdf",
}


def _resolve_mime(content_type: str | None) -> str:
    """
    Normalise the Content-Type header to an accepted MIME type string.
    Returns the raw header value if not in the map (validation happens in extract()).
    """
    if not content_type:
        return "application/octet-stream"
    # Strip parameters like '; charset=utf-8'
    base = content_type.split(";")[0].strip().lower()
    return _CONTENT_TYPE_MAP.get(base, base)


# ---------------------------------------------------------------------------
# Pipeline assembler
# ---------------------------------------------------------------------------


def _assemble_bundle(
    extraction: ExtractionResult,
    summary: HealthSummary,
    bundle_id: str | None = None,
) -> HealthRecordBundle:
    """
    Build a HealthRecordBundle from an ExtractionResult and a HealthSummary.

    - ABHA profile is always a generated mock (never real patient identifiers).
    - Timeline is built by the pure build_timeline() function.
    """
    patient_name = extraction.patient_name or "Demo Patient"
    patient = generate_mock_abha(patient_name)
    # Patch in extracted demographics (AbhaProfile is not frozen)
    if extraction.patient_gender:
        patient = AbhaProfile(
            abha_number=patient.abha_number,
            abha_address=patient.abha_address,
            name=patient.name,
            gender=extraction.patient_gender,
            year_of_birth=extraction.patient_year_of_birth,
            is_mock=True,
        )

    timeline = build_timeline(extraction)

    kwargs = dict(
        patient=patient,
        document=extraction.document,
        medications=extraction.medications,
        observations=extraction.observations,
        diagnoses=extraction.diagnoses,
        timeline=timeline,
        summary=summary,
        created_at=datetime.now(timezone.utc),
    )
    if bundle_id:
        kwargs["bundle_id"] = bundle_id

    return HealthRecordBundle(**kwargs)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/analyze",
    response_model=HealthRecordBundle,
    summary="Analyse a health document",
    description=(
        "Upload a health document (JPEG, PNG, WebP image or PDF) and receive a "
        "structured HealthRecordBundle with AI-extracted medications, lab results, "
        "diagnoses, a patient timeline, and a patient-friendly summary in the "
        "requested language. Falls back to a hardcoded sample when GEMINI_API_KEY "
        "is not configured."
    ),
)
async def analyze_record(
    file: UploadFile = File(..., description="Health document (JPEG/PNG/WebP/PDF)."),
    language: SupportedLanguage = Form(
        default=SupportedLanguage.en,
        description="Language for the patient-facing summary (en/hi/te/ta).",
    ),
) -> HealthRecordBundle:
    """
    Full pipeline:
      1. Read and validate the uploaded file (size + MIME type).
      2. Extract structured data via Gemini.
      3. Build mock ABHA profile and timeline.
      4. Generate patient-facing summary via Gemini.
      5. Cache ExtractionResult for later /translate calls.
      6. Return HealthRecordBundle.
    """
    # ---- Fallback when no API key is configured ----------------------------
    if not settings.gemini_api_key:
        logger.warning(
            "GEMINI_API_KEY is not set; returning hardcoded sample for /analyze."
        )
        return _build_sample_bundle(language=language)

    # ---- Lazy import to avoid loading genai when key is absent -------------
    from app.services.gemini_service import get_extractor  # noqa: PLC0415

    file_bytes = await file.read()
    mime_type = _resolve_mime(file.content_type)

    extractor = get_extractor()

    # ---- Extraction --------------------------------------------------------
    extraction = await extractor.extract(file_bytes, mime_type)

    # ---- Summarization -----------------------------------------------------
    summary = await extractor.summarize(extraction, language)

    # ---- Assemble bundle ---------------------------------------------------
    bundle = _assemble_bundle(extraction, summary)

    # ---- Cache extraction + bundle for translate / FHIR endpoints ----------
    # HACKATHON-ONLY: process-local, unbounded dict. Replace with Redis for prod.
    _extraction_cache[bundle.bundle_id] = extraction
    _bundle_cache[bundle.bundle_id] = bundle
    logger.info(
        "Cached bundle_id=%s (extraction_cache=%d, bundle_cache=%d)",
        bundle.bundle_id,
        len(_extraction_cache),
        len(_bundle_cache),
    )

    return bundle


@router.post(
    "/translate",
    response_model=HealthRecordBundle,
    summary="Translate a bundle summary to a different language",
    description=(
        "Re-run only the summarization step for a previously analyzed bundle. "
        "The extraction result is retrieved from the in-memory cache using the "
        "bundle_id; no file re-upload is needed. "
        "NOTE: the cache is process-local and cleared on server restart."
    ),
)
async def translate_record(body: TranslateRequest) -> HealthRecordBundle:
    """
    Translate the summary of a previously analyzed bundle to a new language.

    Requires that the bundle_id is still present in the in-process cache
    (i.e., was analyzed during the same server session).
    """
    extraction = _extraction_cache.get(body.bundle_id)
    if extraction is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Bundle '{body.bundle_id}' not found in cache. "
                "Please re-upload the document to re-analyze it."
            ),
        )

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured. Translation is unavailable.",
        )

    from app.services.gemini_service import get_extractor  # noqa: PLC0415

    extractor = get_extractor()
    summary = await extractor.summarize(extraction, body.language)

    # Re-assemble with the same bundle_id so the client can correlate
    bundle = _assemble_bundle(extraction, summary, bundle_id=body.bundle_id)
    _bundle_cache[bundle.bundle_id] = bundle
    return bundle


@router.get(
    "/sample",
    response_model=HealthRecordBundle,
    summary="Return the sample health record bundle",
    description=(
        "Returns a hardcoded demo bundle for frontend development. "
        "Works without a GEMINI_API_KEY. Includes 2 medications, "
        "3 lab results (normal / abnormal / critical), 1 diagnosis, "
        "and a full populated summary."
    ),
)
async def get_sample_record(
    language: SupportedLanguage = SupportedLanguage.en,
) -> HealthRecordBundle:
    """Return a sample HealthRecordBundle for frontend development."""
    bundle = _build_sample_bundle(language=language)
    _bundle_cache[bundle.bundle_id] = bundle
    return bundle


@router.get(
    "/{bundle_id}/fhir",
    summary="Export a bundle as a FHIR-style document",
    description=(
        "Returns a FHIR-style Bundle representation of a previously analysed "
        "health record. NOTE: not fully FHIR R4 compliant — for demo use only. "
        "Requires the bundle to still be present in the in-memory cache."
    ),
)
async def get_fhir_bundle(bundle_id: str) -> dict:
    """
    Return the to_fhir_like_dict() representation of a cached bundle.

    Raises HTTP 404 if the bundle_id is not in the in-memory cache
    (e.g. server was restarted or bundle was never created in this session).
    """
    bundle = _bundle_cache.get(bundle_id)
    if bundle is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Bundle '{bundle_id}' not found in cache. "
                "Please re-load or re-analyze the document to refresh the cache."
            ),
        )
    return bundle.to_fhir_like_dict()


# ---------------------------------------------------------------------------
# Hardcoded sample bundle (fallback + demo)
# ---------------------------------------------------------------------------


def _build_sample_bundle(language: SupportedLanguage = SupportedLanguage.en) -> HealthRecordBundle:
    """
    Build a rich, hardcoded sample HealthRecordBundle.

    Used by:
      - GET /api/records/sample  (always)
      - POST /api/records/analyze when GEMINI_API_KEY is not configured
    """
    patient = generate_mock_abha("Priya Sharma")
    # Patch demographics directly since AbhaProfile fields are not frozen
    patient = AbhaProfile(
        abha_number=patient.abha_number,
        abha_address=patient.abha_address,
        name=patient.name,
        gender="female",
        year_of_birth=1988,
        is_mock=True,
    )

    document = DocumentMeta(
        document_type="lab_report",
        document_date=date(2024, 10, 5),
        provider_name="Dr. Ramesh Iyer",
        facility_name="Apollo Diagnostics, Hyderabad",
        detected_languages=["en"],
        is_handwritten=False,
        ocr_confidence="high",
    )

    medications = [
        Medication(
            name="Metformin 500 mg",
            generic_name="metformin hydrochloride",
            dosage="500 mg",
            frequency="twice daily",
            route="oral",
            duration="3 months",
            instructions="Take with or immediately after meals to reduce stomach upset.",
            plain_language_explanation=(
                "Metformin helps lower blood sugar by reducing the amount of glucose "
                "your liver releases and making your body more sensitive to insulin. "
                "It is a first-line treatment for type 2 diabetes."
            ),
        ),
        Medication(
            name="Atorvastatin 10 mg",
            generic_name="atorvastatin",
            dosage="10 mg",
            frequency="once daily at bedtime",
            route="oral",
            duration="ongoing",
            instructions="Avoid grapefruit juice while taking this medication.",
            plain_language_explanation=(
                "Atorvastatin is a statin that lowers LDL ('bad') cholesterol and "
                "triglycerides, reducing your risk of heart disease and stroke."
            ),
        ),
    ]

    observations = [
        LabObservation(
            test_name="HbA1c (Glycated Haemoglobin)",
            value=8.4,
            unit="%",
            reference_range="Below 5.7% (normal); 5.7-6.4% (prediabetes); >=6.5% (diabetes)",
            reference_low=None,
            reference_high=5.6,
            severity=Severity.abnormal,
            interpretation=(
                "Your HbA1c of 8.4% indicates that your average blood sugar over the "
                "past 2-3 months has been significantly above the normal range. "
                "This suggests that your diabetes is not yet well-controlled and your "
                "doctor may adjust your treatment plan."
            ),
            observed_date=date(2024, 10, 5),
            loinc_code="4548-4",
        ),
        LabObservation(
            test_name="Serum Creatinine",
            value=2.8,
            unit="mg/dL",
            reference_range="0.6-1.2 mg/dL",
            reference_low=0.6,
            reference_high=1.2,
            severity=Severity.critical,
            interpretation=(
                "Your creatinine level of 2.8 mg/dL is more than twice the upper "
                "limit of normal. Creatinine is a waste product filtered by the "
                "kidneys - a high value means your kidneys may not be filtering "
                "blood efficiently. This requires urgent follow-up with your doctor."
            ),
            observed_date=date(2024, 10, 5),
            loinc_code="2160-0",
        ),
        LabObservation(
            test_name="Serum Total Cholesterol",
            value=178.0,
            unit="mg/dL",
            reference_range="Below 200 mg/dL (desirable)",
            reference_low=None,
            reference_high=200.0,
            severity=Severity.normal,
            interpretation=(
                "Your total cholesterol is within the desirable range. "
                "Continue your current diet and statin therapy."
            ),
            observed_date=date(2024, 10, 5),
            loinc_code="2093-3",
        ),
    ]

    diagnoses = [
        Diagnosis(
            name="Type 2 Diabetes Mellitus",
            icd10_code="E11.9",
            status="active",
            noted_date=date(2022, 3, 14),
            plain_language_explanation=(
                "Type 2 diabetes means your body does not use insulin properly, "
                "causing blood sugar to rise above safe levels. It is managed with "
                "lifestyle changes, oral medications (like metformin), and regular "
                "monitoring. Long-term high blood sugar can affect the kidneys, eyes, "
                "nerves, and heart, so consistent management is very important."
            ),
        )
    ]

    # Build timeline from a synthetic ExtractionResult using the shared function
    _synthetic_extraction = ExtractionResult(
        document=document,
        medications=medications,
        observations=observations,
        diagnoses=diagnoses,
        patient_name="Priya Sharma",
        patient_gender="female",
        patient_year_of_birth=1988,
    )
    timeline = build_timeline(_synthetic_extraction)

    from app.services.disclaimers import get_disclaimer  # noqa: PLC0415

    summary = HealthSummary(
        language=language,
        overview=(
            "This lab report from Apollo Diagnostics dated 5 October 2024 shows results "
            "for Priya Sharma, a 36-year-old female with a known history of Type 2 Diabetes "
            "Mellitus. Her blood sugar control (HbA1c) is above the recommended target, and "
            "her kidney function marker (creatinine) is critically elevated, suggesting early "
            "signs of diabetic kidney disease. Her cholesterol is within the normal range. "
            "IMPORTANT: Please contact your doctor promptly about the creatinine result."
        ),
        key_findings=[
            "HbA1c is 8.4% — above the diabetes management target of below 7% for most adults.",
            "Serum creatinine is critically high at 2.8 mg/dL (normal: 0.6-1.2 mg/dL).",
            "Total cholesterol is 178 mg/dL — within the desirable range.",
            "Two medications prescribed: Metformin (blood sugar) and Atorvastatin (cholesterol).",
        ],
        abnormal_findings_explained=[
            (
                "HbA1c 8.4% (ABNORMAL): HbA1c tells you the average blood sugar level over "
                "the past 2-3 months. A reading of 8.4% means blood sugar has been running "
                "too high for too long. The normal upper limit is 5.6%; diabetes is diagnosed "
                "at 6.5% or above. Possible non-diagnostic reasons for a high value include "
                "recent illness, stress, or changes in diet."
            ),
            (
                "Creatinine 2.8 mg/dL (CRITICAL): Creatinine is a waste product filtered by "
                "the kidneys. The normal range is 0.6-1.2 mg/dL. A level of 2.8 is more than "
                "twice the upper limit, which may indicate that the kidneys are under significant "
                "stress. Possible non-diagnostic reasons include dehydration or recent strenuous "
                "exercise. Please see your doctor as soon as possible — do not wait."
            ),
        ],
        questions_for_doctor=[
            "Given my creatinine level, do I need a nephrology (kidney specialist) referral?",
            "Should we adjust my Metformin dose, or consider an additional diabetes medication?",
            "Do I need an eGFR (kidney filtration rate) test?",
            "Are there medications I should avoid given my kidney function results?",
            "How often should I repeat HbA1c and creatinine tests?",
        ],
        lifestyle_notes=[
            "Aim for a low-glycaemic diet — vegetables, whole grains, and legumes help blood sugar.",
            "Stay well hydrated; drink enough water daily unless your doctor advises otherwise.",
            "Aim for at least 30 minutes of moderate activity (walking, swimming) most days.",
            "Monitor your blood pressure regularly — high BP and kidney health are closely linked.",
        ],
        disclaimer=get_disclaimer(language),
    )

    return HealthRecordBundle(
        patient=patient,
        document=document,
        medications=medications,
        observations=observations,
        diagnoses=diagnoses,
        timeline=timeline,
        summary=summary,
        created_at=datetime.now(timezone.utc),
    )
