/**
 * components/dashboard/DiagnosisList.tsx
 *
 * Compact list of diagnoses: Stethoscope icon, name, status chip,
 * ICD-10 code in mono font, plain-language explanation.
 */

import { Stethoscope } from "lucide-react";
import type { Diagnosis } from "../../types/health";
import { glass } from "../../lib/ui";

interface DiagnosisListProps {
  diagnoses: Diagnosis[];
}

const STATUS_CLASSES: Record<string, string> = {
  active:
    "bg-red-50 border border-red-200 text-red-700",
  resolved:
    "bg-emerald-50 border border-emerald-200 text-emerald-700",
  "in remission":
    "bg-amber-50 border border-amber-200 text-amber-700",
};

function statusClass(status: string | null | undefined): string {
  if (!status) return "bg-slate-100 text-slate-500";
  return STATUS_CLASSES[status.toLowerCase()] ?? "bg-slate-100 border border-slate-200 text-slate-600";
}

function DiagnosisItem({ dx }: { dx: Diagnosis }) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/50 backdrop-blur-sm p-4 space-y-2.5">
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-2">
        <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <p className="flex-1 font-semibold text-slate-800 leading-snug min-w-0">
          {dx.name}
        </p>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {dx.status && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusClass(dx.status)}`}
          >
            {dx.status}
          </span>
        )}
        {dx.icd10_code && (
          <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 font-mono text-xs text-slate-600">
            ICD-10: {dx.icd10_code}
          </span>
        )}
        {dx.noted_date && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
            Since {new Date(dx.noted_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
          </span>
        )}
      </div>

      {/* Plain-language explanation */}
      {dx.plain_language_explanation && (
        <div className="rounded-lg bg-white border border-slate-200 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-slate-600 summary-text">
            {dx.plain_language_explanation}
          </p>
        </div>
      )}
    </div>
  );
}

export function DiagnosisList({ diagnoses }: DiagnosisListProps) {
  return (
    <div className={`${glass} p-6 space-y-4`}>
      <div className="flex items-center gap-2.5">
        <Stethoscope className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
        <h3 className="text-base font-bold text-slate-800">Diagnoses</h3>
        {diagnoses.length > 0 && (
          <span className="ml-auto rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {diagnoses.length}
          </span>
        )}
      </div>

      {diagnoses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
          <p className="text-sm text-slate-400">
            No diagnoses recorded in this document.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {diagnoses.map((dx, i) => (
            <DiagnosisItem key={i} dx={dx} />
          ))}
        </div>
      )}
    </div>
  );
}
