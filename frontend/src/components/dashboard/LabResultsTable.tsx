/**
 * components/dashboard/LabResultsTable.tsx
 *
 * Full table of all observations:
 *   - Columns: Test, Value, Unit, Reference Range, Status, Date
 *   - Tinted row backgrounds + left border stripe for abnormal rows
 *   - Sticky header
 *   - Horizontal scroll wrapper on small screens
 *   - Filter toggle: All / Flagged only
 */

import { useState } from "react";
import type { LabObservation, Severity } from "../../types/health";
import { SeverityBadge } from "./SeverityBadge";
import { FlaskConical } from "lucide-react";
import { glass } from "../../lib/ui";

interface LabResultsTableProps {
  observations: LabObservation[];
}

// ---------------------------------------------------------------------------
// Row tinting
// ---------------------------------------------------------------------------

const ROW_BG: Record<Severity, string> = {
  normal: "",
  borderline: "bg-amber-50/70",
  abnormal: "bg-orange-50/70",
  critical: "bg-red-50/70",
};

const ROW_BORDER: Record<Severity, string> = {
  normal: "border-l-2 border-l-transparent",
  borderline: "border-l-2 border-l-amber-400",
  abnormal: "border-l-2 border-l-orange-400",
  critical: "border-l-2 border-l-red-500",
};

const VALUE_COLOR: Record<Severity, string> = {
  normal: "text-slate-700",
  borderline: "font-semibold text-amber-700",
  abnormal: "font-semibold text-orange-700",
  critical: "font-bold text-red-700",
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Filter = "all" | "flagged";

export function LabResultsTable({ observations }: LabResultsTableProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const displayed =
    filter === "flagged"
      ? observations.filter((o) => o.severity !== "normal")
      : observations;

  const hasFlagged = observations.some((o) => o.severity !== "normal");

  return (
    <div className={`${glass} overflow-hidden`}>
      {/* Card header */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-slate-100">
        <FlaskConical className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
        <h3 className="text-base font-bold text-slate-800 flex-1">Lab Results</h3>

        {/* Filter toggle group */}
        {hasFlagged && (
          <div
            role="group"
            aria-label="Filter lab results"
            className="flex rounded-lg border border-slate-200 overflow-hidden text-sm"
          >
            {(["all", "flagged"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={[
                  "px-3 py-1.5 font-medium capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500",
                  filter === f
                    ? "bg-teal-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                {f === "all" ? "All" : "Flagged only"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <p className="px-6 py-8 text-sm text-center text-slate-400">
          {filter === "flagged"
            ? "No flagged results — all values are within normal range."
            : "No lab observations found in this document."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="sticky top-0 z-10 bg-white/50 backdrop-blur-sm border-b border-slate-200">
              <tr>
                {["Test", "Value", "Unit", "Reference Range", "Status", "Date"].map(
                  (col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayed.map((obs, i) => (
                <tr
                  key={i}
                  id={`timeline-target-${obs.test_name.toLowerCase().replace(/\s+/g, "-")}`}
                  className={[
                    ROW_BG[obs.severity],
                    ROW_BORDER[obs.severity],
                    "transition-colors scroll-mt-20",
                  ].join(" ")}
                >
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {obs.test_name}
                    {obs.loinc_code && (
                      <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-400">
                        {obs.loinc_code}
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${VALUE_COLOR[obs.severity]}`}>
                    {String(obs.value)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{obs.unit ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {obs.reference_range ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={obs.severity} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {formatDate(obs.observed_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
