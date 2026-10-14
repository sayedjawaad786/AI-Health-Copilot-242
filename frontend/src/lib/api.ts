/**
 * lib/api.ts
 *
 * Axios instance and typed API helpers for the Health Copilot backend.
 * All functions return typed responses matching the backend Pydantic models.
 */

import axios from "axios";
import type { HealthRecordBundle, SupportedLanguage } from "../types/health";
import { API_BASE_URL } from "./constants";

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
});

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * POST /api/records/analyze
 *
 * Upload a health document and receive a structured HealthRecordBundle.
 *
 * @param file     The document file (JPEG / PNG / WebP / PDF)
 * @param language ISO language code for the patient-facing summary
 */
export async function analyzeRecord(
  file: File,
  language: SupportedLanguage = "en"
): Promise<HealthRecordBundle> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);

  const { data } = await apiClient.post<HealthRecordBundle>(
    "/api/records/analyze",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return data;
}

/**
 * POST /api/records/translate
 *
 * Re-run summarization on a previously analyzed bundle in a new language.
 * Requires that the bundle_id is still in the server's in-memory cache.
 *
 * @param bundleId  bundle_id from a previous analyzeRecord() response
 * @param language  Target language code
 */
export async function translateSummary(
  bundleId: string,
  language: SupportedLanguage
): Promise<HealthRecordBundle> {
  const { data } = await apiClient.post<HealthRecordBundle>(
    "/api/records/translate",
    { bundle_id: bundleId, language }
  );
  return data;
}

/**
 * GET /api/records/sample
 *
 * Fetch the hardcoded demo bundle. Works without a Gemini API key.
 *
 * @param language  Language for the sample summary
 */
export async function getSample(
  language: SupportedLanguage = "en"
): Promise<HealthRecordBundle> {
  const { data } = await apiClient.get<HealthRecordBundle>(
    "/api/records/sample",
    { params: { language } }
  );
  return data;
}

/**
 * GET /api/records/{bundle_id}/fhir
 *
 * Returns a FHIR-style document representation of a cached bundle.
 * The backend returns a plain dict (not typed as HealthRecordBundle).
 */
export async function getFhir(bundleId: string): Promise<unknown> {
  const { data } = await apiClient.get(`/api/records/${bundleId}/fhir`);
  return data;
}
