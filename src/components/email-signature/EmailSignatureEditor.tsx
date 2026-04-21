"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, Copy } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import EmailSignaturePreview from "./EmailSignaturePreview";
import { buildSignatureHtml, initialsPlaceholderDataUrl } from "./buildSignatureHtml";

export interface SignatureUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  jobTitle: string;
  phone: string;
}

type CopyState = "idle" | "signature";

export default function EmailSignatureEditor({
  initialUser,
  allUsers,
  canGenerateAny,
  currentUserId,
}: {
  initialUser: SignatureUser;
  allUsers: SignatureUser[];
  canGenerateAny: boolean;
  currentUserId: string;
}) {
  const [selectedUserId, setSelectedUserId] = useState(initialUser.id);
  const [photo, setPhoto] = useState<{ userId: string; dataUrl: string | null } | null>(null);
  const [copied, setCopied] = useState<CopyState>("idle");
  const [showInstructions, setShowInstructions] = useState(false);

  const selectedUser = useMemo<SignatureUser>(() => {
    if (canGenerateAny) {
      return allUsers.find((u) => u.id === selectedUserId) ?? initialUser;
    }
    return initialUser;
  }, [canGenerateAny, allUsers, selectedUserId, initialUser]);

  const isSelf = selectedUser.id === currentUserId;
  const photoLoading = photo?.userId !== selectedUser.id;
  const photoDataUrl = photo?.userId === selectedUser.id ? photo.dataUrl : null;

  useEffect(() => {
    let cancelled = false;
    const userId = selectedUser.id;
    fetch(`/api/tools/email-signature/photo?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : { dataUrl: null }))
      .then((data: { dataUrl: string | null }) => {
        if (!cancelled) setPhoto({ userId, dataUrl: data.dataUrl });
      })
      .catch(() => {
        if (!cancelled) setPhoto({ userId, dataUrl: null });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUser.id]);

  const signatureHtml = useMemo(() => {
    const resolvedPhoto = photoDataUrl ?? initialsPlaceholderDataUrl(selectedUser.name);
    return buildSignatureHtml({
      name: selectedUser.name,
      jobTitle: selectedUser.jobTitle || "—",
      email: selectedUser.email,
      phone: selectedUser.phone || "—",
      photoDataUrl: resolvedPhoto,
    });
  }, [photoDataUrl, selectedUser]);

  const missingFields: string[] = [];
  if (!selectedUser.jobTitle) missingFields.push("Job title");
  if (!selectedUser.phone) missingFields.push("Phone");

  async function handleCopySignature() {
    try {
      const blob = new Blob([signatureHtml], { type: "text/html" });
      const plain = new Blob([signatureHtml], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob, "text/plain": plain }),
      ]);
      setCopied("signature");
      setTimeout(() => setCopied("idle"), 2000);
    } catch {
      await navigator.clipboard.writeText(signatureHtml);
      setCopied("signature");
      setTimeout(() => setCopied("idle"), 2000);
    }
  }

  const editLink = isSelf
    ? "/profile"
    : `/admin/employees/${selectedUser.id}`;

  return (
    <div className="px-7 pb-7 pt-6 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Details + actions */}
        <div className="space-y-6">
          {canGenerateAny && (
            <div>
              <label className="typo-label" style={{ color: "var(--text-muted)" }}>
                Signature voor
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.id === currentUserId ? "(jij)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            className="rounded-card border p-5"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          >
            <div className="flex items-start gap-4">
              <UserAvatar name={selectedUser.name} image={selectedUser.image} size={56} />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="typo-card-title" style={{ color: "var(--text-primary)" }}>
                  {selectedUser.name}
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {selectedUser.jobTitle || (
                    <em style={{ color: "var(--warning)" }}>Nog geen functietitel</em>
                  )}
                </p>
                <div className="mt-2 space-y-0.5 text-sm" style={{ color: "var(--text-primary)" }}>
                  <div>{selectedUser.email}</div>
                  <div>
                    {selectedUser.phone || (
                      <em style={{ color: "var(--warning)" }}>Nog geen telefoonnummer</em>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {missingFields.length > 0 && (
            <div
              className="rounded-card border p-4 flex items-start gap-3 text-sm"
              style={{
                borderColor: "color-mix(in srgb, var(--warning) 40%, transparent)",
                background: "color-mix(in srgb, var(--warning) 8%, transparent)",
                color: "var(--text-primary)",
              }}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
              <div className="space-y-1">
                <p>
                  <strong>Ontbrekende gegevens:</strong> {missingFields.join(", ")}.
                </p>
                {isSelf ? (
                  !selectedUser.jobTitle && selectedUser.phone ? (
                    <p style={{ color: "var(--text-muted)" }}>
                      Je functietitel wordt door een admin ingesteld.
                    </p>
                  ) : !selectedUser.phone && selectedUser.jobTitle ? (
                    <p>
                      <Link href="/profile" className="btn-link">
                        Ga naar je profiel
                      </Link>{" "}
                      om je telefoonnummer in te vullen.
                    </p>
                  ) : (
                    <p>
                      Vul je telefoonnummer in via{" "}
                      <Link href="/profile" className="btn-link">
                        je profiel
                      </Link>
                      . Je functietitel wordt door een admin ingesteld.
                    </p>
                  )
                ) : (
                  <p>
                    <Link href={editLink} className="btn-link">
                      Bewerk deze medewerker
                    </Link>{" "}
                    om de ontbrekende velden in te vullen.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopySignature}
              disabled={photoLoading}
              className="btn-primary text-sm px-4 py-2 rounded-lg flex items-center gap-2"
            >
              {copied === "signature" ? <Check size={14} /> : <Copy size={14} />}
              {copied === "signature" ? "Gekopieerd" : "Kopieer signature"}
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowInstructions((s) => !s)}
              className="flex items-center gap-1.5 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              <ChevronDown
                size={14}
                className="transition-transform"
                style={{ transform: showInstructions ? "rotate(0deg)" : "rotate(-90deg)" }}
              />
              Installatie-instructies
            </button>
            {showInstructions && (
              <div
                className="mt-3 rounded-card border p-5 space-y-5 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
              >
                <div>
                  <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>Gmail</p>
                  <ol className="list-decimal pl-5 space-y-1" style={{ color: "var(--text-primary)" }}>
                    <li>Klik op <strong>&quot;Kopieer signature&quot;</strong> hierboven.</li>
                    <li>Open Gmail → Instellingen (⚙️) → <strong>Alle instellingen bekijken</strong>.</li>
                    <li>Scroll onder <strong>Algemeen</strong> naar <strong>Handtekening</strong> en maak of bewerk er een.</li>
                    <li>Klik in de editor en plak (Cmd+V / Ctrl+V).</li>
                    <li>Scroll naar beneden en klik op <strong>Wijzigingen opslaan</strong>.</li>
                  </ol>
                </div>
                <div>
                  <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>Apple Mail</p>
                  <ol className="list-decimal pl-5 space-y-1" style={{ color: "var(--text-primary)" }}>
                    <li>Klik op <strong>&quot;Kopieer signature&quot;</strong> hierboven.</li>
                    <li>Open Mail → <strong>Instellingen</strong> → <strong>Handtekeningen</strong>.</li>
                    <li>Klik op <strong>+</strong> om een nieuwe handtekening te maken.</li>
                    <li><strong>Vink uit</strong>: &quot;Gebruik altijd mijn standaardlettertype&quot; onder de editor.</li>
                    <li>Klik in de editor, selecteer alles (Cmd+A) en plak (Cmd+V).</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div>
          <label className="typo-label mb-2" style={{ color: "var(--text-muted)" }}>
            Preview
          </label>
          {photoLoading ? (
            <div
              className="rounded-card border p-6 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-muted)" }}
            >
              Foto laden…
            </div>
          ) : (
            <EmailSignaturePreview html={signatureHtml} />
          )}
        </div>
      </div>
    </div>
  );
}
