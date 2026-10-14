/**
 * components/dashboard/MedicationList.tsx
 *
 * Cards per medication: name, generic name, dosage/frequency/duration chips,
 * instructions, plain-language explanation in a slate-50 box.
 */

import { CalendarDays, Clock, Pill } from "lucide-react";
import type { Medication } from "../../types/health";
import { glass } from "../../lib/ui";

interface MedicationListProps {
  medications: Medication[];
}

// ---------------------------------------------------------------------------
// Single medication card
// ---------------------------------------------------------------------------

function MedicationCard({ med }: { med: Medication }) {
  const id = `timeline-target-${med.name.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div
      id={id}
      className="rounded-xl border border-white/60 bg-white/50 backdrop-blur-sm p-4 space-y-3 scroll-mt-20"
    >
      {/* Name row */}
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100">
          <Pill className="h-4 w-4 text-teal-600" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 leading-tight">{med.name}</p>
          {med.generic_name && (
            <p className="text-xs text-slate-400 mt-0.5">{med.generic_name}</p>
          )}
        </div>
      </div>

      {/* Chip row */}
      <div className="flex flex-wrap gap-2">
        {med.dosage && (
          <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-medium text-teal-700">
            {med.dosage}
          </span>
        )}
        {med.frequency && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {med.frequency}
          </span>
        )}
        {med.duration && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            <CalendarDays className="h-3 w-3" aria-hidden="true" />
            {med.duration}
          </span>
        )}
        {med.route && (
          <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500">
            {med.route}
          </span>
        )}
      </div>

      {/* Instructions */}
      {med.instructions && (
        <p className="text-xs text-slate-500 leading-snug italic">
          {med.instructions}
        </p>
      )}

      {/* Plain-language explanation */}
      {med.plain_language_explanation && (
        <div className="rounded-lg bg-white border border-slate-200 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-slate-600 summary-text">
            {med.plain_language_explanation}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function MedicationList({ medications }: MedicationListProps) {
  return (
    <div className={`${glass} p-6 space-y-4`}>
      <div className="flex items-center gap-2.5">
        <Pill className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
        <h3 className="text-base font-bold text-slate-800">Medications</h3>
        {medications.length > 0 && (
          <span className="ml-auto rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
            {medications.length}
          </span>
        )}
      </div>

      {medications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
          <p className="text-sm text-slate-400">
            No medicines found in this document.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {medications.map((med, i) => (
            <MedicationCard key={i} med={med} />
          ))}
        </div>
      )}
    </div>
  );
}
