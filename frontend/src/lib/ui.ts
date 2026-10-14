/**
 * lib/ui.ts
 *
 * Shared class-string constants for the glassmorphism design system.
 * Import these instead of repeating class strings across components.
 *
 * Usage:
 *   import { glass, primaryBtn } from "../../lib/ui";
 *   <div className={`${glass} p-6`}>…</div>
 */

/**
 * Glass card — translucent white panel with blur, shadow and rounded corners.
 * Use for dashboard cards, upload panel, modals, etc.
 */
export const glass =
  "bg-white/70 backdrop-blur-md border border-white/40 shadow-xl shadow-slate-200/50 rounded-2xl";

/**
 * Glass bar — same translucency as `glass` but without rounded corners.
 * Use for the sticky header and the sidebar (which have borders from the layout).
 */
export const glassBar =
  "bg-white/70 backdrop-blur-md border-white/40 shadow-xl shadow-slate-200/50";

/**
 * Primary action button — gradient emerald→teal with a lift on hover.
 * Handles disabled, focus ring, and prefers-reduced-motion.
 */
export const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white " +
  "bg-gradient-to-r from-emerald-600 to-teal-600 " +
  "shadow-lg shadow-emerald-600/25 " +
  "transition-all duration-200 " +
  "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-600/30 " +
  "active:translate-y-0 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/**
 * Ghost / secondary button — translucent glass with teal text.
 * Same shape and motion guards as primaryBtn.
 */
export const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold " +
  "bg-white/60 backdrop-blur-md border border-white/50 text-teal-700 " +
  "shadow-sm " +
  "transition-all duration-200 " +
  "hover:-translate-y-0.5 hover:bg-white/80 " +
  "active:translate-y-0 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0";
