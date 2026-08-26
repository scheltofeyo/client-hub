"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import { clientColor } from "@/lib/styles";

function initials(company: string): string {
  return company.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

/**
 * Hex field for a client's brand colour, with a live avatar preview and a
 * native colour picker. An empty value means "fall back to the automatic
 * colour", which is why the input allows being cleared.
 */
export default function PrimaryColorField({
  company,
  value,
  onChange,
  disabled,
}: {
  company: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [hexInput, setHexInput] = useState(value.replace(/^#/, ""));

  function applyHex(raw: string) {
    const clean = raw.replace(/^#/, "").slice(0, 6);
    setHexInput(clean);
    if (clean === "") {
      onChange("");
    } else if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      onChange(`#${clean.toUpperCase()}`);
    }
  }

  const preview = clientColor({ company: company || "Preview", primaryColor: value || undefined });
  const abbr = initials(company || "Preview");
  const hasHex = /^#[0-9a-fA-F]{6}$/.test(value);
  const pickerFg = hasHex ? clientColor({ company: "", primaryColor: value }).fg : "var(--text-muted)";

  return (
    <div>
      <label className="typo-label">Primary color</label>
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border"
          style={{ background: preview.bg, color: preview.fg, borderColor: "var(--border)" }}
          title="Preview"
        >
          {abbr}
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>#</span>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => applyHex(e.target.value)}
            onBlur={() => {
              if (hexInput !== "" && !/^[0-9a-fA-F]{6}$/.test(hexInput)) {
                setHexInput(value.replace(/^#/, ""));
              }
            }}
            maxLength={6}
            disabled={disabled}
            placeholder="auto"
            className={inputClass + " font-mono"}
            style={inputStyle}
          />
          <label
            className="relative w-9 h-9 rounded-lg shrink-0 cursor-pointer inline-flex items-center justify-center border"
            style={{
              background: hasHex ? value : "var(--bg-elevated)",
              borderColor: "var(--border)",
            }}
            title="Pick a colour"
          >
            <Pencil size={13} style={{ color: pickerFg }} />
            <input
              type="color"
              value={hasHex ? value : "#7C3AED"}
              onChange={(e) => applyHex(e.target.value)}
              disabled={disabled}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        </div>
      </div>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        Leave empty to use the automatic color.
      </p>
    </div>
  );
}
