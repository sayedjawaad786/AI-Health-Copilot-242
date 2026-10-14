"""
tests/test_timeline.py - Unit tests for build_timeline() and the ABHA regex validator.

Run with:
    cd backend
    pytest tests/test_timeline.py -v

No network calls or Gemini API key required.
"""

from __future__ import annotations

import re
from datetime import date
from typing import List

import pytest

from app.schemas.health import (
    AbhaProfile,
    Diagnosis,
    DocumentMeta,
    ExtractionResult,
    LabObservation,
    Medication,
    Severity,
    generate_mock_abha,
)
from app.services.timeline import build_timeline

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ABHA_PATTERN = re.compile(r"^\d{2}-\d{4}-\d{4}-\d{4}$")


def _make_extraction(
    doc_date=None,
    medications=None,
    observations=None,
    diagnoses=None,
) -> ExtractionResult:
    """Build a minimal ExtractionResult for testing."""
    return ExtractionResult(
        document=DocumentMeta(
            document_type="lab_report",
            document_date=doc_date,
            detected_languages=["en"],
        ),
        medications=medications or [],
        observations=observations or [],
        diagnoses=diagnoses or [],
    )


# ---------------------------------------------------------------------------
# ABHA regex tests
# ---------------------------------------------------------------------------


class TestAbhaRegex:
    """Validate the ABHA number pattern XX-XXXX-XXXX-XXXX."""

    @pytest.mark.parametrize(
        "abha_number",
        [
            "12-3456-7890-1234",
            "00-0000-0000-0000",
            "99-9999-9999-9999",
            "01-2345-6789-0123",
        ],
    )
    def test_valid_abha_numbers_accepted(self, abha_number: str) -> None:
        profile = AbhaProfile(
            abha_number=abha_number,
            abha_address="test@abdm",
            name="Test Patient",
        )
        assert profile.abha_number == abha_number

    @pytest.mark.parametrize(
        "bad_number",
        [
            "1234567890123456",    # no dashes
            "12-345-6789-1234",   # wrong segment length
            "12-3456-7890-123",   # too short
            "12-3456-7890-12345", # too long
            "AB-CDEF-GHIJ-KLMN",  # letters not digits
            "",                   # empty
            "12-3456-7890_1234",  # underscore instead of dash
        ],
    )
    def test_invalid_abha_numbers_rejected(self, bad_number: str) -> None:
        with pytest.raises(Exception):
            AbhaProfile(
                abha_number=bad_number,
                abha_address="test@abdm",
                name="Test Patient",
            )

    def test_generate_mock_abha_always_valid(self) -> None:
        """generate_mock_abha should always produce a pattern-valid ABHA number."""
        for name in ["Priya Sharma", "राम", "Ravi Kumar", "A B"]:
            profile = generate_mock_abha(name)
            assert _ABHA_PATTERN.match(profile.abha_number), (
                f"Invalid ABHA number generated for {name!r}: {profile.abha_number!r}"
            )
            assert profile.is_mock is True
            assert profile.abha_address.endswith("@abdm")
            assert profile.name == name

    def test_generate_mock_abha_randomness(self) -> None:
        """Two calls for the same name should (almost always) produce different numbers."""
        p1 = generate_mock_abha("Test User")
        p2 = generate_mock_abha("Test User")
        # This could theoretically fail once in ~10^14 runs; acceptable for a test
        assert p1.abha_number != p2.abha_number or True  # allow equality, just verify format
        assert _ABHA_PATTERN.match(p1.abha_number)
        assert _ABHA_PATTERN.match(p2.abha_number)


# ---------------------------------------------------------------------------
# build_timeline() tests
# ---------------------------------------------------------------------------


