"use client";

import { useEffect, useRef, useState } from "react";
import { Award, Building2, Trash2, XCircle } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import ClientEditor from "@/components/ui/editor-panel/ClientEditor";
import EditorPanel from "@/components/ui/editor-panel/EditorPanel";
import PanelSection from "@/components/ui/editor-panel/PanelSection";
import { useEditorDraft } from "@/components/ui/editor-panel/useEditorDraft";
import RichTextEditor from "@/components/ui/RichTextEditor";
import RichTextDisplay from "@/components/ui/RichTextDisplay";
import UserAvatar from "@/components/ui/UserAvatar";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { Client, Contact, SalesCard, SalesCardOwner } from "@/types";

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
  canEditClient,
  canDeleteClient,
  onUpdated,
  onClientUpdated,
  onRemoved,
  onClosed,
  onClose,
}: {
  card: SalesCard;
  contacts: Contact[];
  canManageCards: boolean;
  canConvert: boolean;
  canEditClient: boolean;
  canDeleteClient: boolean;
  onUpdated: (card: SalesCard) => void;
  /** Fired after the company behind this card was edited. */
  onClientUpdated: (client: Client) => void;
  /** Fired after the whole prospect (client + cards) was deleted. */
  onRemoved: (cardId: string) => void;
  /** Fired after a won/lost outcome; `statusChanged` says whether the client's
   *  status moved with it (active on won, inactive on lost). */
  onClosed: (cardId: string, outcome: "won" | "lost", statusChanged: boolean) => void;
  onClose: () => void;
}) {
  const { openSecondaryPanel, closeSecondaryPanel } = useRightPanel();
  const [tab, setTab] = useState<Tab>("details");
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [busy, setBusy] = useState(false);
  // The company and its contacts can change from the stacked editor, so they
  // live in state rather than being read straight off the props.
  const [company, setCompany] = useState(card.company);
  const [contactList, setContactList] = useState(contacts);
  // The RightPanel snapshots its content, so the `card` prop never refreshes.
  // Hold the saved state locally (as ProjectEditor does) or the fields would
  // snap back to their pre-save values once `pending` is cleared.
  const [source, setSource] = useState(() => toDraft(card));
  const { display, dirty, saving, editorKey, setField, discard, save } = useEditorDraft(source);
  // The stacked company editor is snapshotted on open, so it needs a live
  // reference to the currently selected contact rather than a captured value.
  const contactIdRef = useRef(display.contactId);

  useEffect(() => {
    contactIdRef.current = display.contactId;
  }, [display.contactId]);

  useEffect(() => {
    fetch("/api/users/assignable")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => {});
  }, []);

  const readOnly = !canManageCards || !!card.outcome;
  const assignableUsers = users.filter((u) => !display.owners.some((o) => o.userId === u.id));

  function openCompanyEditor() {
    openSecondaryPanel(
      "Bedrijf bewerken",
      <ClientEditor
        mode="edit"
        clientId={card.clientId}
        statusLocked
        guardScope="secondary"
        onSaved={(client) => {
          setCompany(client.company);
          const nextContacts = client.contacts ?? [];
          setContactList(nextContacts);
          // A removed contact must not stay selected on the card.
          if (contactIdRef.current && !nextContacts.some((c) => c.id === contactIdRef.current)) {
            setField("contactId", "");
          }
          onClientUpdated(client);
          closeSecondaryPanel();
        }}
        onClose={closeSecondaryPanel}
      />,
      { padded: false }
    );
  }

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
        ? `"${company}" als gewonnen markeren? De prospect wordt een actieve klant en de kaart gaat naar het archief.`
        : `"${company}" als verloren markeren? De prospect wordt op inactief gezet en de kaart gaat van het bord naar het archief.`;
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
    const { promoted, demoted } = await res.json();
    onClosed(card.id, outcome, !!promoted || !!demoted);
    onClose();
  }

  async function handleDeleteProspect() {
    const question =
      `"${company}" definitief verwijderen? De client verdwijnt uit de hub — met zijn logboek, ` +
      `projecten, taken en kaarten op alle borden. Dit kan niet ongedaan worden gemaakt.`;
    if (!confirm(question)) return;

    setBusy(true);
    const res = await fetch(`/api/clients/${card.clientId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Verwijderen mislukt");
      return;
    }
    onRemoved(card.id);
    onClose();
  }

  function addOwner(user: AssignableUser) {
    if (display.owners.some((o) => o.userId === user.id)) return;
    setField("owners", [
      ...display.owners,
      { userId: user.id, name: user.name, image: user.image ?? undefined },
    ]);
  }

  function removeOwner(userId: string) {
    setField("owners", display.owners.filter((o) => o.userId !== userId));
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
      <div className="space-y-8">
        {tab === "details" && (
          <>
            <PanelSection
              title="Bedrijf"
              action={
                canEditClient && (
                  <button
                    type="button"
                    onClick={openCompanyEditor}
                    className="btn-tertiary inline-flex items-center gap-1"
                  >
                    <Building2 size={12} />
                    Bedrijfsgegevens bewerken
                  </button>
                )
              }
            >
              <p className="typo-card-title" style={{ color: "var(--text-primary)" }}>
                {company}
              </p>
              {card.clientWebsite && (
                <a
                  href={card.clientWebsite.startsWith("http") ? card.clientWebsite : `https://${card.clientWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="typo-caption btn-link"
                >
                  {card.clientWebsite}
                </a>
              )}
            </PanelSection>

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
              {contactList.length === 0 ? (
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
                  {contactList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                      {c.role ? ` — ${c.role}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </PanelSection>

            <PanelSection title="Eigenaars">
              {display.owners.length > 0 && (
                <div className="space-y-1">
                  {display.owners.map((owner) => (
                    <div
                      key={owner.userId}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg"
                      style={{ background: "var(--bg-selected)" }}
                    >
                      <UserAvatar name={owner.name} image={owner.image} size={22} />
                      <span className="typo-body flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                        {owner.name}
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeOwner(owner.userId)}
                          className="btn-icon p-1 shrink-0"
                          aria-label={`${owner.name} als eigenaar verwijderen`}
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!readOnly && (
                assignableUsers.length > 0 ? (
                  <select
                    value=""
                    onChange={(e) => {
                      const user = users.find((u) => u.id === e.target.value);
                      if (user) addOwner(user);
                    }}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="">
                      {display.owners.length === 0 ? "Eigenaar kiezen…" : "Eigenaar toevoegen…"}
                    </option>
                    {assignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                ) : users.length > 0 ? (
                  <p className="typo-caption">Iedereen staat al als eigenaar op deze kaart.</p>
                ) : null
              )}

              {readOnly && display.owners.length === 0 && (
                <p className="typo-caption">Geen eigenaars.</p>
              )}
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

            {!card.outcome && canConvert && (
              <PanelSection
                title="Afronden"
                description="Beide brengen de kaart naar het archief: gewonnen maakt er een actieve klant van, verloren zet de prospect op inactief."
              >
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleOutcome("won")}
                    disabled={busy}
                    className="btn-primary"
                  >
                    <Award size={14} className="inline mr-1.5 -mt-px" />
                    Markeer als gewonnen
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOutcome("lost")}
                    disabled={busy}
                    className="btn-border border"
                  >
                    Markeer als verloren
                  </button>
                </div>
              </PanelSection>
            )}

            {!card.outcome && canDeleteClient && (
              <PanelSection
                title="Verwijderen"
                description="Voor een prospect die hier nooit had moeten staan. De client zelf verdwijnt uit de hub, inclusief zijn logboek, projecten en kaarten op andere borden."
              >
                <button
                  type="button"
                  onClick={handleDeleteProspect}
                  disabled={busy}
                  className="btn-ghost"
                  style={{ color: "var(--danger)" }}
                >
                  <Trash2 size={14} className="inline mr-1.5 -mt-px" />
                  Verwijder prospect
                </button>
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
