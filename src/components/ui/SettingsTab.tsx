"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import StatusBadge from "@/components/ui/StatusBadge";
import EditClientButton from "@/components/ui/EditClientButton";
import ContactsSection from "@/components/ui/ContactsSection";
import LeadsSection from "@/components/ui/LeadsSection";
import { SettingsSkeleton } from "@/components/ui/TabSkeletons";
import { fmtDate } from "@/lib/utils";
import type { Archetype, Client } from "@/types";

export default function SettingsTab({
  client,
  section,
  isAdmin,
  canEdit,
  canAssignLeads,
  canDeleteClient,
  allUsers,
}: {
  client: Client;
  section: string;
  isAdmin: boolean;
  canEdit: boolean;
  canAssignLeads: boolean;
  canDeleteClient: boolean;
  allUsers: { id: string; name: string; email: string; image: string | null }[];
}) {
  const [archetypes, setArchetypes] = useState<Archetype[] | null>(null);

  useEffect(() => {
    fetch("/api/archetypes")
      .then((r) => r.json())
      .then((data) => setArchetypes(data))
      .catch(() => setArchetypes([]));
  }, []);

  if (section === "leads") {
    return (
      <div className="max-w-2xl space-y-8">
        <LeadsSection
          clientId={client.id}
          initialLeads={client.leads ?? []}
          allUsers={allUsers}
          isAdmin={canAssignLeads}
        />
      </div>
    );
  }

  if (section === "contacts") {
    return (
      <div className="max-w-2xl space-y-8">
        <ContactsSection
          clientId={client.id}
          initialContacts={client.contacts ?? []}
        />
      </div>
    );
  }

  if (section === "platform") {
    return <PlatformSection client={client} />;
  }

  if (section === "culture") {
    if (!archetypes) return <SettingsSkeleton />;
    return <CultureSection client={client} canEdit={canEdit} archetypes={archetypes} />;
  }

  return <CompanySection client={client} canEdit={canEdit} isAdmin={isAdmin} canDeleteClient={canDeleteClient} />;
}

