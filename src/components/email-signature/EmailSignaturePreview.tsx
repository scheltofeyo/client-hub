"use client";

export default function EmailSignaturePreview({ html }: { html: string }) {
  return (
    <div
      className="rounded-card border p-6"
      style={{
        borderColor: "var(--border)",
        background: "#ffffff",
        color: "#1a1a1a",
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
