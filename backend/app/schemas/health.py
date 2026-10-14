"""
schemas/health.py - Full Pydantic v2 domain models for Health Copilot.

Design principles:
  - All fields use Field(description=...) for self-documenting JSON schema.
  - Optional fields default to None so partial LLM extractions never
    crash validation.
  - Enums are str-based so they serialise cleanly to JSON.
  - HealthRecordBundle.to_fhir_like_dict() produces a FHIR-style bundle
    (not full FHIR R4 compliant - clearly marked in comments).
"""

# (no __future__ annotations import — Pydantic v2 needs eager type resolution)

import random
import re
import uuid
import datetime as dt
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class SupportedLanguage(str, Enum):
    """Languages in which Health Copilot can produce summaries."""

    en = "en"
    hi = "hi"
    te = "te"
    ta = "ta"


class Severity(str, Enum):
    """Clinical severity level for an observation or timeline event."""

    normal = "normal"
    borderline = "borderline"
    abnormal = "abnormal"
    critical = "critical"


# ---------------------------------------------------------------------------
# ABHA (Ayushman Bharat Health Account) - mock profile
# ---------------------------------------------------------------------------

_ABHA_RE = re.compile(r"^\d{2}-\d{4}-\d{4}-\d{4}$")


class AbhaProfile(BaseModel):
    """
    Mock ABHA (Ayushman Bharat Health Account) profile.

    is_mock is always True - displayed in the UI as
    'Demo ABHA - not a real ID'.
    """

    abha_number: str = Field(
        description=(
            "14-digit ABHA number formatted as XX-XXXX-XXXX-XXXX. "
            "MOCK value only - not issued by ABDM."
        ),
    )
    abha_address: str = Field(
        description="ABHA address formatted as <name>@abdm. MOCK value.",
    )
    name: str = Field(description="Patient full name.")
    gender: Optional[Literal["male", "female", "other", "unknown"]] = Field(
        default=None, description="Patient gender."
    )
    year_of_birth: Optional[int] = Field(
        default=None,
        ge=1900,
        le=2100,
        description="Patient year of birth (4-digit).",
    )
    is_mock: bool = Field(
        default=True,
        description=(
            "Always True. Indicates this is a demo profile, "
            "not a real ABDM-issued ABHA ID."
        ),
    )

    @field_validator("abha_number")
    @classmethod
    def _validate_abha_format(cls, v: str) -> str:
        if not _ABHA_RE.match(v):
            raise ValueError(
                f"abha_number must match pattern XX-XXXX-XXXX-XXXX (got {v!r})"
            )
        return v


def generate_mock_abha(name: str) -> AbhaProfile:
    """
    Generate a random, structurally valid mock ABHA profile for *name*.

    The generated number is purely random and has no relationship to any
    real ABDM record.
    """
    abha_number = (
        f"{random.randint(0, 99):02d}"
        f"-{random.randint(0, 9999):04d}"
        f"-{random.randint(0, 9999):04d}"
        f"-{random.randint(0, 9999):04d}"
    )
    slug = re.sub(r"\s+", "", name.lower())[:20]
    return AbhaProfile(
        abha_number=abha_number,
        abha_address=f"{slug}@abdm",
        name=name,
        is_mock=True,
    )


# ---------------------------------------------------------------------------
# Clinical models
# ---------------------------------------------------------------------------


class Medication(BaseModel):
    """
    A prescribed medication - modelled after FHIR MedicationRequest.
    All fields beyond *name* are Optional so partial extraction is safe.
    """

    name: str = Field(description="Brand / trade name of the medication.")
    generic_name: Optional[str] = Field(
        default=None, description="International non-proprietary (generic) name."
    )
    dosage: Optional[str] = Field(
        default=None, description="Dose strength and unit, e.g. '500 mg'."
    )
    frequency: Optional[str] = Field(
        default=None, description="How often the dose is taken, e.g. 'twice daily'."
    )
    route: Optional[str] = Field(
        default=None, description="Route of administration, e.g. 'oral', 'topical'."
    )
    duration: Optional[str] = Field(
        default=None, description="Prescribed duration, e.g. '7 days', '1 month'."
    )
    instructions: Optional[str] = Field(
        default=None, description="Special instructions, e.g. 'take with food'."
    )
    plain_language_explanation: Optional[str] = Field(
        default=None,
        description=(
            "Patient-friendly explanation of what this medication is for "
            "and why it was prescribed."
        ),
    )


