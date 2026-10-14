/**
 * lib/timeline.ts
 *
 * Pure helpers for grouping and sorting TimelineEvents.
 * No React dependencies — these are plain functions so they can be
 * unit-tested without rendering.
 */

import type { TimelineEvent } from "../types/health";

// ---------------------------------------------------------------------------
// Severity ordering (lower = more urgent = sorts first)
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  abnormal: 1,
  borderline: 2,
  normal: 3,
};

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

/** Parse an ISO date string to a comparable timestamp, or Infinity for null. */
function toTimestamp(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  const ms = Date.parse(dateStr);
  return isNaN(ms) ? Infinity : ms;
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/**
 * Sort events newest-first or oldest-first.
 * Events with no date always go to the end regardless of sort direction.
 */
export function sortEvents(
  events: TimelineEvent[],
  direction: "desc" | "asc"
): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const ta = toTimestamp(a.date);
    const tb = toTimestamp(b.date);

    // Both undated → preserve original order relative to each other
    if (ta === Infinity && tb === Infinity) return 0;
    // Undated always last
    if (ta === Infinity) return 1;
    if (tb === Infinity) return -1;

    const timeDiff = direction === "desc" ? tb - ta : ta - tb;
    if (timeDiff !== 0) return timeDiff;

    // Same date: sort by severity (critical first)
    return (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3);
  });
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

export interface TimelineGroup {
  /** e.g. "October 2024" or null for the undated group */
  label: string | null;
  /** Unique key for React */
  key: string;
  events: TimelineEvent[];
}

/** Format a date string into a "Month YYYY" heading. */
function monthYearLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Group a sorted list of events by month-year.
 * Undated events form the final group labelled null.
 */
export function groupByMonth(events: TimelineEvent[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  const groupMap = new Map<string, TimelineGroup>();

  for (const ev of events) {
    if (!ev.date) {
      // Undated bucket
      const key = "__undated__";
      if (!groupMap.has(key)) {
        const g: TimelineGroup = { label: null, key, events: [] };
        groupMap.set(key, g);
        groups.push(g);
      }
      groupMap.get(key)!.events.push(ev);
    } else {
      const label = monthYearLabel(ev.date);
      if (!groupMap.has(label)) {
        const g: TimelineGroup = { label, key: label, events: [] };
        groupMap.set(label, g);
        groups.push(g);
      }
      groupMap.get(label)!.events.push(ev);
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export type TimelineCategory = "all" | "medication" | "lab" | "diagnosis" | "visit";

export function filterEvents(
  events: TimelineEvent[],
  category: TimelineCategory,
  flaggedOnly: boolean
): TimelineEvent[] {
  let result = events;
  if (category !== "all") {
    result = result.filter((e) => e.category === category);
  }
  if (flaggedOnly) {
    result = result.filter(
      (e) => e.severity === "borderline" || e.severity === "abnormal" || e.severity === "critical"
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Locale mapping (for Intl.DateTimeFormat)
// ---------------------------------------------------------------------------

export const LOCALE_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  te: "te-IN",
  ta: "ta-IN",
};

/** Format an ISO date string using the given language locale. */
export function formatEventDate(
  dateStr: string | null | undefined,
  languageCode: string
): string {
  if (!dateStr) return "Date not available";
  const locale = LOCALE_MAP[languageCode] ?? "en-IN";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Scroll + highlight helper
// ---------------------------------------------------------------------------

/**
 * Scroll to an element by id and briefly apply a highlight ring class.
 * Respects prefers-reduced-motion: skips scroll behaviour and animation.
 */
export function scrollAndHighlight(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  el.scrollIntoView({
    behavior: prefersReduced ? "auto" : "smooth",
    block: "center",
  });

  if (prefersReduced) return;

  el.classList.add("ring-4", "ring-teal-400", "ring-offset-2", "transition-shadow");
  setTimeout(() => {
    el.classList.remove("ring-4", "ring-teal-400", "ring-offset-2", "transition-shadow");
  }, 2000);
}
