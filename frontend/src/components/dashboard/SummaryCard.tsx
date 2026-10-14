/**
 * components/dashboard/SummaryCard.tsx
 *
 * Patient-friendly summary card with:
 *   - Language badge
 *   - Overview paragraph
 *   - Key findings list
 *   - Questions for doctor (sky callout)
 *   - Lifestyle notes (collapsible)
 *   - Disclaimer box
 *   - Skeleton shimmer while isTranslating
 *   - lang= attribute for correct script rendering
 */

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Languages,
  MessageCircleQuestion,
  ShieldAlert,
} from "lucide-react";
import type { HealthSummary, SupportedLanguage } from "../../types/health";
import { LANGUAGES } from "../../lib/constants";
import { glass } from "../../lib/ui";

interface SummaryCardProps {
  summary: HealthSummary;
  isTranslating: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton shimmer
// ---------------------------------------------------------------------------

function SummaryShimmer() {
  return (
    <div
      className={`${glass} p-6 space-y-4 animate-pulse`}
      aria-label="Translating summary, please wait…"
      aria-busy="true"
    >
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-full bg-slate-200" />
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="ml-auto h-5 w-16 rounded-full bg-slate-200" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-full rounded bg-slate-200" />
        <div className="h-3.5 w-5/6 rounded bg-slate-200" />
        <div className="h-3.5 w-4/5 rounded bg-slate-200" />
        <div className="h-3.5 w-3/4 rounded bg-slate-200" />
      </div>
      <div className="space-y-2 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="mt-1.5 h-2 w-2 rounded-full bg-slate-200 shrink-0" />
            <div className="h-3 w-full rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Language label helper
// ---------------------------------------------------------------------------

function languageNativeLabel(lang: SupportedLanguage): string {
  return LANGUAGES.find((l) => l.code === lang)?.nativeLabel ?? lang.toUpperCase();
}

// ---------------------------------------------------------------------------
// SummaryCard
// ---------------------------------------------------------------------------

export function SummaryCard({ summary, isTranslating }: SummaryCardProps) {
  const [lifestyleOpen, setLifestyleOpen] = useState(false);

  if (isTranslating) return <SummaryShimmer />;

  return (
    <div
      className={`${glass} p-6 space-y-5`}
      lang={summary.language}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-bold text-slate-800 flex-1">
          Your health summary
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          {languageNativeLabel(summary.language)}
        </span>
      </div>

      {/* Overview */}
      <p className="text-sm leading-relaxed text-slate-700 summary-text">
        {summary.overview}
      </p>

      {/* Key findings */}
      {summary.key_findings.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Key findings
          </p>
          <ul className="space-y-2">
            {summary.key_findings.map((finding, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 summary-text">
                <span
                  className="mt-[5px] h-2 w-2 shrink-0 rounded-full bg-teal-500"
                  aria-hidden="true"
                />
                {finding}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions for doctor */}
      {summary.questions_for_doctor.length > 0 && (
        <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600">
            <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
            Things to ask your doctor
          </p>
          <ul className="space-y-1.5">
            {summary.questions_for_doctor.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-sky-800 summary-text">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" aria-hidden="true" />
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lifestyle notes — collapsible */}
      {summary.lifestyle_notes.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setLifestyleOpen((o) => !o)}
            aria-expanded={lifestyleOpen}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <span>General wellness notes</span>
            {lifestyleOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            )}
          </button>
          {lifestyleOpen && (
            <ul className="mt-3 space-y-1.5 pl-1">
              {summary.lifestyle_notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 summary-text">
                  <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-500 summary-text">
          {summary.disclaimer}
        </p>
      </div>
    </div>
  );
}
