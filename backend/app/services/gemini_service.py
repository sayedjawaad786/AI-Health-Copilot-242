"""
services/gemini_service.py - Gemini-powered medical document analysis.

Provides GeminiExtractor with two async methods:
  - extract()   : send a document image/PDF to Gemini and parse an ExtractionResult
  - summarize() : generate a patient-friendly HealthSummary from an ExtractionResult

Both methods run blocking SDK calls via asyncio.to_thread() so FastAPI stays
fully non-blocking.

Error mapping:
  HTTP 413  file too large
  HTTP 415  unsupported MIME type
  HTTP 422  Gemini returned JSON that does not validate (after 1 retry)
  HTTP 429  Gemini quota exceeded
  HTTP 502  Gemini safety block or unexpected API error
  HTTP 504  Gemini request timed out
"""


import asyncio
import json
import logging
from typing import Any, Dict

import google.generativeai as genai
from fastapi import HTTPException
from google.api_core.exceptions import (
    DeadlineExceeded,
    ResourceExhausted,
    GoogleAPIError,
)
from pydantic import ValidationError

from app.config import get_settings
from app.schemas.health import (
    ExtractionResult,
    HealthSummary,
    SupportedLanguage,
)
from app.services.disclaimers import get_disclaimer

logger = logging.getLogger(__name__)

settings = get_settings()

# ---------------------------------------------------------------------------
# MIME type allow-list
# ---------------------------------------------------------------------------

ALLOWED_MIME_TYPES: frozenset[str] = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
    }
)

# ---------------------------------------------------------------------------
# Language routing helper
# ---------------------------------------------------------------------------

_LANGUAGE_NAMES: Dict[str, str] = {
    "en": "English",
    "hi": "Hindi (Devanagari script)",
    "te": "Telugu (Telugu script)",
    "ta": "Tamil (Tamil script)",
}


def route_language(code: str) -> SupportedLanguage:
    """
    Validate *code* against SupportedLanguage enum values.
    Falls back to SupportedLanguage.en for unknown codes.
    """
    try:
        return SupportedLanguage(code)
    except ValueError:
        logger.warning("Unknown language code %r; falling back to 'en'.", code)
        return SupportedLanguage.en


# ---------------------------------------------------------------------------
# System prompts (module-level constants, full wording as specified)
# ---------------------------------------------------------------------------

EXTRACTION_SYSTEM_PROMPT: str = """You are a medical document transcription and structuring engine. \
You receive a photo or scan of a medical record (prescription, lab report, or discharge summary) \
that may be printed, handwritten, or a mix, and may be in English, Hindi, Telugu, Tamil, \
or a mix of these.

RULES:
1. Extract ONLY information that is visibly present in the document. Never invent, guess or infer \
drugs, doses, values, or diagnoses. If a field is unreadable or absent, return null.
2. For handwritten or low-quality text, do your best to transcribe, but set document.ocr_confidence \
to 'low' or 'medium' and set is_handwritten accordingly. If a medicine name is ambiguous, \
transcribe it as written and do not silently correct it to a different drug.
3. Detect and list all languages present in document.detected_languages using ISO codes \
(en, hi, te, ta). Transcribe medicine and test names into English (Latin script) while preserving \
the original brand name. Keep patient and doctor names as written, transliterated to Latin script.
4. Medications: capture name, generic_name if printed, dosage with unit, frequency \
(normalize shorthand such as OD, BD, TDS, QID, HS, SOS and Indian notations like 1-0-1 into \
plain words, e.g. '1-0-1' = 'one in the morning, none at noon, one at night'), route, duration, \
and special instructions (e.g. after food).
5. Lab observations: capture test_name, numeric value, unit, the printed reference range, \
and parse reference_low/reference_high when numeric. Compute severity ONLY by comparing against \
the printed reference range: 'normal' within range; 'borderline' if outside by less than 10% of \
the range boundary; 'abnormal' if outside by 10% or more; 'critical' only if the document flags \
it as critical/panic or it is more than 50% beyond the boundary. If no reference range is printed, \
set severity 'normal' and leave interpretation null rather than guessing.
6. Diagnoses: capture only diagnoses or conditions written in the document. icd10_code only if \
you are highly confident, otherwise null.
7. Dates: return ISO 8601 (YYYY-MM-DD). Indian documents commonly use DD/MM/YYYY; \
interpret accordingly.
8. Do not include any patient identifiers other than name, gender and year of birth. \
Never output phone numbers, addresses or government ID numbers.
9. If the image is not a medical document, return empty lists and set \
document.document_type to 'other'.
10. Output must be valid JSON matching the provided schema, with no commentary."""

