/**
 * components/upload/FilePreview.tsx
 *
 * Shows a preview row for the selected file:
 *   - Image files: thumbnail via previewUrl
 *   - PDFs: FileText icon
 *   - File name, human-readable size, Remove button
 */

import { FileText, X } from "lucide-react";

interface FilePreviewProps {
  file: File;
  previewUrl: string | null;
  onRemove: () => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FilePreview({
  file,
  previewUrl,
  onRemove,
  disabled = false,
}: FilePreviewProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      {/* Thumbnail or icon */}
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`Preview of ${file.name}`}
          className="h-14 w-14 shrink-0 rounded-lg object-cover border border-slate-200"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200">
          <FileText className="h-7 w-7 text-slate-400" aria-hidden="true" />
        </div>
      )}

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p
          className="truncate text-sm font-medium text-slate-700"
          title={file.name}
        >
          {file.name}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{formatFileSize(file.size)}</p>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
