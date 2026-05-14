"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownUp,
  FileText,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Plus,
} from "lucide-react";
import type { SurveyQuestionType } from "@/lib/surveys/types";

interface BlockOption {
  type: SurveyQuestionType;
  label: string;
  description: string;
  icon: typeof LayoutGrid;
  color: string;
}

const OPTIONS: BlockOption[] = [
  {
    type: "archetype-ranking",
    label: "Archetype ranking",
    description: "Rank archetype-bound options",
    icon: LayoutGrid,
    color: "var(--primary)",
  },
  {
    type: "general-ranking",
    label: "General ranking",
    description: "Rank a list of items",
    icon: ArrowDownUp,
    color: "var(--info)",
  },
  {
    type: "multiple-choice",
    label: "Multiple choice",
    description: "Single or multi-select choices",
    icon: ListChecks,
    color: "var(--info)",
  },
  {
    type: "open-text",
    label: "Open text",
    description: "Free-form participant answer",
    icon: MessageSquare,
    color: "var(--text-muted)",
  },
  {
    type: "intro",
    label: "Info block",
    description: "Rich-text info section (no input)",
    icon: FileText,
    color: "var(--text-muted)",
  },
];

const MENU_WIDTH = 300;
const MENU_OFFSET = 6;

export default function AddBlockMenu({
  onPick,
  disabledTypes,
  buttonLabel = "Add block",
  size = "md",
}: {
  onPick: (type: SurveyQuestionType) => void;
  disabledTypes?: SurveyQuestionType[];
  buttonLabel?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const disabled = new Set(disabledTypes ?? []);
  const filtered = OPTIONS.filter((o) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return o.label.toLowerCase().includes(q) || o.description.toLowerCase().includes(q);
  });

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.max(8, rect.right - MENU_WIDTH); // align right edge to button's right
    const top = rect.bottom + MENU_OFFSET;
    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const inButton = buttonRef.current?.contains(e.target as Node);
      const inMenu = menuRef.current?.contains(e.target as Node);
      if (!inButton && !inMenu) setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  function pick(type: SurveyQuestionType) {
    if (disabled.has(type)) return;
    setOpen(false);
    setQuery("");
    setActiveIdx(0);
    onPick(type);
  }

  function openMenu() {
    setOpen((v) => {
      if (!v) setActiveIdx(0);
      return !v;
    });
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openMenu}
        className={
          size === "sm"
            ? "btn-tertiary inline-flex items-center gap-1.5 px-2 py-1 rounded-button text-xs"
            : "btn-secondary border inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs"
        }
        style={size === "md" ? { borderColor: "var(--border)" } : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={12} />
        {buttonLabel}
      </button>
      {open && position && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed rounded-card shadow-dropdown"
            style={{
              top: position.top,
              left: position.left,
              width: MENU_WIDTH,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              zIndex: 50,
            }}
          >
            <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIdx((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const opt = filtered[activeIdx];
                    if (opt) pick(opt.type);
                  }
                }}
                placeholder="Search blocks…"
                className="input input-sm w-full"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <li
                  className="px-3 py-2 text-xs italic"
                  style={{ color: "var(--text-muted)" }}
                >
                  No block type matches &ldquo;{query}&rdquo;
                </li>
              )}
              {filtered.map((opt, i) => {
                const Icon = opt.icon;
                const isDisabled = disabled.has(opt.type);
                const isActive = i === activeIdx;
                return (
                  <li key={opt.type}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => pick(opt.type)}
                      onMouseEnter={() => setActiveIdx(i)}
                      disabled={isDisabled}
                      className="w-full text-left px-3 py-2 flex items-start gap-3"
                      style={{
                        background: isActive && !isDisabled ? "var(--bg-hover)" : "transparent",
                        opacity: isDisabled ? 0.4 : 1,
                        cursor: isDisabled ? "not-allowed" : "pointer",
                      }}
                    >
                      <Icon size={16} style={{ color: opt.color, marginTop: 2 }} />
                      <div className="min-w-0">
                        <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                          {opt.label}
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {opt.description}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
