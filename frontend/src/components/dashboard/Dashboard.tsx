/**
 * components/dashboard/Dashboard.tsx
 *
 * Composes all dashboard cards in a responsive 3-column grid.
 * Left column (xl:col-span-2): DocumentHeader, SummaryCard, AbnormalAlertCard, LabResultsTable.
 * Right column: MedicationList, DiagnosisList.
 *
 * Includes a "FHIR-style data" button that opens a modal with the raw JSON
 * and a Download JSON option.
 */

import { useState } from "react";
import { Braces, Download, X } from "lucide-react";
import type { HealthRecordBundle } from "../../types/health";
import { useHealth } from "../../context/HealthContext";
import { getFhir } from "../../lib/api";
import { DocumentHeader } from "./DocumentHeader";
import { SummaryCard } from "./SummaryCard";
import { AbnormalAlertCard } from "./AbnormalAlertCard";
import { LabResultsTable } from "./LabResultsTable";
import { MedicationList } from "./MedicationList";
import { DiagnosisList } from "./DiagnosisList";
import { HealthTimeline } from "../timeline/HealthTimeline";
import { Spinner } from "../common/Spinner";
import { glass, ghostBtn } from "../../lib/ui";

// ---------------------------------------------------------------------------
// FHIR modal
// ---------------------------------------------------------------------------

interface FhirModalProps {
  bundle: HealthRecordBundle;
  onClose: () => void;
}

function FhirModal({ bundle, onClose }: FhirModalProps) {
  const [json, setJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    if (json) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const data = await getFhir(bundle.bundle_id);
      setJson(JSON.stringify(data, null, 2));
    } catch {
      setError("Could not fetch FHIR data. Is the backend running?");
      setJson(JSON.stringify(bundle, null, 2)); // fallback to raw bundle
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch on mount
  if (json === null && !loading && !error) {
    handleOpen();
  }

  function handleDownload() {
    const content = json ?? JSON.stringify(bundle, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-copilot-${bundle.bundle_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FHIR-style bundle data"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className={`${glass} relative flex w-full max-w-2xl flex-col overflow-hidden max-h-[85dvh]`}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <Braces className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
          <h2 className="flex-1 text-sm font-bold text-slate-800">
            FHIR-style data export
          </h2>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || !json}
            className={`${ghostBtn} px-3 py-1.5 text-xs`}
            aria-label="Download JSON file"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download JSON
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-3">
              <Spinner size="md" label="Loading FHIR data" />
              <span className="text-sm text-slate-500">Loading FHIR data…</span>
            </div>
          )}
          {error && (
            <p className="mb-3 text-xs text-amber-600">{error} (showing raw bundle)</p>
          )}
          {json && (
            <pre className="text-[11px] leading-relaxed text-slate-600 font-mono whitespace-pre-wrap break-all">
              {json}
            </pre>
          )}
        </div>

        {/* Footer note */}
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-[11px] text-slate-400">
            FHIR-style format only · not full FHIR R4 compliant · for demo purposes
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function Dashboard() {
  const { bundle, isTranslating } = useHealth();
  const [showFhir, setShowFhir] = useState(false);

  if (!bundle) return null;

  return (
    <>
      {/* Dashboard header bar */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Health Record Dashboard</h2>
        <button
          type="button"
          onClick={() => setShowFhir(true)}
          className={`${ghostBtn} px-3 py-1.5 text-sm`}
          aria-label="View FHIR-style data export"
        >
          <Braces className="h-4 w-4" aria-hidden="true" />
          FHIR-style data
        </button>
      </div>

      {/* Responsive grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column — xl:col-span-2 */}
        <div className="xl:col-span-2 space-y-6">
          <DocumentHeader document={bundle.document} />
          <SummaryCard summary={bundle.summary} isTranslating={isTranslating} />
          <AbnormalAlertCard
            observations={bundle.observations}
            explanations={bundle.summary.abnormal_findings_explained}
          />
          <HealthTimeline />
          <LabResultsTable observations={bundle.observations} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <MedicationList medications={bundle.medications} />
          <DiagnosisList diagnoses={bundle.diagnoses} />
        </div>
      </div>

      {/* FHIR modal */}
      {showFhir && (
        <FhirModal bundle={bundle} onClose={() => setShowFhir(false)} />
      )}
    </>
  );
}
