"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";
import { ClientDropdown, type ClientOption } from "@/components/ranking/ClientDropdown";
import type { CulturalDnaValue } from "@/types";

interface TemplateOption {
  id: string;
  name: string;
  description?: string;
  status: string;
  archetypeIds: string[];
  sectionCount?: number;
  questionCount?: number;
}

const FROM_SCRATCH = "__scratch__";

export default function NewSurveyPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [clientId, setClientId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFromScratch = templateId === FROM_SCRATCH;

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/surveys/templates").then((r) => r.json()),
    ]).then(([clientsData, templatesData]) => {
      setClients(
        (clientsData as {
          id: string;
          company: string;
          primaryColor?: string;
          culturalDna?: CulturalDnaValue[];
          leads?: { userId: string; name: string; email: string }[];
        }[])
          .map((c) => ({
            id: c.id,
            company: c.company,
            primaryColor: c.primaryColor,
            culturalDna: c.culturalDna ?? [],
            leads: c.leads ?? [],
          }))
          .sort((a, b) => a.company.localeCompare(b.company))
      );
      const activeTemplates = (templatesData as TemplateOption[]).filter(
        (t) => t.status === "active" && (t.questionCount ?? 1) > 0
      );
      setTemplates(activeTemplates);
      setLoading(false);
    });
  }, []);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const showTitleStep = isFromScratch || !!selectedTemplate;

  async function handleCreate() {
    if (!clientId || !templateId || !title.trim()) {
      setError("Pick a client, choose how to start, and enter a title.");
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch("/api/surveys/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isFromScratch
          ? { clientId, fromScratch: true, title: title.trim() }
          : { clientId, templateId, title: title.trim() }
      ),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create session.");
      setSaving(false);
      return;
    }
    const created = await res.json();
    router.push(`/tools/surveys/${created.id}`);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-7 pt-6 pb-5">
        <nav className="flex items-center gap-1.5 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Link href="/tools" className="hover:underline">Tools</Link>
          <span>/</span>
          <Link href="/tools/surveys" className="hover:underline">Survey</Link>
          <span>/</span>
          <span>New session</span>
        </nav>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>New session</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Pick a client, choose to start from scratch or from a template, then share the link with participants.
        </p>
      </div>

      <div className="px-7 pb-7 max-w-2xl">
        <div className="mb-5">
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Client *</label>
          <ClientDropdown
            clients={clients}
            selectedClientId={clientId}
            onSelect={setClientId}
            loading={loading}
          />
        </div>

        <div className="mb-5">
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>How do you want to start? *</label>
          {loading ? (
            <div className="h-10 rounded-button border animate-pulse" style={{ borderColor: "var(--border)", background: "var(--bg-hover)" }} />
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setTemplateId(FROM_SCRATCH)}
                className="w-full text-left p-4 rounded-card border transition-colors"
                style={{
                  borderColor: isFromScratch ? "var(--primary)" : "var(--border)",
                  background: isFromScratch ? "var(--primary-light)" : "var(--bg-surface)",
                  boxShadow: isFromScratch ? "0 0 0 1px var(--primary)" : undefined,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                  >
                    <Sparkles size={18} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Start from scratch
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Empty survey — build sections, questions and comparisons in the editor.
                    </p>
                  </div>
                </div>
              </button>

              {templates.length > 0 && (
                <p
                  className="typo-section-header pt-3 pb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Or pick a template
                </p>
              )}

              {templates.map((t) => {
                const isSelected = t.id === templateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className="w-full text-left p-4 rounded-card border transition-colors"
                    style={{
                      borderColor: isSelected ? "var(--primary)" : "var(--border)",
                      background: isSelected ? "var(--primary-light)" : "var(--bg-surface)",
                      boxShadow: isSelected ? "0 0 0 1px var(--primary)" : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {t.name}
                        </p>
                        {t.description && (
                          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                            {t.description}
                          </p>
                        )}
                      </div>
                      <div className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                        {t.sectionCount ?? 0} sections · {t.questionCount ?? 0} questions · {t.archetypeIds.length} archetypes
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {showTitleStep && (
          <>
            <div className="mb-4">
              <label className="typo-label" style={{ color: "var(--text-muted)" }}>Session title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Culture survey 2026"
                className="w-full px-3 py-2 rounded-button border text-sm"
                style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
              />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-button text-sm" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={saving}
              className="btn-primary rounded-lg text-sm px-5 py-2.5 inline-flex items-center gap-1.5"
            >
              {saving ? "Creating..." : "Create session"}
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
