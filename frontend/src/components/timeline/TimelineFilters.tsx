/**
 * components/timeline/TimelineFilters.tsx
 *
 * Chip toggle group (All, Medications, Labs, Diagnoses, Visits)
 * plus a "Flagged only" switch with a Flag icon.
 */

import { Flag, FlaskConical, CalendarCheck, Pill, Stethoscope } from "lucide-react";
import type { TimelineCategory } from "../../lib/timeline";

interface TimelineFiltersProps {
  category: TimelineCategory;
  onCategoryChange: (c: TimelineCategory) => void;
  flaggedOnly: boolean;
  onFlaggedChange: (v: boolean) => void;
  flaggedCount: number;
}

interface ChipDef {
  value: TimelineCategory;
  label: string;
  icon: React.ElementType;
}

const CHIPS: ChipDef[] = [
  { value: "all", label: "All", icon: CalendarCheck },
  { value: "medication", label: "Meds", icon: Pill },
  { value: "lab", label: "Labs", icon: FlaskConical },
  { value: "diagnosis", label: "Diagnoses", icon: Stethoscope },
];

export function TimelineFilters({
  category,
  onCategoryChange,
  flaggedOnly,
  onFlaggedChange,
  flaggedCount,
}: TimelineFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Category chips */}
      <div
        role="group"
        aria-label="Filter timeline by category"
        className="flex flex-wrap gap-1.5"
      >
        {CHIPS.map(({ value, label, icon: Icon }) => {
          const isActive = category === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onCategoryChange(value)}
              aria-pressed={isActive}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                isActive
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Flagged toggle */}
      {flaggedCount > 0 && (
        <button
          type="button"
          onClick={() => onFlaggedChange(!flaggedOnly)}
          aria-pressed={flaggedOnly}
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
            flaggedOnly
              ? "bg-red-500 text-white shadow-sm"
              : "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100",
          ].join(" ")}
        >
          <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
          Flagged only
          <span
            className={[
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              flaggedOnly ? "bg-red-700 text-white" : "bg-red-100 text-red-700",
            ].join(" ")}
          >
            {flaggedCount}
          </span>
        </button>
      )}
    </div>
  );
}
