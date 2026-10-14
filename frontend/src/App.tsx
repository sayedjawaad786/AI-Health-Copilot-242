/**
 * App.tsx — Root application component.
 * Renders the upload panel and, once a bundle is loaded, the full Dashboard.
 */

import { AppShell } from "./components/layout/AppShell";
import { UploadPanel } from "./components/upload/UploadPanel";
import { Dashboard } from "./components/dashboard/Dashboard";
import { ErrorBox } from "./components/common/ErrorBox";
import { useHealth } from "./context/HealthContext";

export default function App() {
  const { status, bundle, error, reset } = useHealth();

  // Global errors that are not tied to the upload flow (e.g. translate failures)
  const globalError = error && status !== "error" ? error : null;

  return (
    <AppShell title={bundle ? "Health Record" : "Health Copilot"}>
      {/* Global error bar (translate errors, etc.) */}
      {globalError && (
        <div className="mb-5">
          <ErrorBox message={globalError} onAction={reset} actionLabel="Reset" />
        </div>
      )}

      {/* Upload panel — always present; collapses to bar after success */}
      <div className="mb-6">
        <UploadPanel />
      </div>

      {/* Dashboard — appears once a bundle has been loaded */}
      {bundle && <Dashboard />}
    </AppShell>
  );
}
