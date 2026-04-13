"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  Fragment,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

interface PanelState {
  isOpen: boolean;
  title: string;
  content: ReactNode;
  openKey: number;
}

interface RightPanelCtx {
  openPanel: (title: string, content: ReactNode) => void;
  closePanel: () => void;
  isOpen: boolean;
}

const RightPanelContext = createContext<RightPanelCtx | null>(null);

export function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) throw new Error("useRightPanel must be used within RightPanelProvider");
  return ctx;
}

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<PanelState>({
    isOpen: false,
    title: "",
    content: null,
    openKey: 0,
  });

  const openPanel = useCallback((title: string, content: ReactNode) => {
    setPanel((p) => ({ isOpen: true, title, content, openKey: p.openKey + 1 }));
  }, []);

  const closePanel = useCallback(() => {
    setPanel((p) => ({ ...p, isOpen: false }));
  }, []);

  return (
    <RightPanelContext.Provider value={{ openPanel, closePanel, isOpen: panel.isOpen }}>
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
        onClick={closePanel}
      />

      {/* Panel */}
      <div
        className="fixed z-50 flex flex-col border-l shadow-2xl"
        style={{
          top: 0,
          right: 0,
          bottom: 0,
          width: "clamp(420px, 33vw, 560px)",
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          transform: panel.isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
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
    </RightPanelContext.Provider>
  );
}