class LabObservation(BaseModel):
    """
    A single lab result - modelled after FHIR Observation.
    Includes both numeric reference bounds and a plain-language interpretation.
    """

    test_name: str = Field(description="Name of the laboratory test.")
    value: Union[float, str] = Field(
        description="Measured value (numeric or textual, e.g. 'Positive')."
    )
    unit: Optional[str] = Field(
        default=None, description="Unit of measurement, e.g. 'mg/dL'."
    )
    reference_range: Optional[str] = Field(
        default=None,
        description="Reference range as a display string, e.g. '70-100 mg/dL'.",
    )
    reference_low: Optional[float] = Field(
        default=None, description="Lower bound of the normal reference range."
    )
    reference_high: Optional[float] = Field(
        default=None, description="Upper bound of the normal reference range."
    )
    severity: Severity = Field(
        default=Severity.normal,
        description="Clinical severity derived from the reference range.",
    )
    interpretation: Optional[str] = Field(
        default=None,
        description=(
            "Plain-language explanation of what this value means clinically "
            "and why the patient should care."
        ),
    )
    observed_date: Optional[date] = Field(
        default=None, description="Date on which the sample was collected or observed."
    )
    loinc_code: Optional[str] = Field(
        default=None,
        description="Best-effort LOINC code for this test, e.g. '2339-0' for glucose.",
    )


class Diagnosis(BaseModel):
    """
    A clinical diagnosis or condition - modelled after FHIR Condition.
    """

    name: str = Field(description="Name of the diagnosis or condition.")
    icd10_code: Optional[str] = Field(
        default=None, description="Best-effort ICD-10 code, e.g. 'E11.9'."
    )
    status: Optional[str] = Field(
        default=None,
        description="Clinical status, e.g. 'active', 'resolved', 'in remission'.",
    )
    noted_date: Optional[date] = Field(
        default=None, description="Date the condition was first noted."
    )
    plain_language_explanation: Optional[str] = Field(
        default=None, description="Patient-friendly explanation of this condition."
    )


# ---------------------------------------------------------------------------
# Document metadata
# ---------------------------------------------------------------------------


class DocumentMeta(BaseModel):
    """Metadata about the uploaded health document."""

    document_type: Literal[
        "prescription", "lab_report", "discharge_summary", "other"
    ] = Field(description="Detected type of the document.")
    document_date: Optional[date] = Field(
        default=None, description="Date shown on the document."
    )
    provider_name: Optional[str] = Field(
        default=None, description="Name of the prescribing doctor or provider."
    )
    facility_name: Optional[str] = Field(
        default=None,
        description="Hospital, clinic, or lab where the document was issued.",
    )
    detected_languages: List[str] = Field(
        default_factory=list,
        description="ISO 639-1 language codes detected in the document.",
    )
    is_handwritten: bool = Field(
        default=False,
        description="True if the document (or part of it) is handwritten.",
    )
    ocr_confidence: Literal["high", "medium", "low"] = Field(
        default="high", description="Estimated OCR or extraction confidence."
    )


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------


class TimelineEvent(BaseModel):
    """A single event on the patient health timeline."""

    date: Optional[dt.date] = Field(default=None, description="Date of the event.")
    title: str = Field(description="Short title for the event.")
    description: str = Field(description="One-sentence summary of the event.")
    category: Literal["medication", "lab", "diagnosis", "visit"] = Field(
        description="Category used for timeline filtering and icon selection."
    )
    severity: Severity = Field(
        default=Severity.normal, description="Severity badge to show on the timeline card."
    )
    related_ref: Optional[str] = Field(
        default=None,
        description="Optional reference to a related entity, e.g. medication or test name.",
    )


