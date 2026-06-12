"use client";

// TODO: When the client-facing portal lands, surface the `info` field to participants
// and add invite/access management for the participants array.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, MapPin, Users, Mail, ChevronRight } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import RichTextEditor from "@/components/ui/RichTextEditor";
import DataTable, { type ColumnDef } from "@/components/ui/DataTable";
import { usePermission } from "@/hooks/usePermission";
import { fmtDate } from "@/lib/utils";
import type { Session, SessionParticipant } from "@/types";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

export default function SessionsTab({
  clientId,
  projectId,
  initialSessions,
  today,
}: {
  clientId: string;
  projectId: string;
  initialSessions: Session[];
  today: string;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const { openPanel, closePanel } = useRightPanel();
  const router = useRouter();
  const canCreate = usePermission("sessions.create");
  const canEdit = usePermission("sessions.edit");
  const canDelete = usePermission("sessions.delete");

  const drafts = sessions
    .filter((s) => !s.date)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));
  const upcoming = sessions
    .filter((s) => s.date && s.date >= today)
    .sort((a, b) => a.date!.localeCompare(b.date!));
  const completed = sessions
    .filter((s) => s.date && s.date < today)
    .sort((a, b) => b.date!.localeCompare(a.date!));

  async function handleSaved() {
    const res = await fetch(`/api/clients/${clientId}/projects/${projectId}/sessions`);
    if (res.ok) {
      const data: Session[] = await res.json();
      setSessions(data);
    }
    router.refresh();
  }

  function openCreate() {
    openPanel(
      "New session",
      <SessionForm
        clientId={clientId}
        projectId={projectId}
        onSaved={handleSaved}
        onClose={closePanel}
      />
    );
  }

  function openEdit(session: Session) {
    openPanel(
      "Edit session",
      <SessionForm
        clientId={clientId}
        projectId={projectId}
        session={session}
        onSaved={handleSaved}
        onClose={closePanel}
      />
    );
  }

  async function reorderDrafts(ids: string[]) {
    setSessions((prev) =>
      prev.map((s) => {
        const idx = ids.indexOf(s.id);
        return idx === -1 ? s : { ...s, order: idx };
      })
    );
    await fetch(`/api/clients/${clientId}/projects/${projectId}/sessions/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  }

  async function handleDelete(session: Session) {
    if (!confirm(`Delete "${session.title}"? This cannot be undone.`)) return;
    const res = await fetch(
      `/api/clients/${clientId}/projects/${projectId}/sessions/${session.id}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    router.refresh();
  }

  const columns = useMemo<ColumnDef<Session>[]>(
    () => [
      {
        key: "title",
        label: "Title",
        minWidth: 200,
        render: (s) => (
          <div className="font-medium" style={{ color: "var(--text-primary)" }}>
            {s.title}
          </div>
        ),
      },
      {
        key: "date",
        label: "Date",
        minWidth: 130,
        render: (s) =>
          s.date ? (
            <span style={{ color: "var(--text-primary)" }}>{fmtDate(s.date)}</span>
          ) : (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-badge text-xs font-medium"
              style={{ background: "var(--warning-light)", color: "var(--warning)" }}
            >
              Draft
            </span>
          ),
      },
      {
        key: "location",
        label: "Location",
        minWidth: 160,
        render: (s) =>
          s.location ? (
            <span
              className="inline-flex items-center gap-1"
              style={{ color: "var(--text-muted)" }}
            >
              <MapPin size={12} />
              {s.location}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>—</span>
          ),
      },
      {
        key: "participants",
        label: "Participants",
        minWidth: 110,
        render: (s) => {
          const count = s.participants?.length ?? 0;
          return count > 0 ? (
            <span
              className="inline-flex items-center gap-1"
              style={{ color: "var(--text-muted)" }}
            >
              <Users size={12} />
              {count}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>—</span>
          );
        },
      },
      {
        key: "actions",
        label: "",
        minWidth: 90,
        render: (s) => (
          <div className="flex justify-end gap-1">
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(s);
                }}
                className="btn-icon"
                aria-label="Edit session"
                title={s.date ? "Edit session" : "Plan & edit session"}
              >
                <Pencil size={14} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(s);
                }}
                className="btn-icon"
                aria-label="Delete session"
                title="Delete session"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, canDelete]
  );

  const isEmpty = sessions.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="typo-section-title">Sessions</h2>
        {canCreate && (
          <button onClick={openCreate} className="btn-tertiary">
            <Plus size={14} />
            New session
          </button>
        )}
      </div>

      {isEmpty ? (
        <EmptyState onCreate={canCreate ? openCreate : undefined} />
      ) : (
        <>
          {drafts.length > 0 && (
            <SessionsSection
              label="Drafts"
              hint="No date set yet — schedule these to add them to the timeline."
              sessions={drafts}
              columns={columns}
              onReorder={canEdit ? reorderDrafts : undefined}
            />
          )}
          {upcoming.length > 0 && (
            <SessionsSection label="Upcoming" sessions={upcoming} columns={columns} />
          )}
          {completed.length > 0 && (
            <SessionsSection label="Completed" sessions={completed} columns={columns} />
          )}
        </>
      )}
    </div>
  );
}

