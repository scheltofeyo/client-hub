"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, Dna } from "lucide-react";
import { accentColor } from "@/lib/styles";
import type { CulturalDnaValue } from "@/types";

export interface ClientOption {
  id: string;
  company: string;
  culturalDna: CulturalDnaValue[];
  leads: { userId: string; name: string; email: string }[];
}

export function initials(company: string): string {
  return company
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function DnaBadge({ count }: { count: number }) {
  return count > 0 ? (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
      style={{ background: "var(--success-light)", color: "var(--success)" }}
    >
      <Dna size={11} />
      {count}
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
      style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
    >
      <Dna size={11} />
      —
    </span>
  );
}

export function ClientDropdown({
  clients,
  selectedClientId,
  onSelect,
  loading,
}: {
  clients: ClientOption[];
  selectedClientId: string;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const { data: authSession } = useSession();
  const currentUserId = authSession?.user?.id;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const myClients = useMemo(
    () => (currentUserId ? clients.filter((c) => c.leads.some((l) => l.userId === currentUserId)) : []),
    [clients, currentUserId]
  );
  const otherClients = useMemo(
    () => (currentUserId ? clients.filter((c) => !c.leads.some((l) => l.userId === currentUserId)) : clients),
    [clients, currentUserId]
  );
  const hasSections = myClients.length > 0;

  const selected = clients.find((c) => c.id === selectedClientId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  const q = search.toLowerCase();
  const filterList = (list: ClientOption[]) =>
    q ? list.filter((c) => c.company.toLowerCase().includes(q)) : list;

  const filteredMy = filterList(myClients);
  const filteredOther = filterList(otherClients);
  const filteredAll = filterList(clients);

  function select(id: string) {
    onSelect(id);
    setOpen(false);
    setSearch("");
  }

  function renderRow(c: ClientOption) {
    const color = accentColor(c.company);
    const abbr = initials(c.company);
    const isSelected = c.id === selectedClientId;
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => select(c.id)}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors rounded-md"
        style={{
          background: isSelected ? "var(--primary-light)" : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = "";
        }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0"
          style={{ background: color }}
        >
          {abbr}
        </div>
        <span
          className="text-sm truncate flex-1 min-w-0"
          style={{ color: "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}
        >
          {c.company}
        </span>
        <DnaBadge count={c.culturalDna.length} />
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !loading && setOpen(!open)}
        disabled={loading}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-button border text-sm transition-colors"
        style={{
          borderColor: open ? "var(--primary)" : "var(--border)",
          background: "var(--bg-surface)",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: open ? "0 0 0 1px var(--primary)" : undefined,
        }}
      >
        {selected ? (
          <>
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0"
              style={{ background: accentColor(selected.company) }}
            >
              {initials(selected.company)}
            </div>
            <span className="font-medium truncate flex-1 text-left">{selected.company}</span>
            <DnaBadge count={selected.culturalDna.length} />
          </>
        ) : (
          <span className="flex-1 text-left">Select a client...</span>
        )}
        <ChevronDown
          size={16}
          className="shrink-0 transition-transform"
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : undefined,
          }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-card border shadow-dropdown overflow-hidden"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client..."
              className="w-full px-2.5 py-1.5 rounded-button border text-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {hasSections ? (
              <>
                {filteredMy.length > 0 && (
                  <div className="mb-1">
                    <div
                      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-muted)" }}
                    >
                      My clients
                    </div>
                    {filteredMy.map(renderRow)}
                  </div>
                )}
                {filteredOther.length > 0 && (
                  <div>
                    {filteredMy.length > 0 && (
                      <div className="mx-2 my-1 border-t" style={{ borderColor: "var(--border)" }} />
                    )}
                    <div
                      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Other clients
                    </div>
                    {filteredOther.map(renderRow)}
                  </div>
                )}
                {filteredMy.length === 0 && filteredOther.length === 0 && (
                  <div className="px-3 py-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    No results
                  </div>
                )}
              </>
            ) : (
              <>
                {filteredAll.length > 0 ? (
                  filteredAll.map(renderRow)
                ) : (
                  <div className="px-3 py-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    No results
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