# ---------------------------------------------------------------------------
# Health summary
# ---------------------------------------------------------------------------


class HealthSummary(BaseModel):
    """
    A patient-friendly summary of the health record,
    produced in the requested language.
    """

    language: SupportedLanguage = Field(
        default=SupportedLanguage.en,
        description="Language in which this summary is written.",
    )
    overview: str = Field(
        description=(
            "One- or two-paragraph plain-language overview of the document "
            "and the patient's current health picture."
        )
    )
    key_findings: List[str] = Field(
        default_factory=list,
        description="Bullet-point list of the most important findings.",
    )
    abnormal_findings_explained: List[str] = Field(
        default_factory=list,
        description=(
            "Plain-language explanation of each abnormal or critical finding, "
            "written so a non-medical reader can understand it."
        ),
    )
    questions_for_doctor: List[str] = Field(
        default_factory=list,
        description="Suggested questions the patient could ask their doctor at the next visit.",
    )
    lifestyle_notes: List[str] = Field(
        default_factory=list,
        description="General lifestyle recommendations relevant to the findings.",
    )
    disclaimer: str = Field(
        default=(
            "This summary is generated by an AI assistant and is for "
            "informational purposes only. It is not a substitute for "
            "professional medical advice, diagnosis, or treatment. "
            "Always consult a qualified healthcare provider."
        ),
        description="Standard medical disclaimer.",
    )


# ---------------------------------------------------------------------------
# Top-level bundle
# ---------------------------------------------------------------------------


