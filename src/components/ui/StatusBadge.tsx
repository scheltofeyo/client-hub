import { STATUS_STYLES, STATUS_STYLE_DEFAULT } from "@/lib/styles";

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLE_DEFAULT;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: style.bg, color: style.color }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
