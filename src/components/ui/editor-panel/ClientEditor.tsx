"use client";

import { useEffect, useState } from "react";
import { useRightPanel } from "@/components/layout/RightPanel";
import EditorPanel from "@/components/ui/editor-panel/EditorPanel";
import { useEditorDraft } from "@/components/ui/editor-panel/useEditorDraft";
import {
  ClientContactsFields,
  ClientGeneralFields,
  clientToDraft,
  draftToPayload,
  emptyClientDraft,
  useClientReferenceOptions,
  type ClientDraft,
} from "@/components/ui/editor-panel/client-fields";
import type { Client } from "@/types";

type Tab = "general" | "contacts";

/**
 * One side-panel editor for a client's company details and contact persons,
 * used both to create a client and to edit an existing one. Mount it as
 * unpadded panel content (`openPanel(…, { padded: false })`) so `EditorPanel`
 * can pin its own footer.
 *
 * In edit mode the full client is fetched on mount: callers such as the sales
 * board only hold a thin projection of the client, not its address or website.
 */
export default function ClientEditor({
  mode,
  clientId,
  prefillCompany = "",
  initialStatus = "",
  statusLocked,
  guardScope = "primary",
  onSaved,
  onClose,
}: {
  mode: "create" | "edit";
  /** Required in edit mode. */
  clientId?: string;
  prefillCompany?: string;
  /** Status a created client starts with (the sales board creates prospects). */
  initialStatus?: string;
  /** Show the status as a read-only badge — the sales board owns status changes
   *  through its won/lost flow, not through this form. */
  statusLocked?: boolean;
  /** Which panel this editor lives in — decides which close guard it registers. */
  guardScope?: "primary" | "secondary";
  onSaved: (client: Client) => void;
  onClose: () => void;
}) {
  const { registerCloseGuard, registerSecondaryCloseGuard } = useRightPanel();
  const { statusOptions, platformOptions } = useClientReferenceOptions();

  const [tab, setTab] = useState<Tab>("general");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [creating, setCreating] = useState(false);
  // The RightPanel snapshots its content, so this holds the saved state the
  // draft is diffed against (same reason SalesCardEditor keeps a local source).
  const [source, setSource] = useState<ClientDraft>(() =>
    emptyClientDraft({ company: prefillCompany, status: initialStatus })
  );
  const { display, dirty, saving, setField, discard, save } = useEditorDraft(source);

  useEffect(() => {
    if (mode !== "edit" || !clientId) return;
    let alive = true;
    fetch(`/api/clients/${clientId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((client: Client) => {
        if (!alive) return;
        setSource(clientToDraft(client));
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Bedrijfsgegevens laden mislukt.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, clientId]);

  useEffect(() => {
    const guard = () => {
      if (!dirty) return true;
      return confirm("Je hebt niet-opgeslagen wijzigingen. Sluiten en verwerpen?");
    };
    const register = guardScope === "secondary" ? registerSecondaryCloseGuard : registerCloseGuard;
    register(guard);
    return () => register(null);
  }, [dirty, guardScope, registerCloseGuard, registerSecondaryCloseGuard]);

  function validate(draft: ClientDraft): string | null {
    if (!draft.company.trim()) return "Bedrijfsnaam is verplicht.";
    const nameless = draft.contacts.find((c) => !c.firstName.trim());
    if (nameless) return "Elke contactpersoon heeft minimaal een voornaam nodig.";
    return null;
  }

  async function handleSave() {
    const problem = validate(display);
    if (problem) {
      setError(problem);
      setTab(problem.startsWith("Elke contactpersoon") ? "contacts" : "general");
      return;
    }
    setError(null);

    // A create posts the whole draft, so it must stay possible even when the
    // prefilled company is the only thing in it (nothing "pending" to diff).
    if (mode === "create") {
      if (creating) return;
      setCreating(true);
      try {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftToPayload(display)),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Aanmaken mislukt");
          return;
        }
        onSaved(await res.json());
        onClose();
      } finally {
        setCreating(false);
      }
      return;
    }

    await save(async (pending) => {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(pending)),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Opslaan mislukt");
        return null;
      }

      const client: Client = await res.json();
      setSource(clientToDraft(client));
      onSaved(client);
      return pending;
    });
  }

  return (
    <EditorPanel<Tab>
      tabs={[
        { key: "general", label: "Algemeen" },
        { key: "contacts", label: "Contacten", count: display.contacts.length },
      ]}
      activeTab={tab}
      onTabChange={setTab}
      dirty={mode === "create" ? display.company.trim().length > 0 : dirty}
      saving={saving || creating}
      readOnly={loading}
      onSave={handleSave}
      onDiscard={discard}
      error={error}
      saveLabel={mode === "create" ? "Bedrijf aanmaken" : "Save changes"}
    >
      <div className="space-y-8">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 rounded-button animate-pulse"
                style={{ background: "var(--bg-neutral)" }}
              />
            ))}
          </div>
        ) : tab === "general" ? (
          <ClientGeneralFields
            draft={display}
            onChange={setField}
            statusOptions={statusOptions}
            platformOptions={platformOptions}
            statusLocked={statusLocked}
          />
        ) : (
          <ClientContactsFields
            contacts={display.contacts}
            onChange={(contacts) => setField("contacts", contacts)}
          />
        )}
      </div>
    </EditorPanel>
  );
}
