"use client";

import { useState, useEffect } from "react";

type Subtab = "projects" | "plans";

const tabs: { label: string; value: Subtab }[] = [
  { label: "Projects", value: "projects" },
  { label: "Plans",    value: "plans"    },
];

export default function ProjectsTertiaryNav({
  clientId,
  canViewPlans,
}: {
  clientId: string;
  canViewPlans: boolean;
}) {
  const [subtab, setSubtab] = useState<Subtab>(() => {
    if (typeof window !== "undefined") {
      const v = new URLSearchParams(window.location.search).get("subtab");
      return v === "plans" ? "plans" : "projects";
    }
    return "projects";
  });

  useEffect(() => {
    function handleSubtabChange(e: Event) {
      const { subtab: s } = (e as CustomEvent).detail ?? {};
      if (s === "projects" || s === "plans") setSubtab(s);
    }
    window.addEventListener("projects-subtab-change", handleSubtabChange);
    return () => window.removeEventListener("projects-subtab-change", handleSubtabChange);
  }, []);

  function handleClick(e: React.MouseEvent, value: Subtab) {
    e.preventDefault();
    setSubtab(value);
    const url = value === "projects"
      ? `/clients/${clientId}?tab=projects`
      : `/clients/${clientId}?tab=projects&subtab=${value}`;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new CustomEvent("projects-subtab-change", { detail: { subtab: value } }));
  }

  const visibleTabs = tabs.filter((t) => t.value !== "plans" || canViewPlans);

  return (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      {visibleTabs.map(({ label, value }) => {
        const active = subtab === value;
        const href = value === "projects"
          ? `/clients/${clientId}?tab=projects`
          : `/clients/${clientId}?tab=projects&subtab=${value}`;
        return (
          <a
            key={value}
            href={href}
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
