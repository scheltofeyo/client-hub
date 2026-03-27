"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const sections = [
  { label: "General",       value: "about"    },
  { label: "Client Leads", value: "leads"    },
  { label: "Contacts",     value: "contacts" },
];

export default function AboutTertiaryNav({ clientId }: { clientId: string }) {
  const searchParams = useSearchParams();
  const section = searchParams.get("section") ?? "about";

  return (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      {sections.map(({ label, value }) => {
        const active = section === value;
        return (
          <Link
            key={value}
            href={`/clients/${clientId}?section=${value}`}
            className="px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: active ? "var(--primary)" : "transparent",
              color:       active ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
