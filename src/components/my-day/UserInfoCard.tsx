"use client";

import { Briefcase, FolderKanban, CheckSquare, BookOpen, Mail } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import type { MyDayUserInfo } from "@/types";
import { accentColor } from "@/lib/styles";

export default function UserInfoCard({ info }: { info: MyDayUserInfo }) {
  const color = accentColor(info.name);

  const stats = [
    { icon: Briefcase, label: "Active clients", value: info.activeClientCount },
    { icon: FolderKanban, label: "Active projects", value: info.activeProjectCount },
    { icon: CheckSquare, label: "Open tasks", value: info.openTaskCount },
    { icon: BookOpen, label: "Open follow-ups", value: info.openFollowUpCount },
  ];

  return (
    <div
      className="w-full rounded-xl border flex flex-col sticky top-6 overflow-hidden bg-white dark:bg-[var(--bg-sidebar)]"
      style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
    >
      {/* Tinted header with avatar */}
      <div
        className="relative flex items-start px-5 pt-5 shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 8%, transparent)`, height: "52px" }}
      >
        {info.roleName && (
          <span
            className="absolute top-3.5 right-4 px-2 py-0.5 rounded-full text-xs font-medium border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg-elevated)" }}
          >
            {info.roleName}
          </span>
        )}
        <div className="relative" style={{ marginBottom: "-24px", zIndex: 10 }}>
          <UserAvatar name={info.name} image={info.image} size={48} />
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-4 px-5 pt-9 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="typo-modal-title leading-tight" style={{ color: "var(--text-primary)" }}>
            {info.name}
          </h2>
          {info.email && (
            <div className="flex items-center gap-2">
              <Mail size={13} style={{ color: "var(--text-muted)" }} className="flex-none" />
              <span className="text-sm truncate" style={{ color: "var(--text-muted)" }}>
                {info.email}
              </span>
            </div>
          )}
        </div>

        <hr style={{ borderColor: "var(--border)" }} />

        <div className="flex flex-col gap-3">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Icon size={14} style={{ color: "var(--text-muted)" }} className="flex-none" />
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
              </div>
              <span className="typo-card-title" style={{ color: "var(--text-primary)" }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
