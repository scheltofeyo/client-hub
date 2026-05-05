"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  Fragment,
  type ReactNode,
} from "react";
import { X, ArrowLeft } from "lucide-react";

interface PanelState {
  isOpen: boolean;
  title: string;
  content: ReactNode;
  openKey: number;
}

interface RightPanelCtx {
  openPanel: (title: string, content: ReactNode) => void;
  closePanel: () => void;
  openSecondaryPanel: (title: string, content: ReactNode) => void;
  closeSecondaryPanel: () => void;
  isOpen: boolean;
  isSecondaryOpen: boolean;
}

const RightPanelContext = createContext<RightPanelCtx | null>(null);

export function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) throw new Error("useRightPanel must be used within RightPanelProvider");
  return ctx;
}

const emptyPanel: PanelState = { isOpen: false, title: "", content: null, openKey: 0 };

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<PanelState>(emptyPanel);
  const [secondary, setSecondary] = useState<PanelState>(emptyPanel);

  const openPanel = useCallback((title: string, content: ReactNode) => {
    setPanel((p) => ({ isOpen: true, title, content, openKey: p.openKey + 1 }));
  }, []);

  const closePanel = useCallback(() => {
    setSecondary((p) => ({ ...p, isOpen: false }));
    setPanel((p) => ({ ...p, isOpen: false }));
  }, []);

  const openSecondaryPanel = useCallback((title: string, content: ReactNode) => {
    setSecondary((p) => ({ isOpen: true, title, content, openKey: p.openKey + 1 }));
  }, []);

  const closeSecondaryPanel = useCallback(() => {
    setSecondary((p) => ({ ...p, isOpen: false }));
  }, []);

  return (
    <RightPanelContext.Provider
      value={{
        openPanel,
        closePanel,
        openSecondaryPanel,
        closeSecondaryPanel,
        isOpen: panel.isOpen,
        isSecondaryOpen: secondary.isOpen,
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
          if (secondary.isOpen) closeSecondaryPanel();
          else closePanel();
        }}
      />

      {/* Primary panel */}
      <div
        className="fixed z-50 flex flex-col border-l shadow-2xl"
        style={{
          top: 0,
          right: 0,
          bottom: 0,
          width: "clamp(560px, 44vw, 745px)",
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          transform: panel.isOpen
            ? secondary.isOpen
              ? "translateX(-24px)"
              : "translateX(0)"
            : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          filter: secondary.isOpen ? "brightness(0.92)" : "none",
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
          <button onClick={closePanel} className="p-1 rounded-md btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Fragment key={panel.openKey}>
            {panel.content}
          </Fragment>
        </div>
      </div>

      {/* Secondary panel (stacked on top of primary) */}
      <div
        className="fixed z-[60] flex flex-col border-l shadow-2xl"
        style={{
          top: 0,
          right: 0,
          bottom: 0,
          width: "clamp(560px, 44vw, 745px)",
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          transform: secondary.isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Header with Back button */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={closeSecondaryPanel}
              className="p-1 rounded-md btn-icon"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <h2 className="typo-card-title" style={{ color: "var(--text-primary)" }}>
              {secondary.title}
            </h2>
          </div>
          <button onClick={closeSecondaryPanel} className="p-1 rounded-md btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Fragment key={secondary.openKey}>
            {secondary.content}
          </Fragment>
        </div>
      </div>
    </RightPanelContext.Provider>
  );
}
