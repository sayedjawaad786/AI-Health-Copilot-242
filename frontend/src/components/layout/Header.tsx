/**
 * components/layout/Header.tsx
 *
 * Sticky top header. Wired to HealthContext:
 *   - "Load demo" calls context.loadSample()
 *   - Disabled and shows spinner during any in-progress status
 */

import { Menu, Sparkles, Loader2 } from "lucide-react";
import { useHealth } from "../../context/HealthContext";
import { ghostBtn } from "../../lib/ui";

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function Header({ onMenuClick, title = "Health Copilot" }: HeaderProps) {
  const { status, loadSample, isTranslating } = useHealth();

  const isBusy =
    status === "uploading" || status === "analyzing" || isTranslating;

  async function handleLoadDemo() {
    await loadSample();
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/40 bg-white/70 backdrop-blur-md shadow-xl shadow-slate-200/50 px-4 lg:px-6">
      {/* Mobile menu trigger */}
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-500 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Title */}
      <h1 className="flex-1 truncate text-base font-semibold text-slate-800 lg:text-lg">
        {title}
      </h1>

      {/* Load demo data */}
      <button
        type="button"
        onClick={handleLoadDemo}
        disabled={isBusy}
        className={`${ghostBtn} px-3 py-1.5 text-sm`}
        aria-label="Load demo health record"
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">Load demo</span>
      </button>
    </header>
  );
}

