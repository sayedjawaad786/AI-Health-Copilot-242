"""
services/timeline.py - Pure function for building a patient health timeline.

build_timeline() is deterministic and side-effect-free so it can be unit-tested
without any mocking.

Rules:
  - One TimelineEvent per medication (category="medication")
  - One TimelineEvent per lab observation (category="lab", carries severity)
  - One TimelineEvent per diagnosis (category="diagnosis")
  - One "visit" event for the document date (category="visit"), if present
  - Events are sorted chronologically; undated events go last
  - abnormal / critical observations keep their exact severity on the event
"""


from datetime import date
from typing import List, Optional

from app.schemas.health import (
    ExtractionResult,
    Severity,
    TimelineEvent,
)

# Sentinel for undated events so they sort after all dated events
_FUTURE_DATE = date(9999, 12, 31)


def _sort_key(event: TimelineEvent) -> date:
    return event.date if event.date is not None else _FUTURE_DATE


def build_timeline(extraction: ExtractionResult) -> List[TimelineEvent]:
    """
    Build a sorted list of TimelineEvents from an ExtractionResult.

    This is a pure function - it reads from *extraction* and returns a new list;
    it does not modify any state.

    Parameters
    ----------
    extraction:
        The structured data extracted by the Gemini model.

    Returns
    -------
    List[TimelineEvent]
        Chronologically sorted events; events without a date appear last.
    """
    events: List[TimelineEvent] = []

    # ---- Visit event (document date) ---------------------------------------
    doc_date: Optional[date] = extraction.document.document_date
    provider: str = extraction.document.provider_name or "healthcare provider"
    facility: str = extraction.document.facility_name or ""
    visit_desc = f"Health record issued"
    if provider:
        visit_desc += f" by {provider}"
    if facility:
        visit_desc += f" at {facility}"
    visit_desc += "."

    events.append(
        TimelineEvent(
            date=doc_date,
            title="Health record visit",
            description=visit_desc,
            category="visit",
            severity=Severity.normal,
            related_ref=extraction.document.document_type,
        )
    )

    # ---- Diagnosis events --------------------------------------------------
    for dx in extraction.diagnoses:
        # Diagnoses are at least abnormal by clinical significance; treat as
        # normal unless the document severity info warrants otherwise (we have
        # no severity field on Diagnosis, so default to abnormal for visibility)
        events.append(
            TimelineEvent(
                date=dx.noted_date,
                title=f"Diagnosis: {dx.name}",
                description=(
                    f"{dx.name}"
                    + (f" ({dx.icd10_code})" if dx.icd10_code else "")
                    + (f" — status: {dx.status}" if dx.status else "")
                    + "."
                ),
                category="diagnosis",
                severity=Severity.abnormal,
                related_ref=dx.name,
            )
        )

    # ---- Medication events -------------------------------------------------
    for med in extraction.medications:
        dose_info = " ".join(
            filter(None, [med.dosage, med.frequency, med.route])
        )
        desc = f"{med.name}"
        if dose_info:
            desc += f" — {dose_info}"
        if med.duration:
            desc += f" for {med.duration}"
        desc += "."

        events.append(
            TimelineEvent(
                date=doc_date,  # Medications are anchored to the document date
                title=f"Medication: {med.name}",
                description=desc,
                category="medication",
                severity=Severity.normal,
                related_ref=med.name,
            )
        )

    # ---- Lab observation events --------------------------------------------
    for obs in extraction.observations:
        value_str = (
            f"{obs.value} {obs.unit}".strip()
            if obs.unit
            else str(obs.value)
        )
        desc = f"{obs.test_name}: {value_str}"
        if obs.reference_range:
            desc += f" (reference: {obs.reference_range})"
        desc += f" — {obs.severity.value}."

        events.append(
            TimelineEvent(
                date=obs.observed_date or doc_date,
                title=f"Lab: {obs.test_name}",
                description=desc,
                category="lab",
                # Preserve the exact severity from the observation
                severity=obs.severity,
                related_ref=obs.test_name,
            )
        )

    # Sort chronologically; undated events (date=None) go last
    events.sort(key=_sort_key)
    return events
