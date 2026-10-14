/**
 * components/dashboard/DocumentHeader.tsx
 *
 * Shows document type, date, provider/facility, detected-language chips,
 * handwritten indicator, and a low/medium OCR confidence amber warning.
 */

import {
  FileText,
  FlaskConical,
  Languages,
  PenLine,
  Pill,
  AlertTriangle,
  CalendarDays,
  UserRound,
  Building2,
} from "lucide-react";
import type { DocumentMeta } from "../../types/health";
import { glass } from "../../lib/ui";

interface DocumentHeaderProps {
  document: DocumentMeta;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  te: "తెలుగు",
  ta: "தமிழ்",
};

function DocTypeIcon({ type }: { type: DocumentMeta["document_type"] }) {
  const cls = "h-6 w-6 text-teal-600";
  switch (type) {
    case "prescription":
      return <Pill className={cls} aria-hidden="true" />;
    case "lab_report":
      return <FlaskConical className={cls} aria-hidden="true" />;
    default:
      return <FileText className={cls} aria-hidden="true" />;
  }
}

const DOC_TYPE_LABELS: Record<DocumentMeta["document_type"], string> = {
  prescription: "Prescription",
  lab_report: "Lab Report",
  discharge_summary: "Discharge Summary",
  other: "Health Document",
};

export function DocumentHeader({ document }: DocumentHeaderProps) {
  const showOcrWarning =
    document.ocr_confidence === "low" || document.ocr_confidence === "medium";

  return (
    <div className={`${glass} p-6 space-y-4`}>
      {/* Type + title row */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 border border-teal-100">
          <DocTypeIcon type={document.document_type} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-800">
            {DOC_TYPE_LABELS[document.document_type]}
          </h2>
          {document.document_date && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {new Date(document.document_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Provider / facility */}
      {(document.provider_name || document.facility_name) && (
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          {document.provider_name && (
            <div className="flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span>{document.provider_name}</span>
            </div>
          )}
          {document.facility_name && (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span>{document.facility_name}</span>
            </div>
          )}
        </div>
      )}

      {/* Language chips + handwritten badge */}
      <div className="flex flex-wrap items-center gap-2">
        {document.detected_languages.length > 0 && (
          <>
            <Languages className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            {document.detected_languages.map((lang) => (
              <span
                key={lang}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
              >
                {LANGUAGE_NAMES[lang] ?? lang.toUpperCase()}
              </span>
            ))}
          </>
        )}
        {document.is_handwritten && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 border border-violet-200">
            <PenLine className="h-3 w-3 shrink-0" aria-hidden="true" />
            Handwritten
          </span>
        )}
      </div>

      {/* OCR confidence warning */}
      {showOcrWarning && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <p className="leading-snug">
            <strong className="font-semibold">Some text was hard to read.</strong>{" "}
            Please verify medicine names and values against your original document.
          </p>
        </div>
      )}
    </div>
  );
}
