/**
 * components/layout/Sidebar.tsx
 *
 * Left navigation sidebar. Wired to HealthContext:
 *   - Language selection calls context.changeLanguage()
 *   - Active language derived from context.language ONLY (never bundle.summary.language)
 *   - Patient card reads context.bundle
 *   - Shows Loader2 spinner next to heading while isTranslating (buttons stay enabled)
 */

import { BadgeCheck, Check, HeartPulse, Languages, Loader2 } from "lucide-react";
import { LANGUAGES } from "../../lib/constants";
import { useHealth } from "../../context/HealthContext";

// ---------------------------------------------------------------------------
// ABHA masking helper
// ---------------------------------------------------------------------------

function maskAbha(abhaNumber: string): string {
  const parts = abhaNumber.split("-");
  if (parts.length !== 4) return abhaNumber;
  return `XX-XXXX-XXXX-${parts[3]}`;
}

// ---------------------------------------------------------------------------
// Patient card
// ---------------------------------------------------------------------------

function PatientCard() {
  const { bundle } = useHealth();

  if (!bundle) {
    return (
      <div className="space-y-2 rounded-xl border border-white/50 bg-white/50 backdrop-blur-sm p-3">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-200/80" />
        <div className="h-3 w-full animate-pulse rounded bg-slate-200/80" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/80" />
        <p className="mt-1 text-xs text-slate-400">
          Upload or load demo to see patient info
        </p>
      </div>
    );
  }

  const { patient } = bundle;

  return (
    <div className="rounded-xl border border-white/50 bg-white/50 backdrop-blur-sm p-3 space-y-1.5">
      <p className="text-sm font-semibold text-slate-800 truncate">{patient.name}</p>
      <p className="font-mono text-xs text-slate-500">{maskAbha(patient.abha_number)}</p>
      <p className="text-xs text-slate-500 truncate">{patient.abha_address}</p>
      {patient.year_of_birth && (
        <p className="text-xs text-slate-400">Born {patient.year_of_birth}</p>
      )}
      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-white/60 px-2 py-1">
        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="text-[11px] leading-tight text-slate-500">
          Demo ABHA — not a real ID
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar() {
  // Active language must ONLY come from context.language — never from bundle.summary.language
  const { language, changeLanguage, isTranslating } = useHealth();

  return (
    <nav
      className="flex h-full flex-col overflow-y-auto"
      aria-label="Main navigation"
    >
      {/* ── Brand ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-white/30 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-600/25">
          <HeartPulse className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800">Health Copilot</p>
          <p className="truncate text-[11px] text-slate-400 leading-tight">
            Powered by ABDM-aligned records
          </p>
        </div>
      </div>

      {/* ── Language selector ──────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-2">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Language / भाषा</span>
          {/* Spinner while translating — buttons stay enabled */}
          {isTranslating && (
            <Loader2
              className="ml-auto h-3.5 w-3.5 animate-spin text-teal-500"
              aria-label="Translating summary…"
            />
          )}
        </div>

        <div
          role="radiogroup"
          aria-label="Select summary language"
          className="space-y-1.5"
        >
          {LANGUAGES.map((lang) => {
            // Active state ONLY from context.language — instant optimistic update
            const active = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => changeLanguage(lang.code)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left border transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                  active
                    ? "bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border-teal-500/60 ring-1 ring-teal-500/30"
                    : "bg-white/40 border-white/50 hover:bg-white/70",
                ].join(" ")}
              >
                {/* Language labels */}
                <div className="flex-1 min-w-0">
                  <p
                    className={[
                      "text-base font-semibold leading-tight",
                      active ? "text-teal-800" : "text-slate-700",
                    ].join(" ")}
                  >
                    {lang.nativeLabel}
                  </p>
                  <p
                    className={[
                      "text-xs",
                      active ? "text-teal-600" : "text-slate-400",
                    ].join(" ")}
                  >
                    {lang.label}
                  </p>
                </div>

                {/* Active: filled gradient circle with Check icon */}
                {/* Inactive: empty bordered circle */}
                <div
                  aria-hidden="true"
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-150",
                    active
                      ? "bg-gradient-to-br from-emerald-600 to-teal-600 shadow-sm"
                      : "border-2 border-slate-300 bg-transparent",
                  ].join(" ")}
                >
                  {active && (
                    <Check className="h-3 w-3 text-white" aria-hidden="true" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Patient card ───────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Patient
        </p>
        <PatientCard />
      </div>

      <div className="flex-1" />

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="border-t border-white/30 px-5 py-3">
        <p className="text-[11px] leading-relaxed text-slate-400">
          Hackathon prototype · HacXLerate · Altrix Labs
        </p>
      </div>
    </nav>
  );
}

