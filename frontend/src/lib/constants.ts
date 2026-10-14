/**
 * lib/constants.ts
 *
 * Application-wide constants. Import from here rather than inlining strings.
 */

import type { SupportedLanguage } from "../types/health";

// ---------------------------------------------------------------------------
// Language options
// ---------------------------------------------------------------------------

export interface LanguageOption {
  code: SupportedLanguage;
  /** English label */
  label: string;
  /** Label in the native script */
  nativeLabel: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
];

// ---------------------------------------------------------------------------
// Severity display metadata
// ---------------------------------------------------------------------------

export interface SeverityMeta {
  label: string;
  /** Tailwind bg class */
  bg: string;
  /** Tailwind text class */
  text: string;
  /** Tailwind border class */
  border: string;
  /** Tailwind badge bg class */
  badgeBg: string;
}

export const SEVERITY_META: Record<string, SeverityMeta> = {
  normal: {
    label: "Normal",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    badgeBg: "bg-emerald-100",
  },
  borderline: {
    label: "Borderline",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    badgeBg: "bg-amber-100",
  },
  abnormal: {
    label: "Abnormal",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    badgeBg: "bg-orange-100",
  },
  critical: {
    label: "Critical",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    badgeBg: "bg-red-100",
  },
};

// ---------------------------------------------------------------------------
// Document type labels
// ---------------------------------------------------------------------------

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  prescription: "Prescription",
  lab_report: "Lab Report",
  discharge_summary: "Discharge Summary",
  other: "Other",
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
