"use client";

import type { Service } from "@/types";

interface ServicePillsProps {
  services: Service[];
  selectedId: string;
  onChange: (id: string) => void;
  label?: string;
  required?: boolean;
}

export default function ServicePills({
  services,
  selectedId,
  onChange,
  label = "Service",
  required = false,
}: ServicePillsProps) {
  return (
    <div>
      <p
        className="typo-label"
      >
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {services.map((s) => {
          const selected = selectedId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className="px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors"
              style={
                selected
                  ? {
                      background: "var(--primary)",
                      borderColor: "var(--primary)",
                      color: "#fff",
                    }
                  : {
                      background: "var(--bg-sidebar)",
                      borderColor: "var(--border)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
