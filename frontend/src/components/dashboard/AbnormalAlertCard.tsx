/**
 * components/dashboard/AbnormalAlertCard.tsx
 *
 * Rendered only when at least one observation is borderline/abnormal/critical.
 * Shows a range bar, severity badge, explanation, and urgent notice for critical.
 */

import { Activity } from "lucide-react";
import type { LabObservation, Severity } from "../../types/health";
import { SeverityBadge } from "./SeverityBadge";
import { glass } from "../../lib/ui";

interface AbnormalAlertCardProps {
  observations: LabObservation[];
  /** Matched explanations from summary.abnormal_findings_explained */
  explanations: string[];
}

// ---------------------------------------------------------------------------
// Severity ordering
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  abnormal: 1,
  borderline: 2,
  normal: 3,
};

const LEFT_BORDER_COLOR: Record<Severity, string> = {
  critical: "border-l-red-500",
  abnormal: "border-l-orange-400",
  borderline: "border-l-amber-400",
  normal: "border-l-emerald-400",
};

// ---------------------------------------------------------------------------
// Range bar
// ---------------------------------------------------------------------------

interface RangeBarProps {
  value: number | string;
  low: number | null;
  high: number | null;
  severity: Severity;
}

const DOT_COLOR: Record<Severity, string> = {
  normal: "bg-emerald-500",
  borderline: "bg-amber-500",
  abnormal: "bg-orange-500",
  critical: "bg-red-500",
};

function RangeBar({ value, low, high, severity }: RangeBarProps) {
  const numVal = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(numVal) || (low === null && high === null)) return null;

  // Build a display range that always includes the patient value
  const lo = low ?? numVal * 0.5;
  const hi = high ?? numVal * 1.5;
  const trackLo = Math.min(lo, numVal) * 0.85;
  const trackHi = Math.max(hi, numVal) * 1.15;
  const span = trackHi - trackLo || 1;

  // Green zone (reference range) as percentages of the track
  const greenLeft = Math.max(0, ((lo - trackLo) / span) * 100);
  const greenWidth = Math.min(100, ((hi - lo) / span) * 100);

  // Dot position (patient value), clamped to track
  const dotPct = Math.min(100, Math.max(0, ((numVal - trackLo) / span) * 100));

  return (
    <div className="relative h-3 w-full rounded-full bg-slate-100 overflow-visible" aria-hidden="true">
      {/* Green reference zone */}
      <div
        className="absolute top-0 h-full rounded-full bg-emerald-200"
        style={{ left: `${greenLeft}%`, width: `${greenWidth}%` }}
      />
      {/* Patient value dot */}
      <div
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white shadow ${DOT_COLOR[severity]}`}
        style={{ left: `${dotPct}%` }}
        title={`Your value: ${numVal}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Find best explanation from summary text for a given test name
// ---------------------------------------------------------------------------

function findExplanation(testName: string, explanations: string[]): string | null {
  const lower = testName.toLowerCase();
  return (
    explanations.find((e) => e.toLowerCase().includes(lower)) ?? null
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AbnormalAlertCard({
  observations,
  explanations,
}: AbnormalAlertCardProps) {
  const flagged = observations
    .filter((o) => o.severity !== "normal")
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (flagged.length === 0) return null;

  // Highest severity among flagged items
  const highest = flagged[0].severity;

  return (
    <div
      className={`${glass} border-l-4 ${LEFT_BORDER_COLOR[highest]} p-6 space-y-5`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Activity className="h-5 w-5 text-slate-500 shrink-0" aria-hidden="true" />
        <h3 className="text-base font-bold text-slate-800 flex-1">
          Values that need your attention
        </h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {flagged.length} {flagged.length === 1 ? "value" : "values"}
        </span>
      </div>

      {/* Flagged observations */}
      <div className="space-y-5">
        {flagged.map((obs, i) => {
          const explanation =
            findExplanation(obs.test_name, explanations) ??
            obs.interpretation ??
            null;
          const numVal = typeof obs.value === "number" ? obs.value : null;

          return (
            <div key={i} className="space-y-2.5">
              {/* Test name + badge */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">
                  {obs.test_name}
                </span>
                <SeverityBadge severity={obs.severity} />
                {obs.loinc_code && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                    LOINC {obs.loinc_code}
                  </span>
                )}
              </div>

              {/* Value row */}
              <p className="text-sm text-slate-600">
                <strong>Your value:</strong>{" "}
                <span
                  className={
                    obs.severity === "critical"
                      ? "font-bold text-red-600"
                      : obs.severity === "abnormal"
                      ? "font-semibold text-orange-600"
                      : "font-semibold text-amber-600"
                  }
                >
                  {obs.value}
                  {obs.unit ? ` ${obs.unit}` : ""}
                </span>
                {obs.reference_range && (
                  <span className="text-slate-400">
                    {" "}· Normal: {obs.reference_range}
                  </span>
                )}
              </p>

              {/* Range bar */}
              {numVal !== null && (
                <RangeBar
                  value={numVal}
                  low={obs.reference_low ?? null}
                  high={obs.reference_high ?? null}
                  severity={obs.severity}
                />
              )}

              {/* Critical urgent notice */}
              {obs.severity === "critical" && (
                <p className="text-sm font-bold text-red-600">
                  ⚠ Please contact your doctor promptly about this result.
                </p>
              )}

              {/* Explanation */}
              {explanation && (
                <p className="text-sm leading-relaxed text-slate-500 summary-text">
                  {explanation}
                </p>
              )}

              {/* Divider (not after last item) */}
              {i < flagged.length - 1 && (
                <hr className="border-slate-100" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
