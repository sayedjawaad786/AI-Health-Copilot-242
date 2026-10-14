/**
 * components/layout/DisclaimerBanner.tsx
 *
 * Always-visible amber banner at the top of the main content area.
 * Not dismissible — this is a medical safety requirement.
 */

import { ShieldAlert } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <div
      role="note"
      aria-label="Medical disclaimer"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <ShieldAlert
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
        aria-hidden="true"
      />
      <p className="leading-relaxed">
        <strong className="font-semibold">AI-generated summary for understanding only.</strong>{" "}
        Not medical advice. Always consult your doctor before making any health
        decisions.
      </p>
    </div>
  );
}
