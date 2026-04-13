"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { LogOut, UserPen, Moon, Sun, FileText } from "lucide-react";
import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  const name = session?.user?.name ?? "";
  const email = session?.user?.email ?? "";
  const image = session?.user?.image ?? null;
  const canAccessAdmin = (session?.user?.permissions ?? []).includes("admin.access");

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

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
        className="inline-flex rounded-full ring-2 ring-transparent hover:ring-[var(--primary)] transition-all p-0 leading-none"
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
            {canAccessAdmin && (
              <span
                className="inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                Admin
              </span>
            )}
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors btn-ghost"
          >
            <UserPen size={13} />
            Edit Profile
          </Link>
          {mounted && (
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors btn-ghost"
            >
              <span className="flex items-center gap-2">
                {dark ? <Sun size={13} /> : <Moon size={13} />}
                Dark mode
              </span>
              <span
                className="relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors"
                style={{ background: dark ? "var(--primary)" : "var(--border-strong)" }}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform"
                  style={{ transform: dark ? "translate(13px, 2px)" : "translate(2px, 2px)" }}
                />
              </span>
            </button>
          )}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors btn-ghost"
          >
            <FileText size={13} />
            Release Notes
          </Link>
          <form action="/api/auth/sign-out" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors btn-ghost"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