SUMMARY_SYSTEM_PROMPT: str = """You are a compassionate health-literacy assistant helping a \
patient in India understand their own medical records in simple language at roughly a Grade 6 \
reading level. You are NOT a doctor.

RULES:
1. Write the entire response in the target language requested by the user: \
en = English, hi = Hindi (Devanagari), te = Telugu (Telugu script), ta = Tamil (Tamil script). \
Use simple, everyday vocabulary. Keep medicine names, test names, and units in English/Latin \
script in parentheses next to the local-language explanation, because that is how they appear \
on the pharmacy label.
2. Explain what each key finding means in plain words. For EVERY observation with severity \
'borderline', 'abnormal', or 'critical', add an entry to abnormal_findings_explained that states: \
the test name, the patient's value vs the reference range, whether it is high or low, what that \
test generally measures, and common non-diagnostic reasons a value may be off. Do not claim a cause.
3. Never diagnose, never prescribe, never recommend starting, stopping or changing any medicine \
or dose. Never say a condition is or is not present beyond what the document itself states.
4. For 'critical' values, begin the overview with a calm, clear instruction to contact a doctor \
promptly.
5. Provide 3 to 5 questions_for_doctor the patient could ask, and 2 to 4 general lifestyle_notes \
clearly framed as general wellness information, not treatment.
6. Use ONLY the structured data provided. If data is missing, say it was not available in the \
document. Do not add outside facts about this patient.
7. Always set the disclaimer field to the exact approved disclaimer text for the target language \
(provided to you in the user message). Do not alter it.
8. Tone: warm, calm, non-alarming, respectful. No fear-inducing language.
9. Output valid JSON matching the HealthSummary schema, no commentary."""

# ---------------------------------------------------------------------------
# JSON schema helpers
# ---------------------------------------------------------------------------


def _extraction_schema() -> Dict[str, Any]:
    """Return the JSON schema dict for ExtractionResult (Pydantic v2)."""
    return ExtractionResult.model_json_schema()


def _summary_schema() -> Dict[str, Any]:
    """Return the JSON schema dict for HealthSummary (Pydantic v2)."""
    return HealthSummary.model_json_schema()


# ---------------------------------------------------------------------------
# GeminiExtractor
# ---------------------------------------------------------------------------


