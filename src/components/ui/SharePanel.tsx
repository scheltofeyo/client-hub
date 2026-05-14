"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

export function useShareLink(shareUrl: string) {
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return { copied, copyLink };
}

export function useShareQr(filenameHint?: string) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [qrCopied, setQrCopied] = useState(false);
  async function copyQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setQrCopied(true);
        setTimeout(() => setQrCopied(false), 2000);
      }
    } catch {
      // Fallback: trigger a download
      const link = document.createElement("a");
      link.download = `qr-${filenameHint ?? "share"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  }
  return { qrRef, qrCopied, copyQr };
}

export function HiddenQrCanvas({
  shareUrl,
  qrRef,
  size = 400,
}: {
  shareUrl: string;
  qrRef: React.RefObject<HTMLDivElement | null>;
  size?: number;
}) {
  return (
    <div ref={qrRef} className="hidden">
      <QRCodeCanvas value={shareUrl} size={size} level="M" marginSize={2} />
    </div>
  );
}

export function ShareLinkRow({ shareUrl }: { shareUrl: string }) {
  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
      <p className="typo-section-header mb-1" style={{ color: "var(--text-muted)" }}>Share link</p>
      <p className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>{shareUrl}</p>
    </div>
  );
}
