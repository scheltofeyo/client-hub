const statusStyles: Record<string, { bg: string; color: string }> = {
  active:       { bg: "#dcfce7", color: "#166534" },
  inactive:     { bg: "#f4f4f5", color: "#71717a" },
  prospect:     { bg: "#ede9fe", color: "#6d28d9" },
  not_started:  { bg: "#f4f4f5", color: "#71717a" },
  in_progress:  { bg: "#fef9c3", color: "#854d0e" },
  completed:    { bg: "#dcfce7", color: "#166534" },
  // legacy values kept for existing DB documents
  planning:     { bg: "#f3e8ff", color: "#7e22ce" },
  review:       { bg: "#ffedd5", color: "#9a3412" },
  on_hold:      { bg: "#f4f4f5", color: "#71717a" },
};

export default function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? { bg: "#f4f4f5", color: "#71717a" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: style.bg, color: style.color }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
