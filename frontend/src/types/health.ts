/**
 * types/health.ts
 *
 * TypeScript interfaces that mirror every Pydantic model from
 * backend/app/schemas/health.py exactly.
 *
 * Keep this file in sync with the backend schemas manually,
 * or regenerate via `openapi-typescript` against /openapi.json.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type SupportedLanguage = "en" | "hi" | "te" | "ta";

export type Severity = "normal" | "borderline" | "abnormal" | "critical";

// ---------------------------------------------------------------------------
// ABHA Profile
// ---------------------------------------------------------------------------

export interface AbhaProfile {
  /** 14-digit ABHA number formatted as XX-XXXX-XXXX-XXXX. MOCK only. */
  abha_number: string;
  /** ABHA address formatted as <name>@abdm. MOCK value. */
  abha_address: string;
  name: string;
  gender?: "male" | "female" | "other" | "unknown" | null;
  year_of_birth?: number | null;
  /** Always true – this is a demo profile, not a real ABDM-issued ID. */
  is_mock: boolean;
}

// ---------------------------------------------------------------------------
// Clinical models
// ---------------------------------------------------------------------------

export interface Medication {
  name: string;
  generic_name?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  duration?: string | null;
  instructions?: string | null;
  plain_language_explanation?: string | null;
}

export interface LabObservation {
  test_name: string;
  /** Measured value – numeric or textual (e.g. "Positive") */
  value: number | string;
  unit?: string | null;
  /** Display string, e.g. "70-100 mg/dL" */
  reference_range?: string | null;
  reference_low?: number | null;
  reference_high?: number | null;
  severity: Severity;
  interpretation?: string | null;
  /** ISO 8601 date string, e.g. "2024-10-05" */
  observed_date?: string | null;
  loinc_code?: string | null;
}

export interface Diagnosis {
  name: string;
  icd10_code?: string | null;
  status?: string | null;
  /** ISO 8601 date string */
  noted_date?: string | null;
  plain_language_explanation?: string | null;
}

// ---------------------------------------------------------------------------
// Document metadata
// ---------------------------------------------------------------------------

export type DocumentType =
  | "prescription"
  | "lab_report"
  | "discharge_summary"
  | "other";

export type OcrConfidence = "high" | "medium" | "low";

export interface DocumentMeta {
  document_type: DocumentType;
  /** ISO 8601 date string */
  document_date?: string | null;
  provider_name?: string | null;
  facility_name?: string | null;
  /** ISO 639-1 language codes, e.g. ["en", "hi"] */
  detected_languages: string[];
  is_handwritten: boolean;
  ocr_confidence: OcrConfidence;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type TimelineCategory = "medication" | "lab" | "diagnosis" | "visit";

export interface TimelineEvent {
  /** ISO 8601 date string */
  date?: string | null;
  title: string;
  description: string;
  category: TimelineCategory;
  severity: Severity;
  related_ref?: string | null;
}

// ---------------------------------------------------------------------------
// Health summary
// ---------------------------------------------------------------------------

export interface HealthSummary {
  language: SupportedLanguage;
  overview: string;
  key_findings: string[];
  abnormal_findings_explained: string[];
  questions_for_doctor: string[];
  lifestyle_notes: string[];
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Top-level bundle
// ---------------------------------------------------------------------------

export interface HealthRecordBundle {
  bundle_id: string;
  /** ISO 8601 datetime string (UTC) */
  created_at: string;
  patient: AbhaProfile;
  document: DocumentMeta;
  medications: Medication[];
  observations: LabObservation[];
  diagnoses: Diagnosis[];
  timeline: TimelineEvent[];
  summary: HealthSummary;
}

// ---------------------------------------------------------------------------
// Extraction result (intermediate – returned by LLM, assembled server-side)
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  document: DocumentMeta;
  medications: Medication[];
  observations: LabObservation[];
  diagnoses: Diagnosis[];
  patient_name?: string | null;
  patient_gender?: "male" | "female" | "other" | "unknown" | null;
  patient_year_of_birth?: number | null;
}

// ---------------------------------------------------------------------------
// API request / response helpers
// ---------------------------------------------------------------------------

/** POST /api/records/translate request body */
export interface TranslateRequest {
  bundle_id: string;
  language: SupportedLanguage;
}
