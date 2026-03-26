"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import Image from "next/image";

interface Props {
  name: string;
  email: string;
  image?: string | null;
  isAdmin: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function UserMenu({ name, email, image, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-semibold text-white ring-2 ring-transparent hover:ring-purple-400 transition-all"
        style={{ background: "var(--primary)" }}
        title={name}
      >
        {image ? (
          <Image src={image} alt={name} width={32} height={32} className="object-cover" />
        ) : (
          initials(name)
        )}
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
            onClick={() => signOut({ callbackUrl: "/login" })}
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
