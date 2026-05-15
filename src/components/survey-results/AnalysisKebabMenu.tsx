"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Copy, Trash2, ChevronUp, ChevronDown } from "lucide-react";

interface AnalysisKebabMenuProps {
  canEdit: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function AnalysisKebabMenu({
  canEdit,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: AnalysisKebabMenuProps) {
  const [open, setOpen] = useState(false);

  if (!canEdit) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="btn-icon p-1 rounded-button"
        aria-label="Analysis menu"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-7 z-20 min-w-[160px] rounded-card border bg-surface shadow-dropdown py-1"
            style={{ borderColor: "var(--border)" }}
          >
            <MenuItem
              icon={<Pencil size={13} />}
              label="Edit"
              onClick={() => {
                setOpen(false);
                onEdit?.();
              }}
            />
            <MenuItem
              icon={<Copy size={13} />}
              label="Duplicate"
              onClick={() => {
                setOpen(false);
                onDuplicate?.();
              }}
            />
            <MenuItem
              icon={<ChevronUp size={13} />}
              label="Move up"
              disabled={!canMoveUp}
              onClick={() => {
                setOpen(false);
                onMoveUp?.();
              }}
            />
            <MenuItem
              icon={<ChevronDown size={13} />}
              label="Move down"
              disabled={!canMoveDown}
              onClick={() => {
                setOpen(false);
                onMoveDown?.();
              }}
            />
            <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
            <MenuItem
              icon={<Trash2 size={13} />}
              label="Delete"
              danger
              onClick={() => {
                setOpen(false);
                onDelete?.();
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color: danger ? "var(--danger)" : "var(--text-primary)" }}
    >
      <span style={{ color: danger ? "var(--danger)" : "var(--text-muted)" }}>{icon}</span>
      {label}
    </button>
  );
}