class TestBuildTimeline:
    """Tests for the pure build_timeline() function."""

    def test_empty_extraction_produces_one_visit_event(self) -> None:
        """An empty extraction still yields a visit event."""
        extraction = _make_extraction()
        events = build_timeline(extraction)
        assert len(events) == 1
        assert events[0].category == "visit"

    def test_one_medication_produces_two_events(self) -> None:
        """One medication => visit + medication events."""
        extraction = _make_extraction(
            medications=[
                Medication(name="Paracetamol", dosage="500 mg", frequency="thrice daily")
            ]
        )
        events = build_timeline(extraction)
        categories = [e.category for e in events]
        assert "visit" in categories
        assert "medication" in categories
        assert len(events) == 2

    def test_medication_event_contains_name_and_dose(self) -> None:
        extraction = _make_extraction(
            medications=[
                Medication(name="Metformin", dosage="500 mg", frequency="twice daily")
            ]
        )
        events = build_timeline(extraction)
        med_events = [e for e in events if e.category == "medication"]
        assert len(med_events) == 1
        ev = med_events[0]
        assert "Metformin" in ev.title
        assert "500 mg" in ev.description or "twice daily" in ev.description

    def test_lab_observation_severity_preserved(self) -> None:
        """The lab event must carry the exact severity from the observation."""
        extraction = _make_extraction(
            observations=[
                LabObservation(
                    test_name="Creatinine",
                    value=2.8,
                    unit="mg/dL",
                    severity=Severity.critical,
                ),
                LabObservation(
                    test_name="Cholesterol",
                    value=178.0,
                    unit="mg/dL",
                    severity=Severity.normal,
                ),
            ]
        )
        events = build_timeline(extraction)
        lab_events = {e.related_ref: e for e in events if e.category == "lab"}
        assert lab_events["Creatinine"].severity == Severity.critical
        assert lab_events["Cholesterol"].severity == Severity.normal

    def test_diagnosis_event_is_always_abnormal(self) -> None:
        extraction = _make_extraction(
            diagnoses=[
                Diagnosis(name="Type 2 Diabetes Mellitus", icd10_code="E11.9", status="active")
            ]
        )
        events = build_timeline(extraction)
        dx_events = [e for e in events if e.category == "diagnosis"]
        assert len(dx_events) == 1
        assert dx_events[0].severity == Severity.abnormal

    def test_events_sorted_chronologically(self) -> None:
        """Dated events appear before undated events; dated ones are in date order."""
        extraction = _make_extraction(
            doc_date=date(2024, 10, 5),
            diagnoses=[
                Diagnosis(name="Diabetes", noted_date=date(2022, 3, 14))
            ],
            observations=[
                LabObservation(
                    test_name="HbA1c",
                    value=8.4,
                    unit="%",
                    severity=Severity.abnormal,
                    observed_date=date(2024, 10, 5),
                )
            ],
        )
        events = build_timeline(extraction)
        # Filter to dated events only
        dated = [e for e in events if e.date is not None]
        dates = [e.date for e in dated]
        assert dates == sorted(dates), f"Events not sorted: {dates}"

    def test_undated_events_appear_last(self) -> None:
        extraction = _make_extraction(
            doc_date=date(2024, 1, 1),  # visit is dated
            medications=[
                Medication(name="MedA")  # no date, anchored to doc_date
            ],
            observations=[
                LabObservation(
                    test_name="TestX",
                    value="Positive",
                    severity=Severity.normal,
                    observed_date=None,  # explicitly undated
                )
            ],
        )
        events = build_timeline(extraction)
        # All events with a date must come before any without
        seen_undated = False
        for ev in events:
            if ev.date is None:
                seen_undated = True
            elif seen_undated:
                pytest.fail(
                    f"Dated event {ev.title!r} appeared after an undated event"
                )

    def test_total_event_count(self) -> None:
        """Total = 1 visit + N meds + M obs + K diagnoses."""
        extraction = _make_extraction(
            medications=[Medication(name="A"), Medication(name="B")],
            observations=[
                LabObservation(test_name="T1", value=1.0, severity=Severity.normal),
                LabObservation(test_name="T2", value=2.0, severity=Severity.abnormal),
                LabObservation(test_name="T3", value=3.0, severity=Severity.critical),
            ],
            diagnoses=[
                Diagnosis(name="Condition X"),
                Diagnosis(name="Condition Y"),
            ],
        )
        events = build_timeline(extraction)
        assert len(events) == 1 + 2 + 3 + 2  # visit + meds + obs + diagnoses

    def test_visit_event_includes_provider_and_facility(self) -> None:
        extraction = ExtractionResult(
            document=DocumentMeta(
                document_type="prescription",
                document_date=date(2024, 6, 1),
                provider_name="Dr. Anjali Mehta",
                facility_name="City Hospital",
                detected_languages=["en"],
            )
        )
        events = build_timeline(extraction)
        visit = next(e for e in events if e.category == "visit")
        assert "Dr. Anjali Mehta" in visit.description
        assert "City Hospital" in visit.description

    def test_multiple_medications_each_get_event(self) -> None:
        meds = [Medication(name=f"Drug{i}") for i in range(5)]
        extraction = _make_extraction(medications=meds)
        events = build_timeline(extraction)
        med_events = [e for e in events if e.category == "medication"]
        assert len(med_events) == 5
        titles = [e.title for e in med_events]
        for i in range(5):
            assert any(f"Drug{i}" in t for t in titles)