class GeminiExtractor:
    """
    Wraps two Gemini GenerativeModel instances:
      - _extraction_model : structured extraction from a document image/PDF
      - _summary_model    : patient-friendly HealthSummary in the target language

    All public methods are async; blocking SDK calls are offloaded to a thread
    via asyncio.to_thread() so the FastAPI event loop is never blocked.
    """

    def __init__(self) -> None:
        genai.configure(api_key=settings.gemini_api_key)

        # Extraction model: low temperature for faithfulness, JSON output
        self._extraction_model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            system_instruction=EXTRACTION_SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                temperature=0.1,
                response_mime_type="application/json",
                
            ),
        )

        # Summary model: slightly warmer temperature for natural language
        self._summary_model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            system_instruction=SUMMARY_SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                temperature=0.4,
                response_mime_type="application/json",
                
            ),
        )

    # -----------------------------------------------------------------------
    # Public async interface
    # -----------------------------------------------------------------------

    async def extract(self, file_bytes: bytes, mime_type: str) -> ExtractionResult:
        """
        Analyse a health document and return a structured ExtractionResult.

        Parameters
        ----------
        file_bytes:
            Raw bytes of the uploaded file.
        mime_type:
            MIME type declared by the client (validated here before sending to Gemini).

        Raises
        ------
        HTTPException 413  if file exceeds MAX_UPLOAD_MB
        HTTPException 415  if MIME type is not in ALLOWED_MIME_TYPES
        HTTPException 422  if Gemini output fails Pydantic validation after 1 retry
        HTTPException 429  if Gemini quota is exceeded
        HTTPException 502  if Gemini returns a safety block or unexpected error
        HTTPException 504  if the Gemini request times out
        """
        # ---- Validation: size and type ----------------------------------------
        if len(file_bytes) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"File is too large. Maximum allowed size is "
                    f"{settings.max_upload_mb} MB."
                ),
            )
        if mime_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=415,
                detail=(
                    f"Unsupported file type: {mime_type!r}. "
                    f"Accepted types: {', '.join(sorted(ALLOWED_MIME_TYPES))}."
                ),
            )

        # ---- Build the inline file part ---------------------------------------
        inline_part = {"mime_type": mime_type, "data": file_bytes}

        # ---- First attempt ----------------------------------------------------
        raw_json = await self._call_extraction(inline_part)
        result, error = self._parse_extraction(raw_json)
        if result is not None:
            return result

        # ---- One repair retry with the validation error in the prompt ---------
        logger.warning("ExtractionResult validation failed; attempting repair. Error: %s", error)
        repair_prompt = (
            "The JSON you returned failed validation with this error:\n"
            f"{error}\n\n"
            "Please fix ONLY the fields mentioned in the error above and return valid JSON "
            "that matches the schema exactly. Do not change any correctly extracted fields."
        )
        raw_json_retry = await self._call_extraction_repair(inline_part, repair_prompt)
        result, error = self._parse_extraction(raw_json_retry)
        if result is not None:
            return result

        raise HTTPException(
            status_code=422,
            detail=(
                "The AI could not produce a valid structured extraction from this document. "
                "Please try a clearer image or a different file. "
                f"Validation error: {error}"
            ),
        )

    async def summarize(
        self,
        extraction: ExtractionResult,
        language: SupportedLanguage,
    ) -> HealthSummary:
        """
        Generate a patient-friendly HealthSummary for the extracted data.

        The server-side disclaimer is always injected after parsing, so the
        model output's disclaimer field is silently overwritten.

        Parameters
        ----------
        extraction:
            Structured clinical data to summarise.
        language:
            Target language for the patient-facing summary.

        Raises
        ------
        HTTPException 422  if output fails HealthSummary validation
        HTTPException 429  quota exceeded
        HTTPException 502  safety block or API error
        HTTPException 504  timeout
        """
        lang = route_language(language.value)
        lang_name = _LANGUAGE_NAMES.get(lang.value, "English")
        disclaimer_text = get_disclaimer(lang)

        # Build a structured user message so the model has everything it needs
        user_message = (
            f"Target language: {lang_name} (code: {lang.value})\n\n"
            f"Approved disclaimer text (copy this verbatim into the disclaimer field):\n"
            f"{disclaimer_text}\n\n"
            f"Structured health record data:\n"
            f"{extraction.model_dump_json(indent=2)}"
        )

        raw_json = await self._call_summary(user_message)
        summary = self._parse_summary(raw_json, lang, disclaimer_text)
        return summary

    # -----------------------------------------------------------------------
    # Private blocking helpers (run in thread via asyncio.to_thread)
    # -----------------------------------------------------------------------

    def _sync_extract(self, inline_part: dict) -> str:
        """Blocking: send document to extraction model, return raw text."""
        response = self._extraction_model.generate_content(
            [inline_part, "Extract all medical information from this document."]
        )
        return response.text

    def _sync_extract_repair(self, inline_part: dict, repair_prompt: str) -> str:
        """Blocking: send document + repair instructions, return raw text."""
        response = self._extraction_model.generate_content(
            [inline_part, repair_prompt]
        )
        return response.text

    def _sync_summarize(self, user_message: str) -> str:
        """Blocking: send extraction data to summary model, return raw text."""
        response = self._summary_model.generate_content(user_message)
        return response.text
    # -----------------------------------------------------------------------
    # Async wrappers with error mapping
    # -----------------------------------------------------------------------

    async def _call_extraction(self, inline_part: dict) -> str:
        return await self._call_with_error_mapping(self._sync_extract, inline_part)

    async def _call_extraction_repair(self, inline_part: dict, repair_prompt: str) -> str:
        return await self._call_with_error_mapping(
            self._sync_extract_repair, inline_part, repair_prompt
        )

    async def _call_summary(self, user_message: str) -> str:
        return await self._call_with_error_mapping(self._sync_summarize, user_message)

    async def _call_with_error_mapping(self, fn, *args) -> str:
        """
        Run *fn(*args)* in a thread and map known Gemini exceptions to HTTPExceptions.
        """
        try:
            return await asyncio.to_thread(fn, *args)
        except ResourceExhausted as exc:
            logger.warning("Gemini quota exceeded: %s", exc)
            raise HTTPException(
                status_code=429,
                detail=(
                    "The AI service is temporarily unavailable due to high usage. "
                    "Please wait a moment and try again."
                ),
            ) from exc
        except DeadlineExceeded as exc:
            logger.warning("Gemini request timed out: %s", exc)
            raise HTTPException(
                status_code=504,
                detail=(
                    "The AI service took too long to respond. "
                    "Please try again with a smaller or clearer image."
                ),
            ) from exc
        except GoogleAPIError as exc:
            # Includes safety blocks (RECITATION, SAFETY, etc.)
            logger.error("Gemini API error: %s", exc)
            # Detect safety blocks by checking the error message
            msg_lower = str(exc).lower()
            if "safety" in msg_lower or "block" in msg_lower or "recitation" in msg_lower:
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "The AI service could not process this document due to content "
                        "safety filters. Please try a different document."
                    ),
                ) from exc
            raise HTTPException(
                status_code=502,
                detail=(
                    "An unexpected error occurred with the AI service. "
                    "Please try again in a few moments."
                ),
            ) from exc


    # -----------------------------------------------------------------------
    # Parse helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _parse_extraction(raw_json: str) -> tuple[ExtractionResult | None, str | None]:
        """
        Attempt to parse *raw_json* into ExtractionResult.
        Returns (result, None) on success, (None, error_message) on failure.
        """
        # --- Strip Markdown formatting if Gemini included it ---
        clean_json = raw_json.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        elif clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
        clean_json = clean_json.strip()
        
        try:
            result = ExtractionResult.model_validate_json(clean_json)
            return result, None
        except ValidationError as exc:
            return None, str(exc)
        except (json.JSONDecodeError, ValueError) as exc:
            return None, str(exc)

    @staticmethod
    def _parse_summary(
        raw_json: str,
        language: SupportedLanguage,
        disclaimer_text: str,
    ) -> HealthSummary:
        """
        Parse *raw_json* into HealthSummary.
        Always overwrites the disclaimer with the hardcoded server-side text.
        Raises HTTPException 422 on validation failure.
        """
        # --- Strip Markdown formatting if Gemini included it ---
        clean_json = raw_json.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        elif clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
        clean_json = clean_json.strip()

        try:
            summary = HealthSummary.model_validate_json(clean_json)
        except (ValidationError, json.JSONDecodeError, ValueError) as exc:
            logger.error("HealthSummary validation failed: %s", exc)
            raise HTTPException(
                status_code=422,
                detail=(
                    "The AI could not produce a valid summary. "
                    "Please try again."
                ),
            ) from exc

        # Server-side disclaimer override — the model must never alter this
        summary.language = language
        summary.disclaimer = disclaimer_text
        return summary


# ---------------------------------------------------------------------------
# Module-level singleton (created lazily on first import of the router)
# ---------------------------------------------------------------------------

_extractor_instance: GeminiExtractor | None = None


def get_extractor() -> GeminiExtractor:
    """
    Return the module-level GeminiExtractor singleton.

    Creating the singleton lazily means that if GEMINI_API_KEY is blank,
    GET /api/records/sample still works fine (it never calls get_extractor()).
    """
    global _extractor_instance
    if _extractor_instance is None:
        _extractor_instance = GeminiExtractor()
    return _extractor_instance
