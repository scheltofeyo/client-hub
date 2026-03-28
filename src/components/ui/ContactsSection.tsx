"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Contact } from "@/types";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

const AVATAR_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#0d9488",
  "#16a34a",
  "#ea580c",
  "#e11d48",
  "#4f46e5",
  "#d97706",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function ContactForm({
  initial,
  onSave,
}: {
  initial?: Contact;
  onSave: (values: Omit<Contact, "id">) => Promise<void>;
}) {
  const [form, setForm] = useState({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    role: initial?.role ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) return;
    setSaving(true);
    await onSave({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
    });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} style={labelStyle}>
            First name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            placeholder="Jane"
            autoFocus
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Last name
          </label>
          <input
            type="text"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            placeholder="Smith"
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>
          Role / Title
        </label>
        <input
          type="text"
          value={form.role}
          onChange={(e) => set("role", e.target.value)}
          placeholder="CEO"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>
          Email
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="jane@acme.com"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>
          Phone
        </label>
        <input
          type="text"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="+1 555 000 0000"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <button
        type="submit"
        disabled={saving || !form.firstName.trim()}
        className="w-full px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
      >
        {saving ? "Saving…" : initial ? "Save changes" : "Add contact"}
      </button>
    </form>
  );
}

export default function ContactsSection({
  clientId,
  initialContacts,
}: {
  clientId: string;
  initialContacts: Contact[];
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);
  const { openPanel, closePanel } = useRightPanel();
  const router = useRouter();

  async function patch(newContacts: Contact[]) {
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: newContacts }),
    });
    router.refresh();
  }

  function openAdd() {
    openPanel(
      "Add contact",
      <ContactForm
        onSave={async (values) => {
          const newContact: Contact = { id: crypto.randomUUID(), ...values };
          const updated = [...contacts, newContact];
          setContacts(updated);
          closePanel();
          await patch(updated);
        }}
      />
    );
  }

  function openEdit(contact: Contact) {
    openPanel(
      "Edit contact",
      <ContactForm
        initial={contact}
        onSave={async (values) => {
          const updated = contacts.map((c) =>
            c.id === contact.id ? { ...c, ...values } : c
          );
          setContacts(updated);
          closePanel();
          await patch(updated);
        }}
      />
    );
  }

  async function handleConfirmedRemove() {
    if (!confirmDelete) return;
    const updated = contacts.filter((c) => c.id !== confirmDelete.id);
    setConfirmDelete(null);
    setContacts(updated);
    await patch(updated);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Contacts
        </h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 text-xs font-medium btn-link"
        >
          <Plus size={12} />
          Add contact
        </button>
      </div>

      {contacts.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No contacts yet.
        </p>
      )}

      <div className="space-y-2">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border)" }}
          >
            <div
              className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-white text-sm font-semibold"
              style={{ background: avatarColor(contact.id) }}
            >
              {initials(contact.firstName, contact.lastName)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {contact.firstName} {contact.lastName}
              </p>
              {contact.role && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {contact.role}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="text-xs btn-link truncate">
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {contact.phone}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => openEdit(contact)}
              className="shrink-0 p-1 rounded btn-icon"
              title="Edit contact"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => setConfirmDelete(contact)}
              className="shrink-0 p-1 rounded btn-icon"
              title="Remove contact"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="rounded-xl p-6 w-full max-w-sm shadow-xl"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Remove contact?
            </h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
              {confirmDelete.firstName} {confirmDelete.lastName} will be permanently removed from this client.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="border px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedRemove}
                className="px-3 py-1.5 rounded-lg text-sm font-medium btn-danger"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
