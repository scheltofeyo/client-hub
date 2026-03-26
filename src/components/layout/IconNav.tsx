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
  Building2,
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

export default function IconNav({ user }: Props) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <nav
      className="w-[69px] shrink-0 flex flex-col items-center py-6"
      style={{ background: "var(--bg-app)" }}
    >
      {/* Logo */}
      <div
        className="w-[45px] h-[44px] rounded-xl flex items-center justify-center mb-5 shrink-0"
        style={{ background: "var(--primary)" }}
      >
        <Building2 size={16} color="#fff" strokeWidth={2} />
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