function SessionsSection({
  label,
  hint,
  sessions,
  columns,
  onReorder,
}: {
  label: string;
  hint?: string;
  sessions: Session[];
  columns: ColumnDef<Session>[];
  onReorder?: (ids: string[]) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <h3 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
          {label}
        </h3>
        {hint && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {hint}
          </span>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={sessions}
        getRowKey={(s) => s.id}
        sort={{ col: null, dir: "asc" }}
        onSort={() => {
          /* sessions are pre-sorted; no UI sorting */
        }}
        onReorder={onReorder}
      />
    </section>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-card border py-12"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      }}
    >
      <Users size={28} />
      <p className="text-sm">No sessions planned yet for this project.</p>
      {onCreate && (
        <button onClick={onCreate} className="btn-primary text-sm">
          <Plus size={14} />
          New session
        </button>
      )}
    </div>
  );
}

// ── SessionForm ──────────────────────────────────────────────

export function SessionForm({
  clientId,
  projectId,
  session,
  onSaved,
  onClose,
}: {
  clientId: string;
  projectId: string;
  session?: Session;
  onSaved: () => void | Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!session;
  const { openSecondaryPanel, closeSecondaryPanel } = useRightPanel();
  const [title, setTitle] = useState(session?.title ?? "");
  const [date, setDate] = useState(session?.date ?? "");
  const [location, setLocation] = useState(session?.location ?? "");
  const [remoteLink, setRemoteLink] = useState(session?.remoteLink ?? "");
  const [info, setInfo] = useState(session?.info ?? "");
  const [participants, setParticipants] = useState<SessionParticipant[]>(
    session?.participants?.length ? session.participants : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openParticipantsEditor() {
    openSecondaryPanel(
      "Participants",
      <ParticipantsEditor
        initialParticipants={participants}
        onSave={(updated) => {
          setParticipants(updated);
          closeSecondaryPanel();
        }}
        onCancel={closeSecondaryPanel}
      />
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setLoading(true);
    setError("");

    const cleanedParticipants = participants
      .map((p) => ({
        email: p.email.trim(),
        name: p.name?.trim() || undefined,
      }))
      .filter((p) => p.email);

    const url = isEdit
      ? `/api/clients/${clientId}/projects/${projectId}/sessions/${session!.id}`
      : `/api/clients/${clientId}/projects/${projectId}/sessions`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        date: date.trim() || "",
        location: location.trim() || "",
        remoteLink: remoteLink.trim() || "",
        info: info.trim() || "",
        participants: cleanedParticipants,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    await onSaved();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="ses-title" className="typo-label">
          Title <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          id="ses-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          placeholder="e.g. Kickoff workshop"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="ses-date" className="typo-label">
          Date <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>(optional — leave blank to keep as draft)</span>
        </label>
        <input
          id="ses-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="ses-location" className="typo-label">
          Location
        </label>
        <input
          id="ses-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. HQ — Room 3"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="ses-remote-link" className="typo-label">
          Remote link <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
        </label>
        <input
          id="ses-remote-link"
          type="url"
          value={remoteLink}
          onChange={(e) => setRemoteLink(e.target.value)}
          placeholder="https://meet.google.com/…"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <p className="typo-label">Participants</p>
        <button
          type="button"
          onClick={openParticipantsEditor}
          className="w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover-row text-left"
          style={{
            background: "var(--bg-sidebar)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Users size={14} style={{ color: "var(--text-muted)" }} />
            {participants.length === 0 ? (
              <span style={{ color: "var(--text-muted)" }}>No participants yet</span>
            ) : (
              <span>
                {participants.length} {participants.length === 1 ? "participant" : "participants"}
              </span>
            )}
          </span>
          <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>
      <div>
        <p className="typo-label">Info</p>
        <RichTextEditor
          content={info}
          onChange={setInfo}
          placeholder="Notes or instructions for participants…"
        />
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          {loading ? "Saving…" : isEdit ? "Save changes" : "Add session"}
        </button>
      </div>
    </form>
  );
}

// ── ParticipantsEditor (secondary panel) ─────────────────────────────

function ParticipantsEditor({
  initialParticipants,
  onSave,
  onCancel,
}: {
  initialParticipants: SessionParticipant[];
  onSave: (participants: SessionParticipant[]) => void;
  onCancel: () => void;
}) {
  const [participants, setParticipants] = useState<SessionParticipant[]>(
    initialParticipants.length ? initialParticipants : []
  );

  function setParticipant(idx: number, key: "email" | "name", value: string) {
    setParticipants((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }
  function addParticipant() {
    setParticipants((prev) => [...prev, { email: "", name: "" }]);
  }
  function removeParticipant(idx: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleDone() {
    const cleaned = participants
      .map((p) => ({
        email: p.email.trim(),
        name: p.name?.trim() || undefined,
      }))
      .filter((p) => p.email);
    onSave(cleaned);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Add the people who should join this session. Email is required; name is optional.
      </p>

      {participants.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-card border py-8"
          style={{
            background: "var(--bg-sidebar)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <Users size={24} />
          <p className="text-sm">No participants yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {participants.map((p, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="relative">
                  <Mail
                    size={12}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    type="email"
                    value={p.email}
                    onChange={(e) => setParticipant(idx, "email", e.target.value)}
                    placeholder="email@company.com"
                    autoFocus={idx === participants.length - 1 && !p.email}
                    className={inputClass + " pl-7"}
                    style={inputStyle}
                  />
                </div>
                <input
                  type="text"
                  value={p.name ?? ""}
                  onChange={(e) => setParticipant(idx, "name", e.target.value)}
                  placeholder="Name (optional)"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <button
                type="button"
                onClick={() => removeParticipant(idx)}
                className="btn-icon p-2 rounded-md"
                aria-label="Remove participant"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addParticipant}
        className="btn-tertiary text-sm self-start"
      >
        <Plus size={14} />
        Add participant
      </button>

      <div
        className="flex justify-end gap-2 pt-3 mt-2 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDone}
          className="px-3 py-1.5 rounded-lg text-sm font-medium btn-primary"
        >
          Done
        </button>
      </div>
    </div>
  );
}
