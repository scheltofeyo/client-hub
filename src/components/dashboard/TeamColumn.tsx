"use client";

import { useMemo } from "react";
import { Cake, Users, Star, AlertTriangle } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import DayPanel from "./DayPanel";
import type { WeekCalendarItem } from "@/lib/utils";
import type { WeekTeamData, TimeOffEntry } from "@/types";

interface Props {
  selectedDate: string;
  teamData: WeekTeamData;
  items: WeekCalendarItem[]; // all items for this day (for workload)
}

function portionLabel(entry: TimeOffEntry, date: string): string {
  if (entry.startDate === entry.endDate) {
    if (entry.startDayPortion === "am") return "AM only";
    if (entry.startDayPortion === "pm") return "PM only";
    return "";
  }
  if (date === entry.startDate) {
    if (entry.startDayPortion === "pm") return "PM only";
    return "";
  }
  if (date === entry.endDate) {
    if (entry.endDayPortion === "am") return "AM only";
    return "";
  }
  return "";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="typo-tag mb-1.5" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

export default function TeamColumn({ selectedDate, teamData, items }: Props) {
  const dayTimeOff = useMemo(
    () => teamData.timeOff.filter((e) => selectedDate >= e.startDate && selectedDate <= e.endDate),
    [teamData.timeOff, selectedDate]
  );

  const companyHoliday = useMemo(
    () => teamData.companyHolidays.find((h) => h.date === selectedDate),
    [teamData.companyHolidays, selectedDate]
  );

  const dayBirthdays = useMemo(
    () => teamData.birthdays.filter((b) => b.date === selectedDate),
    [teamData.birthdays, selectedDate]
  );

  const leaveTypeMap = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>();
    for (const lt of teamData.leaveTypes) map.set(lt.slug, { label: lt.label, color: lt.color });
    return map;
  }, [teamData.leaveTypes]);

  // Workload: group deadline items by lead for this day
  const workloadEntries = useMemo(() => {
    const deadlines = items.filter((i) => i.type === "deadline");
    const byUser = new Map<string, { name: string; image?: string; count: number }>();
    for (const item of deadlines) {
      for (const lead of item.leads) {
        const existing = byUser.get(lead.userId);
        if (existing) existing.count++;
        else byUser.set(lead.userId, { name: lead.name, image: lead.image, count: 1 });
      }
    }
    return Array.from(byUser.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const totalPeople = dayTimeOff.length;
  const isEmpty =
    totalPeople === 0 && dayBirthdays.length === 0 && !companyHoliday && workloadEntries.length === 0;

  return (
    <DayPanel
      title="Team"
      icon={Users}
      count={totalPeople}
      countSuffix="off"
      isEmpty={isEmpty}
      emptyIcon={Users}
      emptyLabel="Full team available"
    >
      <div className="space-y-4">
        {/* Company holiday banner */}
        {companyHoliday && (
          <div
            className="flex items-center gap-2 rounded-button px-3 py-2"
            style={{ background: "var(--primary-light)" }}
          >
            <Star size={14} style={{ color: "var(--primary)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>
              {companyHoliday.label}
            </span>
          </div>
        )}

        {/* Time off */}
        {dayTimeOff.length > 0 && (
          <div>
            <SectionLabel>Time off</SectionLabel>
            <div className="-mx-1 space-y-0.5">
              {dayTimeOff.map((entry) => {
                const lt = leaveTypeMap.get(entry.leaveTypeSlug);
                const portion = portionLabel(entry, selectedDate);
                return (
                  <div key={entry.id} className="flex items-center gap-2.5 rounded-button px-1 py-1.5">
                    <UserAvatar name={entry.userName ?? ""} image={entry.userImage ?? null} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {entry.userName}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {lt && (
                          <span
                            className="rounded-badge px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ background: lt.color + "1a", color: lt.color }}
                          >
                            {lt.label}
                          </span>
                        )}
                        {portion && (
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {portion}
                          </span>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-muted)" }}>
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Workload indicators */}
        {workloadEntries.length > 0 && (
          <div>
            <SectionLabel>Workload</SectionLabel>
            <div className="-mx-1 space-y-0.5">
              {workloadEntries.map((entry) => {
                const heavy = entry.count >= 3;
                return (
                  <div key={entry.userId} className="flex items-center gap-2.5 rounded-button px-1 py-1.5">
                    <UserAvatar name={entry.name} image={entry.image ?? null} size={28} />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {entry.name}
                    </p>
                    <div
                      className="flex items-center gap-1 rounded-badge px-2 py-0.5"
                      style={{
                        background: heavy ? "var(--danger-light)" : "var(--bg-neutral)",
                        color: heavy ? "var(--danger)" : "var(--text-muted)",
                      }}
                    >
                      {heavy && <AlertTriangle size={12} />}
                      <span className="text-xs font-medium tabular-nums">
                        {entry.count} deadline{entry.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Birthdays */}
        {dayBirthdays.length > 0 && (
          <div>
            <SectionLabel>Birthdays</SectionLabel>
            <div className="-mx-1 space-y-0.5">
              {dayBirthdays.map((b) => (
                <div key={b.userId} className="flex items-center gap-2.5 rounded-button px-1 py-1.5">
                  <UserAvatar name={b.userName} image={b.userImage} size={28} />
                  <p className="flex-1 truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {b.userName}
                  </p>
                  <Cake size={16} style={{ color: "var(--birthday)" }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DayPanel>
  );
}
