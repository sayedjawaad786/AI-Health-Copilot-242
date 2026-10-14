/**
 * components/common/Spinner.tsx
 *
 * Accessible loading spinner using Lucide's Loader2 with animate-spin.
 * Sizes: "sm" (h-4 w-4), "md" (h-6 w-6, default), "lg" (h-8 w-8).
 */

import { Loader2 } from "lucide-react";

type SpinnerSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

export function Spinner({
  size = "md",
  className = "",
  label = "Loading…",
}: SpinnerProps) {
  return (
    <span role="status" aria-label={label}>
      <Loader2
        className={`animate-spin text-teal-600 ${SIZE_CLASSES[size]} ${className}`}
        aria-hidden="true"
      />
    </span>
  );
}
