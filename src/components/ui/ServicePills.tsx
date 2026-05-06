"use client";

import type { Service } from "@/types";
import { inputClass, inputStyle } from "@/components/ui/form-styles";

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
      <label className="typo-label">
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </label>
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        <option value="">— Select a service —</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
