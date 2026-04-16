"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";

export default function EditRankingSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ranking-sessions/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status !== "draft") {
          router.push(`/tools/ranking/${id}`);
          return;
        }
        setTitle(data.title);
        setDescription(data.description ?? "");
        setLoading(false);
      });
  }, [id, router]);

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/ranking-sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description: description.trim() || null }),
    });

    if (!res.ok) {
      setError("Could not save session.");
      setSaving(false);
      return;
    }

    router.push(`/tools/ranking/${id}`);
  }

  if (loading) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        breadcrumbs={[
          { label: "Tools", href: "/tools" },
          { label: "Ranking the Values", href: "/tools/ranking" },
          { label: "Edit" },
        ]}
        title="Edit session"
      />

      <div className="px-7 pb-7 pt-5 max-w-2xl space-y-4">
        <div>
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-button border text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
          />
        </div>

        <div>
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-button border text-sm resize-none"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
          />
        </div>

        {error && (
          <div className="p-3 rounded-button text-sm" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => router.push(`/tools/ranking/${id}`)} className="btn-ghost rounded-lg text-sm px-4 py-2">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary rounded-lg text-sm px-5 py-2">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
