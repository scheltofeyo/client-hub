"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CheckSquare,
  Users,
  MessageSquare,
  ShieldCheck,
  Settings,
  Calendar,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

const topItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

interface Props {
  user: {
    name: string;
    email: string;
    image?: string | null;
    isAdmin: boolean;
  };
}

function openCalendarPopup() {
  const w = Math.min(Math.round(window.screen.width * 0.85), 1200);
  const h = Math.round(window.screen.height * 0.9);
  const left = Math.round((window.screen.width - w) / 2);
  const top = Math.round((window.screen.height - h) / 2);
  window.open(
    "https://calendar.google.com",
    "google-calendar",
    `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0,location=0,status=0`
  );
}

export default function IconNav({ user }: Props) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <nav
      className="w-[69px] shrink-0 flex flex-col items-center py-6"
      style={{ background: "var(--bg-app)" }}
    >
      {/* Logo */}
      <div className="w-[45px] h-[44px] flex items-center justify-center mb-5 shrink-0">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1.5" fill="var(--primary)" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" fill="var(--primary)" opacity="0.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" fill="var(--primary)" opacity="0.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--primary)" />
        </svg>
      </div>

      {/* Top nav */}
      <div className="flex flex-col items-center gap-2 w-full px-3">
        {topItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              data-active={active}
              className="flex items-center justify-center rounded-xl w-[44px] h-[44px] transition-colors nav-icon-item"
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            </Link>
          );
        })}
        <button
          onClick={openCalendarPopup}
          aria-label="Calendar"
          className="flex items-center justify-center rounded-xl w-[44px] h-[44px] transition-colors nav-icon-item"
        >
          <Calendar size={17} strokeWidth={1.8} />
        </button>
      </div>

      {/* Bottom nav */}
      <div className="mt-auto flex flex-col items-center gap-2 w-full px-3">
        <ThemeToggle />
        {user.isAdmin && (
          <Link
            href="/admin"
            data-active={isActive("/admin")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-xl w-full transition-colors nav-icon-item"
          >
            <ShieldCheck size={17} strokeWidth={isActive("/admin") ? 2.2 : 1.8} />
            <span className="text-[10px] leading-none font-medium">Admin</span>
          </Link>
        )}
        <Link
          href="/settings"
          data-active={isActive("/settings")}
          className="flex flex-col items-center gap-0.5 py-1.5 rounded-xl w-full transition-colors nav-icon-item"
        >
          <Settings size={17} strokeWidth={isActive("/settings") ? 2.2 : 1.8} />
          <span className="text-[10px] leading-none font-medium">Settings</span>
        </Link>
        <UserMenu
          name={user.name}
          email={user.email}
          image={user.image}
          isAdmin={user.isAdmin}
        />
      </div>
    </nav>
  );
}
