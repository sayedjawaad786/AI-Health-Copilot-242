/**
 * components/layout/AppShell.tsx
 *
 * Responsive application shell:
 *   - Desktop (lg+): fixed 280px sidebar + sticky header + scrollable main
 *   - Mobile: slide-over drawer triggered by Header's Menu button
 *
 * Features:
 *   - Backdrop overlay when drawer is open
 *   - Esc key to close
 *   - Focus trap is NOT implemented (hackathon scope); add with
 *     focus-trap-react for production
 */

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DisclaimerBanner } from "./DisclaimerBanner";


const SIDEBAR_WIDTH = 280;

interface AppShellProps {
  children: ReactNode;
  title?: string;
}

export function AppShell({ children, title }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Sidebar and Header are self-contained — they read context directly

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Close drawer on Esc
  useEffect(() => {
    if (!drawerOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [drawerOpen, closeDrawer]);

  // Prevent body scroll when drawer is open on mobile
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="app-mesh flex min-h-dvh">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        style={{ width: SIDEBAR_WIDTH }}
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col border-r border-white/40 bg-white/70 backdrop-blur-md shadow-xl shadow-slate-200/50"
        aria-label="Application sidebar"
      >
        <Sidebar />
      </aside>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={closeDrawer}
        />
      )}

      {/* Slide-over panel */}
      <aside
        style={{ width: SIDEBAR_WIDTH }}
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/40 bg-white/70 backdrop-blur-md shadow-xl shadow-slate-200/50",
          "transition-transform duration-200 ease-in-out lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label="Navigation drawer"
        aria-modal={drawerOpen}
        role="dialog"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={closeDrawer}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>

        <Sidebar />
      </aside>

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div
        className="flex flex-1 flex-col lg:pl-[280px]"
        style={{ minWidth: 0 }}
      >
        <Header onMenuClick={openDrawer} title={title} />

        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-6">
          {/* Always-visible disclaimer */}
          <div className="mb-5 max-w-7xl">
            <DisclaimerBanner />
          </div>

          {/* Page content */}
          <div className="max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
