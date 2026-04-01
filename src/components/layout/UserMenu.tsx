"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  const name = session?.user?.name ?? "";
  const email = session?.user?.email ?? "";
  const image = session?.user?.image ?? null;
  const isAdmin = session?.user?.isAdmin ?? false;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full ring-2 ring-transparent hover:ring-[var(--primary)] transition-all"
        title={name}
      >
        <UserAvatar name={name} image={image} size={32} />
      </button>

      {open && (
        <div
          className="absolute bottom-0 left-full ml-2 w-52 rounded-xl shadow-xl py-1 z-50"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          <div className="px-3 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {name}
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
              {email}
            </p>
            {isAdmin && (
              <span
                className="inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                Admin
              </span>
            )}
          </div>
          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors btn-ghost"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
