"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DeleteClientButton({ id, company }: { id: string; company: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError("");

    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    setLoading(false);

    if (!res.ok) {
      setError("Failed to delete client.");
      return;
    }

    router.push("/clients");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-secondary"
      >
        <Trash2 size={13} />
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          <div
            className="relative z-10 w-full max-w-sm rounded-2xl border p-6 shadow-xl space-y-4"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Delete client
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md btn-icon"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Are you sure you want to delete{" "}
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                {company}
              </span>
              ? This cannot be undone.
            </p>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-danger"
              >
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
