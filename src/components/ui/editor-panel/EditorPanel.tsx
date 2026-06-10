"use client";

import { type ReactNode } from "react";

export interface EditorTab<K extends string> {
  key: K;
  label: string;
  count?: number;
}

/**
 * Presentational shell for an in-RightPanel editor: a sticky subnav, a scrollable
 * body, and a sticky Save/Discard footer. It owns no field state — all
 * pending/dirty/save logic lives in the caller (via `useEditorDraft`), which is
 * what lets one shell serve both the plan draft-project editor and the admin
 * template editor.
 *
 * Mount this as the *unpadded* content of the RightPanel (`openPanel(title, …,
 * { padded: false })`) so it can fill the panel height and pin its footer.
 */
export default function EditorPanel<K extends string>({
  tabs,
  activeTab,
  onTabChange,
  children,
  dirty,
  saving,
  readOnly,
  onSave,
  onDiscard,
  error,
  headerMeta,
}: {
  tabs: EditorTab<K>[];
  activeTab: K;
  onTabChange: (tab: K) => void;
  children: ReactNode;
  dirty: boolean;
  saving: boolean;
  readOnly: boolean;
  onSave: () => void;
  onDiscard: () => void;
  error?: string | null;
  headerMeta?: ReactNode;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {headerMeta && (
        <div className="shrink-0 px-6 pt-4 pb-1" style={{ background: "var(--bg-surface)" }}>
          {headerMeta}
        </div>
      )}

      <div
        role="tablist"
        aria-label="Editor sections"
        className="shrink-0 flex px-6 border-b overflow-x-auto"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        {tabs.map((t) => {
          const active = t.key === activeTab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(t.key)}
              className="flex items-center gap-1.5 px-1 mr-6 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap"
              style={{
                color: active ? "var(--primary)" : "var(--text-muted)",
                borderColor: active ? "var(--primary)" : "transparent",
              }}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span
                  className="inline-flex items-center justify-center text-[11px] tabular-nums rounded-full px-1.5 min-w-[18px]"
                  style={{
                    background: active ? "var(--primary-light)" : "var(--bg-neutral)",
                    color: active ? "var(--primary)" : "var(--text-muted)",
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="flex-1 min-h-0 overflow-y-auto p-6">
        {children}
      </div>

      {!readOnly && (
        <div
          className="shrink-0 border-t px-6 py-3 flex items-center justify-end gap-2"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          {error && (
            <span className="text-xs mr-auto" style={{ color: "var(--danger)" }}>
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={onDiscard}
            disabled={!dirty || saving}
            className="px-3 py-1.5 rounded-md text-sm btn-ghost disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="px-3 py-1.5 rounded-md text-sm btn-primary disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
