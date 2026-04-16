"use client";

import { useState, useEffect } from "react";

const sections = [
  { label: "General",       value: "about"    },
  { label: "Client Leads", value: "leads"    },
  { label: "Contacts",     value: "contacts" },
  { label: "Platform",    value: "platform" },
  { label: "Culture",     value: "culture"  },
];

export default function AboutTertiaryNav({ clientId }: { clientId: string }) {
  const [section, setSection] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("section") ?? "about";
    }
    return "about";
  });

  // Listen for section changes from the shell
  useEffect(() => {
    function handleSectionChange(e: Event) {
      const { section: sec } = (e as CustomEvent).detail ?? {};
      if (sec) setSection(sec);
    }
    window.addEventListener("section-change", handleSectionChange);
    return () => window.removeEventListener("section-change", handleSectionChange);
  }, []);

  function handleClick(e: React.MouseEvent, value: string) {
    e.preventDefault();
    setSection(value);
    window.history.replaceState(null, "", `/clients/${clientId}?tab=settings&section=${value}`);
    window.dispatchEvent(new CustomEvent("section-change", { detail: { section: value } }));
  }

  return (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      {sections.map(({ label, value }) => {
        const active = section === value;
        return (
          <a
            key={value}
            href={`/clients/${clientId}?tab=settings&section=${value}`}
            onClick={(e) => handleClick(e, value)}
            className="px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: active ? "var(--primary)" : "transparent",
              color:       active ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
