"use client";

import type { OpenAnswer } from "./types";

interface OpenAnswerListProps {
  answers: OpenAnswer[];
  /** Show only first N until expanded. Default: show all. */
  collapsed?: number;
  className?: string;
  emptyText?: string;
}

export function OpenAnswerList({ answers, collapsed, className, emptyText }: OpenAnswerListProps) {
  if (answers.length === 0) {
    return emptyText ? (
      <p className="text-xs italic text-text-muted">{emptyText}</p>
    ) : null;
  }
  const display = collapsed ? answers.slice(0, collapsed) : answers;
  const more = answers.length - display.length;

  return (
    <div className={className}>
      <ul className="flex flex-col gap-2">
        {display.map((a, i) => (
          <li
            key={i}
            className="rounded-card bg-surface p-3 shadow-subtle transition-shadow hover:shadow-card"
          >
            <p className="text-xs leading-snug text-text-muted">{a.text}</p>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <p className="mt-2 text-[11px] text-text-muted">+{more} more</p>
      )}
    </div>
  );
}
