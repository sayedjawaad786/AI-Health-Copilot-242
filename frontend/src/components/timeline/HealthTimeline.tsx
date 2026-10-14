/**
 * components/timeline/HealthTimeline.tsx
 *
 * Vertical timeline component with:
 *   - Month-year sticky group headings
 *   - Newest-first default with ArrowUpDown sort toggle
 *   - Category chip filters + Flagged-only switch
 *   - Summary strip with total count and "N flagged" clickable pill
 *   - "Date not available" final group for undated events
 *   - Empty state with Clock icon
 *   - <ol> with aria-label for accessibility
 *   - Reads bundle and language from useHealth()
 */

import { useState } from "react";
import { ArrowUpDown, Clock, Flag } from "lucide-react";
import { useHealth } from "../../context/HealthContext";
import {
  filterEvents,
  groupByMonth,
  sortEvents,
  type TimelineCategory,
} from "../../lib/timeline";
import { TimelineFilters } from "./TimelineFilters";
import { TimelineItem } from "./TimelineItem";
import { glass } from "../../lib/ui";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HealthTimeline() {
  const { bundle, language } = useHealth();

  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [category, setCategory] = useState<TimelineCategory>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  if (!bundle) return null;

  const allEvents = bundle.timeline ?? [];
  const flaggedCount = allEvents.filter(
    (e) =>
      e.severity === "borderline" ||
      e.severity === "abnormal" ||
      e.severity === "critical"
  ).length;

  // Sort → filter → group
  const sorted = sortEvents(allEvents, sortDir);
  const filtered = filterEvents(sorted, category, flaggedOnly);
  const groups = groupByMonth(filtered);

  // ---- Empty state -------------------------------------------------------
  if (allEvents.length === 0) {
    return (
      <div className={`${glass} p-10 flex flex-col items-center gap-3 text-center`}>
        <Clock className="h-10 w-10 text-slate-200" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-400">No timeline events yet.</p>
        <p className="text-xs text-slate-300">Upload a record to get started.</p>
      </div>
    );
  }

  return (
    <div className={`${glass} overflow-hidden`}>
      {/* ── Card header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-slate-100">
        <Clock className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
        <h3 className="text-base font-bold text-slate-800 flex-1">Timeline</h3>

        {/* Sort toggle */}
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          aria-label={`Sort ${sortDir === "desc" ? "oldest first" : "newest first"}`}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:border-teal-300 hover:text-teal-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          {sortDir === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-50 border-b border-slate-100 px-6 py-3">
        <span className="text-xs text-slate-500">
          {allEvents.length} event{allEvents.length !== 1 ? "s" : ""} total
        </span>
        {flaggedCount > 0 && (
          <button
            type="button"
            onClick={() => setFlaggedOnly((f) => !f)}
            aria-pressed={flaggedOnly}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
              flaggedOnly
                ? "bg-red-500 text-white"
                : "bg-red-100 text-red-600 hover:bg-red-200",
            ].join(" ")}
          >
            <Flag className="h-3 w-3" aria-hidden="true" />
            {flaggedCount} flagged
          </button>
        )}
        {filtered.length !== allEvents.length && (
          <span className="text-xs text-slate-400">
            Showing {filtered.length} of {allEvents.length}
          </span>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-slate-100">
        <TimelineFilters
          category={category}
          onCategoryChange={(c) => {
            setCategory(c);
          }}
          flaggedOnly={flaggedOnly}
          onFlaggedChange={setFlaggedOnly}
          flaggedCount={flaggedCount}
        />
      </div>

      {/* ── Timeline body ────────────────────────────────────────────────── */}
      <div className="px-6 py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Clock className="h-8 w-8 text-slate-200" aria-hidden="true" />
            <p className="text-sm text-slate-400">
              No events match the current filter.
            </p>
          </div>
        ) : (
          /*
           * Outer <ol>: semantic container for the full timeline.
           * Rail (border-l-2) lives on each inner per-group <ol> so it does NOT
           * pierce the sticky month headings — each group gets its own rail segment.
           */
          <ol aria-label="Health record timeline" className="space-y-6">
            {groups.map((group) => (
              <li key={group.key}>
                {/* Sticky month heading — top-14 accounts for the app navbar */}
                <div
                  className="sticky top-14 z-10 mb-3 flex items-center gap-3"
                  aria-hidden="true"
                >
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="shrink-0 rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {group.label ?? "Date not available"}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {/* Events — the vertical rail lives here, indented from the card edge */}
                <ol
                  className="relative border-l-2 border-slate-200 ml-4 space-y-0"
                  aria-label={group.label ?? "Events with no date"}
                >
                  {group.events.map((event, i) => (
                    <TimelineItem
                      key={`${group.key}-${i}`}
                      event={event}
                      language={language}
                    />
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
