"use client";

import { useEffect, useState } from "react";
import { Award, Trash2, XCircle } from "lucide-react";
import EditorPanel from "@/components/ui/editor-panel/EditorPanel";
import PanelSection from "@/components/ui/editor-panel/PanelSection";
import { useEditorDraft } from "@/components/ui/editor-panel/useEditorDraft";
import RichTextEditor from "@/components/ui/RichTextEditor";
import RichTextDisplay from "@/components/ui/RichTextDisplay";
import UserAvatar from "@/components/ui/UserAvatar";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { Contact, SalesCard, SalesCardOwner } from "@/types";

type Tab = "details" | "notes";

interface AssignableUser {
  id: string;
  name: string;
  image?: string | null;
}

/** The editable subset of a card. */
interface CardDraft {
  owners: SalesCardOwner[];
  contactId: string;
  source: string;
  dealValue: string;
  expectedCloseDate: string;
  labels: string[];
  notes: string;
}

function toDraft(card: SalesCard): CardDraft {
  return {
    owners: card.owners,
    contactId: card.contactId ?? "",
    source: card.source ?? "",
    dealValue: card.dealValue != null ? String(card.dealValue) : "",
    expectedCloseDate: card.expectedCloseDate ?? "",
    labels: card.labels,
    notes: card.notes ?? "",
  };
}

