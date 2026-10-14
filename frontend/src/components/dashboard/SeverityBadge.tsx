/**
 * components/dashboard/SeverityBadge.tsx
 *
 * Accessible pill badge: always shows an icon + text label.
 * Critical adds a subtle animate-pulse ring.
 */

import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Severity } from "../../types/health";

interface SeverityBadgeProps {
  severity: Severity;
  /** Override the default label (defaults to capitalised severity name) */
  label?: string;
  size?: "sm" | "md";
}

const CONFIG: Record<
  Severity,
  {
    icon: React.ElementType;
    text: string;
    classes: string;
    ringClass?: string;
  }
> = {
  normal: {
    icon: CheckCircle2,
    text: "Normal",
    classes: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
  borderline: {
    icon: AlertTriangle,
    text: "Borderline",
    classes: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  abnormal: {
    icon: AlertTriangle,
    text: "Abnormal",
    classes: "bg-orange-100 text-orange-700 border border-orange-200",
  },
  critical: {
    icon: AlertOctagon,
    text: "Critical",
    classes: "bg-red-100 text-red-700 border border-red-200",
    ringClass: "animate-pulse ring-2 ring-red-300",
  },
};

export function SeverityBadge({ severity, label, size = "sm" }: SeverityBadgeProps) {
  const cfg = CONFIG[severity] ?? CONFIG.normal;
  const Icon = cfg.icon;
  const displayLabel = label ?? cfg.text;
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      role="img"
      aria-label={`Severity: ${displayLabel}`}
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
        textSize,
        cfg.classes,
        cfg.ringClass ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon className={`${iconSize} shrink-0`} aria-hidden="true" />
      {displayLabel}
    </span>
  );
}
