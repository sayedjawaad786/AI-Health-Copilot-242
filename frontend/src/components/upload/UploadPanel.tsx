/**
 * components/upload/UploadPanel.tsx
 *
 * Polished drag-and-drop upload zone with:
 *   - Drag-over visual feedback
 *   - Client-side MIME type + size validation
 *   - File preview row (FilePreview component)
 *   - Rotating status messages during analysis
 *   - Collapsed "Upload another" bar after success
 *   - Mobile "Take photo" capture input
 *   - Full accessibility (aria-live, labels, keyboard)
 */

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { Camera, Sparkles, UploadCloud } from "lucide-react";
import { useHealth } from "../../context/HealthContext";
import { FilePreview } from "./FilePreview";
import { ErrorBox } from "../common/ErrorBox";
import { Spinner } from "../common/Spinner";
import { useRotatingMessage } from "../../hooks/useRotatingMessage";
import { glass, primaryBtn, ghostBtn } from "../../lib/ui";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_MIME: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ANALYSIS_MESSAGES = [
  "Reading your document…",
  "Extracting medicines and test values…",
  "Checking values against reference ranges…",
  "Writing your plain-language summary…",
] as const;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return `File type "${file.type || "unknown"}" is not supported. Please upload a JPG, PNG, WEBP, or PDF.`;
  }
  if (file.size > MAX_BYTES) {
    return `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 10 MB.`;
  }
  return null;
}

function createPreviewUrl(file: File): string | null {
  if (file.type.startsWith("image/")) {
    return URL.createObjectURL(file);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Collapsed "upload another" bar
// ---------------------------------------------------------------------------

function CollapsedBar({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className={`${ghostBtn} w-full border-dashed border-slate-300`}
    >
      <UploadCloud className="h-4 w-4" aria-hidden="true" />
      Upload another record
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main UploadPanel
// ---------------------------------------------------------------------------

export function UploadPanel() {
  const { state, analyze, reset, dispatch } = useHealth();
  const { status, file, previewUrl, error } = state;

  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isAnalyzing = status === "uploading" || status === "analyzing";

  // Rotating status message during analysis
  const rotatingMessage = useRotatingMessage(
    ANALYSIS_MESSAGES,
    2500,
    isAnalyzing
  );

  // After a successful analysis, show the collapsed bar
  // Collapse only after first success; expand resets to show the panel
  const showCollapsed = status === "success" && collapsed;

  // ---- File selection logic ----------------------------------------------

  const handleFileSelected = useCallback(
    (selectedFile: File) => {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setLocalError(validationError);
        return;
      }
      setLocalError(null);
      const url = createPreviewUrl(selectedFile);
      dispatch({
        type: "SET_FILE",
        payload: { file: selectedFile, previewUrl: url },
      });
    },
    [dispatch]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFileSelected(selectedFile);
      // Reset input value so re-selecting same file triggers onChange
      e.target.value = "";
    },
    [handleFileSelected]
  );

  // ---- Drag-and-drop handlers --------------------------------------------

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) handleFileSelected(droppedFile);
    },
    [handleFileSelected]
  );

  // ---- Remove file -------------------------------------------------------

  const handleRemove = useCallback(() => {
    dispatch({ type: "SET_FILE", payload: { file: state.file!, previewUrl: null } });
    reset();
    setLocalError(null);
    setCollapsed(false);
  }, [dispatch, reset, state.file]);

  // ---- Analyze -----------------------------------------------------------

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    await analyze(file);
    setCollapsed(true);
  }, [analyze, file]);

  // ---- Collapsed state ---------------------------------------------------

  if (showCollapsed) {
    return <CollapsedBar onExpand={() => setCollapsed(false)} />;
  }

  // ---- Main render -------------------------------------------------------

  const currentError = localError ?? (status === "error" ? error : null);

  return (
    <div className={`${glass} p-6 space-y-4`}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a health document here, or click to browse files"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !file) {
            fileInputRef.current?.click();
          }
        }}
        className={[
          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-150 cursor-pointer select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
          dragOver
            ? "scale-[1.01] border-teal-500 bg-teal-50"
            : file
            ? "border-teal-300 bg-teal-50/40 cursor-default"
            : "border-teal-300 bg-teal-50/40 hover:border-teal-400 hover:bg-teal-50",
        ].join(" ")}
      >
        <div
          className={[
            "flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
            dragOver ? "bg-teal-200" : "bg-teal-100",
          ].join(" ")}
        >
          <UploadCloud
            className={[
              "h-7 w-7 transition-colors",
              dragOver ? "text-teal-700" : "text-teal-600",
            ].join(" ")}
            aria-hidden="true"
          />
        </div>

        <div>
          <p className="text-base font-semibold text-slate-700">
            Upload a prescription or lab report
          </p>
          <p className="mt-1 text-sm text-slate-400 leading-relaxed">
            JPG, PNG, WEBP or PDF · up to 10 MB
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            Handwritten and Hindi / Telugu / Tamil documents supported
          </p>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleInputChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
        {/* Camera input — mobile only */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Action buttons when no file selected */}
      {!file && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${ghostBtn} flex-1`}
          >
            Browse files
          </button>
          {/* Camera button — hidden on desktop via CSS, shown on mobile */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className={`${ghostBtn} sm:hidden`}
            aria-label="Take a photo of your document"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            Camera
          </button>
        </div>
      )}

      {/* File preview + analyze button */}
      {file && (
        <div className="space-y-3">
          <FilePreview
            file={file}
            previewUrl={previewUrl}
            onRemove={handleRemove}
            disabled={isAnalyzing}
          />

          {/* Analyze button / analyzing state */}
          {!isAnalyzing ? (
            <button
              type="button"
              onClick={handleAnalyze}
              className={`${primaryBtn} w-full`}
              disabled={isAnalyzing}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Analyze record
            </button>
          ) : (
            <div
              aria-live="polite"
              aria-atomic="true"
              className="flex items-center justify-center gap-3 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3"
            >
              <Spinner size="sm" label="Analysing document" />
              <p className="text-sm font-medium text-teal-700 transition-all duration-300">
                {rotatingMessage}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Validation / API error */}
      {currentError && (
        <ErrorBox
          message={currentError}
          onAction={status === "error" ? () => {
            dispatch({ type: "ANALYSIS_ERROR", payload: "" });
            setLocalError(null);
          } : undefined}
          actionLabel="Dismiss"
        />
      )}
    </div>
  );
}