function CompanySection({ client, canEdit, isAdmin, canDeleteClient }: { client: Client; canEdit: boolean; isAdmin: boolean; canDeleteClient: boolean }) {
  const details: [string, string | undefined][] = [
    ["Website", client.website],
    ["Employees", client.employees != null ? client.employees.toLocaleString() : undefined],
    ["Client since", fmtDate(client.clientSince ?? client.createdAt)],
    ["Projects", String(client.projects?.length ?? 0)],
  ];
  const visibleDetails = details.filter(([, v]) => v !== undefined);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
            Company
          </h2>
          {canEdit && <EditClientButton client={client} isAdmin={isAdmin} canDelete={canDeleteClient} />}
        </div>

        <div className="space-y-1.5">
          <p className="typo-card-title" style={{ color: "var(--text-primary)" }}>
            {client.company}
          </p>
          {client.description && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {client.description}
            </p>
          )}
        </div>

        {visibleDetails.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {visibleDetails.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</dt>
                <dd className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {label === "Website" && value ? (
                    <a
                      href={value.startsWith("http") ? value : `https://${value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 btn-link"
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
            {client.status && (
              <div>
                <dt className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>Status</dt>
                <dd><StatusBadge status={client.status} /></dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}

function PlatformSection({ client }: { client: Client }) {
  const platformLabel = client.platformLabel ?? null;

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-5">
        <h2 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
          Platform
        </h2>

        {platformLabel ? (
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {platformLabel}
          </p>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No platform set
          </p>
        )}
      </div>
    </div>
  );
}

// ── Culture section ────────────────────────────────────────────────

function CultureSection({
  client,
  canEdit,
  archetypes,
}: {
  client: Client;
  canEdit: boolean;
  archetypes: Archetype[];
}) {
  const [levels, setLevels] = useState<string[]>(client.culturalLevels ?? []);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Archetype state
  const [archetypeId, setArchetypeId] = useState(client.archetypeId ?? "");
  const [savingArchetype, setSavingArchetype] = useState(false);

  async function saveLevels(updated: string[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ culturalLevels: updated }),
      });
      if (res.ok) setLevels(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLevel(index: number) {
    // Remove the level and strip matching behaviors from all DNA values
    const levelName = levels[index];
    const updatedLevels = levels.filter((_, i) => i !== index);
    const updatedDna = (client.culturalDna ?? []).map((v) => ({
      ...v,
      behaviors: (v.behaviors ?? []).filter((b) => b.level !== levelName),
    }));

    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ culturalLevels: updatedLevels, culturalDna: updatedDna }),
      });
      if (res.ok) setLevels(updatedLevels);
    } finally {
      setSaving(false);
      setConfirmDelete(null);
    }
  }

  function handleStartEdit(index: number) {
    setEditingIndex(index);
    setEditValue(levels[index]);
  }

  function handleSaveEdit() {
    if (editingIndex === null || !editValue.trim()) return;
    const oldName = levels[editingIndex];
    const newName = editValue.trim();
    if (oldName === newName) { setEditingIndex(null); return; }
    if (levels.includes(newName)) { setEditingIndex(null); return; }

    // Rename in levels and in all DNA value behaviors
    const updatedLevels = levels.map((l, i) => (i === editingIndex ? newName : l));
    const updatedDna = (client.culturalDna ?? []).map((v) => ({
      ...v,
      behaviors: (v.behaviors ?? []).map((b) =>
        b.level === oldName ? { ...b, level: newName } : b
      ),
    }));

    setSaving(true);
    fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ culturalLevels: updatedLevels, culturalDna: updatedDna }),
    })
      .then((res) => { if (res.ok) setLevels(updatedLevels); })
      .finally(() => { setSaving(false); setEditingIndex(null); });
  }

  function handleAddLevel() {
    const trimmed = newLevel.trim();
    if (!trimmed || levels.includes(trimmed)) return;
    saveLevels([...levels, trimmed]);
    setNewLevel("");
    setShowAddRow(false);
  }

  async function handleArchetypeChange(value: string) {
    setArchetypeId(value);
    setSavingArchetype(true);
    try {
      await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archetypeId: value || null }),
      });
    } finally {
      setSavingArchetype(false);
    }
  }

  const dnaCount = (client.culturalDna ?? []).length;

  // Count how many DNA values have behaviors for a given level
  function behaviorCount(level: string): number {
    return (client.culturalDna ?? []).filter((v) =>
      v.behaviors?.some((b) => b.level === level && b.content.trim())
    ).length;
  }

  // Drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = levels.indexOf(active.id as string);
    const newIndex = levels.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    saveLevels(arrayMove(levels, oldIndex, newIndex));
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Archetype */}
      <div className="space-y-3">
        <h2 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
          Archetype
        </h2>
        <select
          value={archetypeId}
          onChange={(e) => handleArchetypeChange(e.target.value)}
          disabled={!canEdit || savingArchetype}
          className="px-3 py-2 rounded-button border text-sm"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
        >
          <option value="">No archetype</option>
          {archetypes.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Cultural levels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
            Gedragsniveaus
          </h2>
          {canEdit && (
            <button
              onClick={() => setShowAddRow(true)}
              disabled={saving || showAddRow}
              className="btn-secondary border rounded-button text-xs inline-flex items-center gap-1 px-2.5 py-1"
            >
              <Plus size={12} />
              Niveau toevoegen
            </button>
          )}
        </div>

        {levels.length === 0 && !showAddRow ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Geen gedragsniveaus geconfigureerd. Voeg niveaus toe om gedragsvoorbeelden per waarde te kunnen beschrijven.
          </p>
        ) : (
          <div
            className="rounded-card border overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="grid text-sm"
              style={{
                gridTemplateColumns: canEdit ? "auto 1fr 5rem 5rem" : "1fr 5rem",
              }}
            >
              {/* Header */}
              {canEdit && <div className="px-2 py-2.5" style={{ background: "var(--bg-elevated)" }} />}
              <div className="px-4 py-2.5 typo-section-header" style={{ color: "var(--text-muted)", background: "var(--bg-elevated)" }}>Niveau</div>
              <div className="px-4 py-2.5 typo-section-header" style={{ color: "var(--text-muted)", background: "var(--bg-elevated)" }}>Gedrag</div>
              {canEdit && <div style={{ background: "var(--bg-elevated)" }} />}

              {/* Sortable rows */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={levels} strategy={verticalListSortingStrategy}>
                  {levels.map((level, i) => (
                    <SortableLevelRow
                      key={level}
                      level={level}
                      index={i}
                      canEdit={canEdit}
                      saving={saving}
                      editingIndex={editingIndex}
                      editValue={editValue}
                      confirmDelete={confirmDelete}
                      dnaCount={dnaCount}
                      behaviorCount={behaviorCount(level)}
                      onStartEdit={handleStartEdit}
                      onEditValueChange={setEditValue}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={() => setEditingIndex(null)}
                      onConfirmDelete={setConfirmDelete}
                      onDelete={handleDeleteLevel}
                      onCancelDelete={() => setConfirmDelete(null)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {/* Add row */}
              {showAddRow && (
                <div
                  className="border-t col-span-full px-4 py-2.5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newLevel}
                      onChange={(e) => setNewLevel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddLevel(); if (e.key === "Escape") { setShowAddRow(false); setNewLevel(""); } }}
                      placeholder="Naam van het niveau..."
                      autoFocus
                      className="flex-1 px-2 py-1 rounded-button border text-sm"
                      style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                    />
                    <button
                      onClick={handleAddLevel}
                      disabled={!newLevel.trim() || saving}
                      className="btn-primary rounded-button text-xs px-3 py-1"
                    >
                      Toevoegen
                    </button>
                    <button
                      onClick={() => { setShowAddRow(false); setNewLevel(""); }}
                      className="btn-ghost rounded-button text-xs px-2 py-1"
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Warning about deletion */}
        {confirmDelete !== null && (
          <div
            className="flex items-start gap-2 p-3 rounded-button text-sm"
            style={{ background: "var(--warning-light)", color: "var(--warning)" }}
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              Het verwijderen van <strong>&ldquo;{levels[confirmDelete]}&rdquo;</strong> verwijdert ook alle gedragsvoorbeelden die voor dit niveau zijn ingevuld bij alle waarden.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sortable level row ─────────────────────────────────────────────

function SortableLevelRow({
  level,
  index,
  canEdit,
  saving,
  editingIndex,
  editValue,
  confirmDelete,
  dnaCount,
  behaviorCount,
  onStartEdit,
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
  onConfirmDelete,
  onDelete,
  onCancelDelete,
}: {
  level: string;
  index: number;
  canEdit: boolean;
  saving: boolean;
  editingIndex: number | null;
  editValue: string;
  confirmDelete: number | null;
  dnaCount: number;
  behaviorCount: number;
  onStartEdit: (i: number) => void;
  onEditValueChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onConfirmDelete: (i: number) => void;
  onDelete: (i: number) => void;
  onCancelDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: level });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <>
      {/* Drag handle */}
      {canEdit && (
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          className="border-t flex items-center justify-center cursor-grab active:cursor-grabbing"
          style={{ ...style, borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          <GripVertical size={14} />
        </div>
      )}

      {/* Level name */}
      <div
        ref={canEdit ? undefined : setNodeRef}
        className="border-t px-4 py-2.5"
        style={{ ...style, borderColor: "var(--border)" }}
      >
        {editingIndex === index ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
            onBlur={onSaveEdit}
            autoFocus
            className="px-2 py-1 rounded-button border text-sm w-full"
            style={{ borderColor: "var(--primary)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
          />
        ) : (
          <span style={{ color: "var(--text-primary)" }}>{level}</span>
        )}
      </div>

      {/* Behavior count */}
      <div
        className="border-t px-4 py-2.5"
        style={{ ...style, borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        {behaviorCount} / {dnaCount}
      </div>

      {/* Actions */}
      {canEdit && (
        <div
          className="border-t px-4 py-2.5"
          style={{ ...style, borderColor: "var(--border)" }}
        >
          {confirmDelete === index ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(index)}
                disabled={saving}
                className="text-xs px-2 py-0.5 rounded-button"
                style={{ background: "var(--danger)", color: "#fff" }}
              >
                Ja
              </button>
              <button
                onClick={onCancelDelete}
                className="text-xs px-2 py-0.5 rounded-button"
                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
              >
                Nee
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => onStartEdit(index)}
                disabled={saving}
                className="btn-icon p-1"
                aria-label="Bewerken"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onConfirmDelete(index)}
                disabled={saving}
                className="btn-icon p-1 hover:!text-[var(--danger)]"
                aria-label="Verwijderen"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
