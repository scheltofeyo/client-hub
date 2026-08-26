"use client";

import { Plug } from "lucide-react";

/**
 * Marks a record that arrived through an API token rather than being typed by
 * a person.
 *
 * The label is deliberately the channel ("via MCP"), not the token's own name:
 * a reader scanning a logbook cares that a machine wrote this, not which
 * credential it used. The token name is kept on the tooltip so the audit trail
 * is still one hover away, and it stays stored in `createdVia` either way.
 *
 * Rendered as quiet inline text next to the timestamp rather than beside the
 * actor's name, because the name feeds UserAvatar's initials and the logbook's
 * author filter, and decorating it corrupts both.
 *
 * Renders nothing when `via` is absent, which is the normal hand-written case.
 */
export default function ViaToken({ via, className = "" }: { via?: string | null; className?: string }) {
  if (!via) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 align-middle ${className}`}
      style={{ color: "var(--text-muted)" }}
      title={`Geschreven via een API-token ("${via}")`}
    >
      <Plug size={10} />
      via MCP
    </span>
  );
}
