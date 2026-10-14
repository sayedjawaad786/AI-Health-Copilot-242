/**
 * context/HealthContext.tsx
 *
 * Full useReducer-based state management for Health Copilot.
 *
 * State shape:
 *   language      – persisted to localStorage; drives summarization language
 *   status        – "idle" | "uploading" | "analyzing" | "success" | "error"
 *   bundle        – HealthRecordBundle | null
 *   file          – File | null (the selected document)
 *   previewUrl    – object URL for image previews; null for PDFs or no file
 *   error         – string | null
 *   isTranslating – true while a translate-only request is in flight
 *
 * Async helpers exposed on the context:
 *   analyze(file)          – full pipeline: uploading → analyzing → success/error
 *   changeLanguage(code)   – sets language; if bundle exists, translates in-place
 *   loadSample()           – fetches GET /api/records/sample
 *   reset()                – clears everything, revokes object URL
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
  type Dispatch,
} from "react";
import type { HealthRecordBundle, SupportedLanguage } from "../types/health";
import { analyzeRecord, getSample, translateSummary } from "../lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LS_LANGUAGE_KEY = "hc_language";

function readStoredLanguage(): SupportedLanguage {
  try {
    const v = localStorage.getItem(LS_LANGUAGE_KEY);
    if (v === "en" || v === "hi" || v === "te" || v === "ta") return v;
  } catch {
    // localStorage may be unavailable in some contexts
  }
  return "en";
}

function persistLanguage(lang: SupportedLanguage): void {
  try {
    localStorage.setItem(LS_LANGUAGE_KEY, lang);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// State & actions
// ---------------------------------------------------------------------------

export type AnalysisStatus =
  | "idle"
  | "uploading"
  | "analyzing"
  | "success"
  | "error";

export interface HealthState {
  language: SupportedLanguage;
  status: AnalysisStatus;
  bundle: HealthRecordBundle | null;
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  isTranslating: boolean;
}

type Action =
  | { type: "SET_LANGUAGE"; payload: SupportedLanguage }
  | { type: "SET_FILE"; payload: { file: File; previewUrl: string | null } }
  | { type: "START_ANALYSIS" }
  | { type: "ANALYSIS_SUCCESS"; payload: HealthRecordBundle }
  | { type: "ANALYSIS_ERROR"; payload: string }
  | { type: "TRANSLATE_START" }
  | { type: "TRANSLATE_SUCCESS"; payload: HealthRecordBundle }
  | { type: "TRANSLATE_ERROR"; payload: string }
  | { type: "RESET" }
  | { type: "LOAD_SAMPLE"; payload: HealthRecordBundle };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function initialState(): HealthState {
  return {
    language: readStoredLanguage(),
    status: "idle",
    bundle: null,
    file: null,
    previewUrl: null,
    error: null,
    isTranslating: false,
  };
}

function reducer(state: HealthState, action: Action): HealthState {
  switch (action.type) {
    case "SET_LANGUAGE":
      return { ...state, language: action.payload };

    case "SET_FILE":
      // Revoke any existing preview URL to avoid memory leaks
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      return {
        ...state,
        file: action.payload.file,
        previewUrl: action.payload.previewUrl,
        error: null,
        // Reset to idle when a new file is selected after a previous success/error
        status: state.status === "success" ? "success" : "idle",
      };

    case "START_ANALYSIS":
      return { ...state, status: "uploading", error: null };

    case "ANALYSIS_SUCCESS":
      return {
        ...state,
        status: "success",
        bundle: action.payload,
        error: null,
      };

    case "ANALYSIS_ERROR":
      return { ...state, status: "error", error: action.payload };

    case "TRANSLATE_START":
      return { ...state, isTranslating: true, error: null };

    case "TRANSLATE_SUCCESS":
      // Swap ONLY the summary — preserve everything else in the dashboard
      return {
        ...state,
        isTranslating: false,
        bundle: state.bundle
          ? { ...state.bundle, summary: action.payload.summary }
          : action.payload,
      };

    case "TRANSLATE_ERROR":
      return { ...state, isTranslating: false, error: action.payload };

    case "RESET":
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      return initialState();

    case "LOAD_SAMPLE":
      return {
        ...state,
        status: "success",
        bundle: action.payload,
        error: null,
        file: null,
        previewUrl: null,
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface HealthContextValue {
  state: HealthState;
  dispatch: Dispatch<Action>;
  // Convenience derived values
  language: SupportedLanguage;
  bundle: HealthRecordBundle | null;
  status: AnalysisStatus;
  error: string | null;
  isTranslating: boolean;
  // Async helpers
  analyze: (file: File) => Promise<void>;
  changeLanguage: (code: SupportedLanguage) => Promise<void>;
  loadSample: () => Promise<void>;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Context + hook
// ---------------------------------------------------------------------------

const HealthContext = createContext<HealthContextValue | null>(null);

export function useHealth(): HealthContextValue {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used within <HealthProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface HealthProviderProps {
  children: ReactNode;
}

export function HealthProvider({ children }: HealthProviderProps) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // ---- analyze ------------------------------------------------------------
  const analyze = useCallback(
    async (file: File) => {
      dispatch({ type: "START_ANALYSIS" });
      // Brief pause in "uploading" so the UI shows it before we flip to analyzing
      await new Promise((r) => setTimeout(r, 400));
      // We use a second status transition via a custom approach — the status
      // moves to "uploading" first (START_ANALYSIS), then after the actual
      // network call begins it stays there; the rotating message in UploadPanel
      // handles the visual cycle. On success/error we update accordingly.
      try {
        const bundle = await analyzeRecord(file, state.language);
        dispatch({ type: "ANALYSIS_SUCCESS", payload: bundle });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Analysis failed. Please check the backend and try again.";
        dispatch({ type: "ANALYSIS_ERROR", payload: msg });
      }
    },
    [state.language]
  );

  // ---- changeLanguage -----------------------------------------------------
  const changeLanguage = useCallback(
    async (code: SupportedLanguage) => {
      // Return early if already on this language
      if (code === state.language) return;

      const prevLanguage = state.language;

      // ── Optimistic update: immediately move the UI highlight ─────────────
      dispatch({ type: "SET_LANGUAGE", payload: code });
      try {
        persistLanguage(code);
      } catch {
        // ignore localStorage failures
      }

      if (!state.bundle) return; // no bundle — just update stored preference

      // ── Translate the summary in-place ───────────────────────────────────
      dispatch({ type: "TRANSLATE_START" });
      try {
        const translated = await translateSummary(state.bundle.bundle_id, code);
        dispatch({ type: "TRANSLATE_SUCCESS", payload: translated });
      } catch (err) {
        // ── Rollback: restore previous language in state and localStorage ──
        dispatch({ type: "SET_LANGUAGE", payload: prevLanguage });
        try {
          persistLanguage(prevLanguage);
        } catch {
          // ignore
        }
        const msg =
          err instanceof Error
            ? err.message
            : "Translation failed. The session may have expired — please re-upload.";
        dispatch({ type: "TRANSLATE_ERROR", payload: msg });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.language, state.bundle]
  );

  // ---- loadSample ---------------------------------------------------------
  const loadSample = useCallback(async () => {
    dispatch({ type: "START_ANALYSIS" });
    try {
      const bundle = await getSample(state.language);
      dispatch({ type: "LOAD_SAMPLE", payload: bundle });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load demo data. Is the backend running?";
      dispatch({ type: "ANALYSIS_ERROR", payload: msg });
    }
  }, [state.language]);

  // ---- reset --------------------------------------------------------------
  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // Memoised context value — only rebuilds when state or helpers change
  const value = useMemo<HealthContextValue>(
    () => ({
      state,
      dispatch,
      language: state.language,
      bundle: state.bundle,
      status: state.status,
      error: state.error,
      isTranslating: state.isTranslating,
      analyze,
      changeLanguage,
      loadSample,
      reset,
    }),
    [state, analyze, changeLanguage, loadSample, reset]
  );

  return (
    <HealthContext.Provider value={value}>{children}</HealthContext.Provider>
  );
}