export default function SalesCardEditor({
  card,
  contacts,
  canManageCards,
  canConvert,
  onUpdated,
  onRemoved,
  onClosed,
  onClose,
}: {
  card: SalesCard;
  contacts: Contact[];
  canManageCards: boolean;
  canConvert: boolean;
  onUpdated: (card: SalesCard) => void;
  onRemoved: (cardId: string) => void;
  /** Fired after a won/lost outcome; `promoted` says whether the client became active. */
  onClosed: (cardId: string, outcome: "won" | "lost", promoted: boolean) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("details");
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [busy, setBusy] = useState(false);
  // The RightPanel snapshots its content, so the `card` prop never refreshes.
  // Hold the saved state locally (as ProjectEditor does) or the fields would
  // snap back to their pre-save values once `pending` is cleared.
  const [source, setSource] = useState(() => toDraft(card));
  const { display, dirty, saving, editorKey, setField, discard, save } = useEditorDraft(source);

  useEffect(() => {
    fetch("/api/users/assignable")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => {});
  }, []);

  const readOnly = !canManageCards || !!card.outcome;

  async function handleSave() {
    setError(null);
    await save(async (pending) => {
      const body: Record<string, unknown> = {};
      if (pending.owners !== undefined) body.owners = pending.owners;
      if (pending.contactId !== undefined) body.contactId = pending.contactId || null;
      if (pending.source !== undefined) body.source = pending.source;
      if (pending.dealValue !== undefined) {
        body.dealValue = pending.dealValue === "" ? null : Number(pending.dealValue);
      }
      if (pending.expectedCloseDate !== undefined) {
        body.expectedCloseDate = pending.expectedCloseDate || null;
      }
      if (pending.labels !== undefined) body.labels = pending.labels;
      if (pending.notes !== undefined) body.notes = pending.notes;

      const res = await fetch(`/api/sales/boards/${card.boardId}/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Opslaan mislukt");
        return null;
      }
      const updated: SalesCard = await res.json();
      setSource(toDraft(updated));
      onUpdated(updated);
      return pending;
    });
  }

  async function handleOutcome(outcome: "won" | "lost") {
    const question =
      outcome === "won"
        ? `"${card.company}" als gewonnen markeren? De prospect wordt omgezet naar een actieve klant en de kaart gaat naar het archief.`
        : `"${card.company}" als verloren markeren? De kaart gaat naar het archief; de client blijft een prospect.`;
    if (!confirm(question)) return;

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sales/boards/${card.boardId}/cards/${card.id}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Actie mislukt");
      return;
    }
    const { promoted } = await res.json();
    onClosed(card.id, outcome, !!promoted);
    onClose();
  }

  async function handleRemove() {
    if (!confirm(`"${card.company}" van dit bord halen? De client zelf blijft bestaan.`)) return;
    setBusy(true);
    const res = await fetch(`/api/sales/boards/${card.boardId}/cards/${card.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      setError("Verwijderen mislukt");
      return;
    }
    onRemoved(card.id);
    onClose();
  }

  function toggleOwner(user: AssignableUser) {
    const already = display.owners.some((o) => o.userId === user.id);
    setField(
      "owners",
      already
        ? display.owners.filter((o) => o.userId !== user.id)
        : [...display.owners, { userId: user.id, name: user.name, image: user.image ?? undefined }]
    );
  }

  function addLabel() {
    const value = labelInput.trim();
    if (!value || display.labels.includes(value)) {
      setLabelInput("");
      return;
    }
    setField("labels", [...display.labels, value]);
    setLabelInput("");
  }

  return (
    <EditorPanel<Tab>
      tabs={[
        { key: "details", label: "Details" },
        { key: "notes", label: "Notitie" },
      ]}
      activeTab={tab}
      onTabChange={setTab}
      dirty={dirty}
      saving={saving}
      readOnly={readOnly}
      onSave={handleSave}
      onDiscard={discard}
      error={error}
      headerMeta={
        card.outcome ? (
          <p className="typo-caption">
            Deze kaart is gearchiveerd als{" "}
            <strong>{card.outcome === "won" ? "gewonnen" : "verloren"}</strong>
            {card.outcomeByName ? ` door ${card.outcomeByName}` : ""}. Bewerken is niet meer mogelijk.
          </p>
        ) : undefined
      }
    >
      <div className="p-6 space-y-8">
        {tab === "details" && (
          <>
            <PanelSection title="Deal">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="typo-label">Dealwaarde (EUR)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={display.dealValue}
                    onChange={(e) => setField("dealValue", e.target.value)}
                    disabled={readOnly}
                    placeholder="0"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="typo-label">Verwachte closing</label>
                  <input
                    type="date"
                    value={display.expectedCloseDate}
                    onChange={(e) => setField("expectedCloseDate", e.target.value)}
                    disabled={readOnly}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label className="typo-label">Bron</label>
                <input
                  type="text"
                  value={display.source}
                  onChange={(e) => setField("source", e.target.value)}
                  disabled={readOnly}
                  placeholder="bijv. referral, inbound, event"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </PanelSection>

            <PanelSection title="Contactpersoon" description="Uit de contacten van deze client.">
              {contacts.length === 0 ? (
                <p className="typo-caption">Deze client heeft nog geen contactpersonen.</p>
              ) : (
                <select
                  value={display.contactId}
                  onChange={(e) => setField("contactId", e.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">Geen</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                      {c.role ? ` — ${c.role}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </PanelSection>

            <PanelSection title="Eigenaars">
              <div className="space-y-1">
                {users.map((user) => {
                  const selected = display.owners.some((o) => o.userId === user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleOwner(user)}
                      disabled={readOnly}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors hover-row"
                      style={selected ? { background: "var(--bg-selected)" } : undefined}
                    >
                      <UserAvatar name={user.name} image={user.image} size={22} />
                      <span className="typo-body flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                        {user.name}
                      </span>
                      {selected && <span className="typo-caption">Eigenaar</span>}
                    </button>
                  );
                })}
              </div>
            </PanelSection>

            <PanelSection title="Labels">
              {display.labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {display.labels.map((label) => (
                    <span
                      key={label}
                      className="rounded-badge px-2.5 py-1 typo-caption inline-flex items-center gap-1.5"
                      style={{ background: "var(--bg-neutral)", color: "var(--text-primary)" }}
                    >
                      {label}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => setField("labels", display.labels.filter((l) => l !== label))}
                          aria-label={`${label} verwijderen`}
                        >
                          <XCircle size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {!readOnly && (
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLabel();
                    }
                  }}
                  onBlur={addLabel}
                  placeholder="Label toevoegen en op Enter drukken"
                  className={inputClass}
                  style={inputStyle}
                />
              )}
            </PanelSection>

            {!card.outcome && (canConvert || canManageCards) && (
              <PanelSection
                title="Afronden"
                description="Een afgeronde kaart verdwijnt van het bord en is terug te vinden onder het archief."
              >
                <div className="flex flex-wrap gap-2">
                  {canConvert && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOutcome("won")}
                        disabled={busy}
                        className="btn-primary"
                      >
                        <Award size={14} className="inline mr-1.5 -mt-px" />
                        Gewonnen
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOutcome("lost")}
                        disabled={busy}
                        className="btn-border border"
                      >
                        Verloren
                      </button>
                    </>
                  )}
                  {canManageCards && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={busy}
                      className="btn-ghost ml-auto"
                      style={{ color: "var(--danger)" }}
                    >
                      <Trash2 size={14} className="inline mr-1.5 -mt-px" />
                      Van bord halen
                    </button>
                  )}
                </div>
              </PanelSection>
            )}
          </>
        )}

        {tab === "notes" && (
          <PanelSection title="Notitie" description="De actuele stand van zaken bij deze prospect.">
            {readOnly ? (
              display.notes?.trim() ? (
                <RichTextDisplay html={display.notes} />
              ) : (
                <p className="typo-caption">Geen notitie.</p>
              )
            ) : (
              <RichTextEditor
                key={`notes-${editorKey}`}
                content={display.notes}
                onChange={(html) => setField("notes", html)}
                placeholder="Waar staan we met deze prospect?"
              />
            )}
          </PanelSection>
        )}
      </div>
    </EditorPanel>
  );
}
