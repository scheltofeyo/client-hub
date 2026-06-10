"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  Fragment,
  type ReactNode,
} from "react";
import { X, ArrowLeft } from "lucide-react";

interface PanelOptions {
  /** When false, the content fills the panel height with no padding/scroll of
   *  its own (the content manages its own scroll + sticky regions, e.g. EditorPanel). */
  padded?: boolean;
}

interface PrimaryState {
  isOpen: boolean;
  title: string;
  content: ReactNode;
  openKey: number;
  padded: boolean;
}

interface SecondaryEntry {
  id: number;
  title: string;
  content: ReactNode;
  padded: boolean;
}

interface RightPanelCtx {
  openPanel: (title: string, content: ReactNode, opts?: PanelOptions) => void;
  closePanel: () => void;
  /** Pushes a panel on top of whatever is open. Stacks indefinitely, so a form
   *  opened here can itself open another sub-panel (e.g. session → participants). */
  openSecondaryPanel: (title: string, content: ReactNode, opts?: PanelOptions) => void;
  /** Pops the topmost stacked panel. */
  closeSecondaryPanel: () => void;
  /** Register a guard consulted on user-initiated primary-panel close (X /
   *  backdrop / Esc). Return false to abort the close. Pass null to clear. */
  registerCloseGuard: (fn: (() => boolean) | null) => void;
  isOpen: boolean;
  isSecondaryOpen: boolean;
}

const RightPanelContext = createContext<RightPanelCtx | null>(null);

export function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) throw new Error("useRightPanel must be used within RightPanelProvider");
  return ctx;
}

const emptyPrimary: PrimaryState = { isOpen: false, title: "", content: null, openKey: 0, padded: true };

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<PrimaryState>(emptyPrimary);
  const [stack, setStack] = useState<SecondaryEntry[]>([]);
  const closeGuardRef = useRef<null | (() => boolean)>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const stackIdRef = useRef(0);

  const openPanel = useCallback((title: string, content: ReactNode, opts?: PanelOptions) => {
    closeGuardRef.current = null;
    setStack([]);
    setPanel((p) => ({ isOpen: true, title, content, openKey: p.openKey + 1, padded: opts?.padded ?? true }));
  }, []);

  const closePanel = useCallback(() => {
    closeGuardRef.current = null;
    setStack([]);
    setPanel((p) => ({ ...p, isOpen: false }));
  }, []);

  const openSecondaryPanel = useCallback((title: string, content: ReactNode, opts?: PanelOptions) => {
    stackIdRef.current += 1;
    setStack((s) => [...s, { id: stackIdRef.current, title, content, padded: opts?.padded ?? true }]);
  }, []);

  const closeSecondaryPanel = useCallback(() => {
    setStack((s) => s.slice(0, -1));
  }, []);

  const registerCloseGuard = useCallback((fn: (() => boolean) | null) => {
    closeGuardRef.current = fn;
  }, []);

  // User-initiated close of the primary panel — consult the guard first.
  const attemptClosePrimary = useCallback(() => {
    const guard = closeGuardRef.current;
    if (guard && !guard()) return;
    closePanel();
  }, [closePanel]);

  // Esc closes the topmost open panel (a stacked one first), honouring the guard.
  useEffect(() => {
    if (!panel.isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (stack.length > 0) closeSecondaryPanel();
      else attemptClosePrimary();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panel.isOpen, stack.length, closeSecondaryPanel, attemptClosePrimary]);

  // Move focus into the panel when it opens so keyboard users land inside it.
  useEffect(() => {
    if (panel.isOpen) primaryRef.current?.focus();
  }, [panel.isOpen, panel.openKey]);

  const stackOpen = stack.length > 0;
  const panelWidth = "clamp(560px, 44vw, 745px)";

  return (
    <RightPanelContext.Provider
      value={{
        openPanel,
        closePanel,
        openSecondaryPanel,
        closeSecondaryPanel,
        registerCloseGuard,
        isOpen: panel.isOpen,
        isSecondaryOpen: stackOpen,
      }}
    >
      {children}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          top: 0,
          background: "rgba(0,0,0,0.2)",
          opacity: panel.isOpen ? 1 : 0,
          pointerEvents: panel.isOpen ? "auto" : "none",
        }}
        onClick={() => {
          if (stackOpen) closeSecondaryPanel();
          else attemptClosePrimary();
        }}
      />

      {/* Primary panel */}
      <div
        ref={primaryRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={panel.title || undefined}
        className="rp-primary fixed z-50 flex flex-col border-l shadow-2xl outline-none"
        style={{
          top: 0,
          right: 0,
          bottom: 0,
          width: panelWidth,
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          transform: panel.isOpen ? (stackOpen ? "translateX(-24px)" : "translateX(0)") : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          filter: stackOpen ? "brightness(0.92)" : "none",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="typo-card-title" style={{ color: "var(--text-primary)" }}>
            {panel.title}
          </h2>
          <button onClick={attemptClosePrimary} className="p-1 rounded-md btn-icon" aria-label="Close panel">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className={panel.padded ? "flex-1 overflow-y-auto p-6" : "flex-1 min-h-0 flex flex-col"}>
          <Fragment key={panel.openKey}>{panel.content}</Fragment>
        </div>
      </div>

      {/* Stacked panels (each slides in over the previous; only the top is interactive) */}
      {stack.map((entry, i) => {
        const isTop = i === stack.length - 1;
        return (
          <div
            key={entry.id}
            role="dialog"
            aria-modal="true"
            aria-label={entry.title || undefined}
            className="panel-enter fixed flex flex-col border-l shadow-2xl"
            style={{
              top: 0,
              right: 0,
              bottom: 0,
              width: panelWidth,
              zIndex: 60 + i,
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
              filter: isTop ? "none" : "brightness(0.92)",
            }}
          >
            {/* Header with Back button */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <button onClick={closeSecondaryPanel} className="p-1 rounded-md btn-icon" aria-label="Back">
                  <ArrowLeft size={16} />
                </button>
                <h2 className="typo-card-title" style={{ color: "var(--text-primary)" }}>
                  {entry.title}
                </h2>
              </div>
              <button onClick={closeSecondaryPanel} className="p-1 rounded-md btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className={entry.padded ? "flex-1 overflow-y-auto p-6" : "flex-1 min-h-0 flex flex-col"}>
              {entry.content}
            </div>
          </div>
        );
      })}
    </RightPanelContext.Provider>
  );
}