class HealthRecordBundle(BaseModel):
    """
    Top-level FHIR-style bundle for a processed health document.

    Contains the ABHA profile, document metadata, extracted clinical data,
    a patient-facing summary, and a chronological timeline.
    """

    bundle_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier for this bundle (UUID v4).",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when this bundle was created.",
    )
    patient: AbhaProfile = Field(description="Mock ABHA profile for the patient.")
    document: DocumentMeta = Field(description="Metadata about the source document.")
    medications: List[Medication] = Field(
        default_factory=list, description="Medications extracted from the document."
    )
    observations: List[LabObservation] = Field(
        default_factory=list, description="Lab observations extracted from the document."
    )
    diagnoses: List[Diagnosis] = Field(
        default_factory=list,
        description="Diagnoses or conditions extracted from the document.",
    )
    timeline: List[TimelineEvent] = Field(
        default_factory=list, description="Chronological timeline of clinical events."
    )
    summary: HealthSummary = Field(description="Patient-facing AI-generated health summary.")

    def to_fhir_like_dict(self) -> Dict[str, Any]:
        """
        Return a FHIR-style representation of this bundle.

        NOTE: FHIR-style, not full FHIR R4 validation.
        For hackathon / demo purposes only.
        """
        entries: List[Dict[str, Any]] = []

        # ---- Patient resource -----------------------------------------------
        # The ABHA number is carried as an identifier with the NDHM system URI.
        patient_res: Dict[str, Any] = {
            "resourceType": "Patient",
            "identifier": [
                {
                    "system": "https://healthid.ndhm.gov.in",
                    "value": self.patient.abha_number,
                }
            ],
            "name": [{"text": self.patient.name}],
            "gender": self.patient.gender or "unknown",
            # Non-standard extension flagging this as a mock profile
            "extension": [
                {
                    "url": "https://health-copilot.dev/fhir/ext/is-mock",
                    "valueBoolean": self.patient.is_mock,
                }
            ],
        }
        if self.patient.year_of_birth:
            patient_res["birthDate"] = str(self.patient.year_of_birth)
        entries.append({"resource": patient_res})

        # ---- MedicationRequest resources ------------------------------------
        for med in self.medications:
            entries.append(
                {
                    "resource": {
                        "resourceType": "MedicationRequest",
                        "status": "active",
                        "intent": "order",
                        "medicationCodeableConcept": {
                            "text": med.generic_name or med.name
                        },
                        "subject": {"display": self.patient.name},
                        "dosageInstruction": [
                            {
                                "text": " ".join(
                                    filter(
                                        None,
                                        [med.dosage, med.frequency, med.route, med.instructions],
                                    )
                                )
                            }
                        ],
                        "extension": [
                            {
                                "url": "https://health-copilot.dev/fhir/ext/plain-language",
                                "valueString": med.plain_language_explanation or "",
                            }
                        ],
                    }
                }
            )

        # ---- Observation resources ------------------------------------------
        for obs in self.observations:
            obs_res: Dict[str, Any] = {
                "resourceType": "Observation",
                "status": "final",
                "code": {"text": obs.test_name},
                "subject": {"display": self.patient.name},
                "interpretation": [{"text": obs.severity.value}],
                "extension": [
                    {
                        "url": "https://health-copilot.dev/fhir/ext/plain-language",
                        "valueString": obs.interpretation or "",
                    }
                ],
            }
            if obs.loinc_code:
                obs_res["code"]["coding"] = [
                    {
                        "system": "http://loinc.org",
                        "code": obs.loinc_code,
                        "display": obs.test_name,
                    }
                ]
            if isinstance(obs.value, float):
                obs_res["valueQuantity"] = {"value": obs.value, "unit": obs.unit or ""}
            else:
                obs_res["valueString"] = str(obs.value)
            ref_range: Dict[str, Any] = {}
            if obs.reference_low is not None:
                ref_range["low"] = {"value": obs.reference_low}
            if obs.reference_high is not None:
                ref_range["high"] = {"value": obs.reference_high}
            if ref_range:
                obs_res["referenceRange"] = [ref_range]
            entries.append({"resource": obs_res})

        # ---- Condition (Diagnosis) resources --------------------------------
        for dx in self.diagnoses:
            dx_res: Dict[str, Any] = {
                "resourceType": "Condition",
                "clinicalStatus": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                            "code": dx.status or "active",
                        }
                    ]
                },
                "code": {"text": dx.name},
                "subject": {"display": self.patient.name},
                "extension": [
                    {
                        "url": "https://health-copilot.dev/fhir/ext/plain-language",
                        "valueString": dx.plain_language_explanation or "",
                    }
                ],
            }
            if dx.icd10_code:
                dx_res["code"]["coding"] = [
                    {
                        "system": "http://hl7.org/fhir/sid/icd-10",
                        "code": dx.icd10_code,
                        "display": dx.name,
                    }
                ]
            if dx.noted_date:
                dx_res["onsetDateTime"] = str(dx.noted_date)
            entries.append({"resource": dx_res})

        # FHIR-style bundle - not full FHIR R4 validation, for demo use only
        return {
            "resourceType": "Bundle",
            "id": self.bundle_id,
            "type": "collection",
            "timestamp": self.created_at.isoformat(),
            "total": len(entries),
            "entry": entries,
        }


# ---------------------------------------------------------------------------
# Intermediate extraction result (what the LLM returns)
# ---------------------------------------------------------------------------


class ExtractionResult(BaseModel):
    """
    Intermediate model populated by the Gemini LLM after analysing a document.

    The server then builds the full HealthRecordBundle from this, adding the
    mock ABHA profile, constructing the timeline, and generating the summary.
    """

    document: DocumentMeta = Field(description="Metadata about the analysed document.")
    medications: List[Medication] = Field(
        default_factory=list, description="Medications found in the document."
    )
    observations: List[LabObservation] = Field(
        default_factory=list, description="Lab observations found in the document."
    )
    diagnoses: List[Diagnosis] = Field(
        default_factory=list, description="Diagnoses or conditions found in the document."
    )
    # Patient demographics - extracted where visible; ABHA mock is built server-side
    patient_name: Optional[str] = Field(
        default=None, description="Patient name as it appears on the document."
    )
    patient_gender: Optional[Literal["male", "female", "other", "unknown"]] = Field(
        default=None, description="Patient gender as it appears on the document."
    )
    patient_year_of_birth: Optional[int] = Field(
        default=None,
        ge=1900,
        le=2100,
        description="Patient year of birth extracted from the document.",
    )
