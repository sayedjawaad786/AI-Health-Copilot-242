/**
 * components/common/ErrorBox.tsx
 *
 * Inline error display with AlertCircle icon and optional action button.
 */

import { AlertCircle } from "lucide-react";

interface ErrorBoxProps {
  message: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function ErrorBox({
  message,
  onAction,
  actionLabel = "Try again",
}: ErrorBoxProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <AlertCircle
        className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="leading-snug">{message}</p>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-2 text-xs font-semibold text-red-600 underline hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
