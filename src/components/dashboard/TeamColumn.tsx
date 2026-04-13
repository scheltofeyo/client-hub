"use client";

import { useMemo } from "react";
import { Cake, CheckCircle2, Star, AlertTriangle } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import type { WeekCalendarItem } from "@/lib/utils";
import type { WeekTeamData, TimeOffEntry } from "@/types";

interface Props {
  selectedDate: string;
  teamData: WeekTeamData;
  items: WeekCalendarItem[]; // all items for this day (for workload)
}

function portionLabel(entry: TimeOffEntry, date: string): string {
  // If single-day entry, use startDayPortion
  if (entry.startDate === entry.endDate) {
    if (entry.startDayPortion === "am") return "AM only";
    if (entry.startDayPortion === "pm") return "PM only";
    return "";
  }
  // Multi-day: check if this is the start day, end day, or middle
  if (date === entry.startDate) {
    if (entry.startDayPortion === "pm") return "PM only";
    if (entry.startDayPortion === "am") return ""; // starts in AM = full day from here
    return "";
  }
  if (date === entry.endDate) {
    if (entry.endDayPortion === "am") return "AM only";
    if (entry.endDayPortion === "pm") return ""; // ends in PM = full day
    return "";
  }
  return ""; // middle day = full day
}

export default function TeamColumn({ selectedDate, teamData, items }: Props) {
  // Time-off entries for this day
  const dayTimeOff = useMemo(() => {
    return teamData.timeOff.filter(
      (e) => selectedDate >= e.startDate && selectedDate <= e.endDate
    );
  }, [teamData.timeOff, selectedDate]);

  // Company holiday for this day
  const companyHoliday = useMemo(() => {
    return teamData.companyHolidays.find((h) => h.date === selectedDate);
  }, [teamData.companyHolidays, selectedDate]);

  // Birthdays for this day
  const dayBirthdays = useMemo(() => {
    return teamData.birthdays.filter((b) => b.date === selectedDate);
  }, [teamData.birthdays, selectedDate]);

  // Leave type map
  const leaveTypeMap = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>();
    for (const lt of teamData.leaveTypes) {
      map.set(lt.slug, { label: lt.label, color: lt.color });
    }
    return map;
  }, [teamData.leaveTypes]);

  // Workload: group deadline items by lead for this day
  const workloadEntries = useMemo(() => {
    const deadlines = items.filter((i) => i.type === "deadline");
    const byUser = new Map<string, { name: string; image?: string; count: number }>();
    for (const item of deadlines) {
      for (const lead of item.leads) {
        const existing = byUser.get(lead.userId);
        if (existing) {
          existing.count++;
        } else {
          byUser.set(lead.userId, { name: lead.name, image: lead.image, count: 1 });
        }
      }
    }
    return Array.from(byUser.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const totalPeople = dayTimeOff.length;
  const isEmpty = totalPeople === 0 && dayBirthdays.length === 0 && !companyHoliday && workloadEntries.length === 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="typo-card-title" style={{ color: "var(--text-primary)" }}>
          Team
        </h3>
        {totalPeople > 0 && (
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
          >
            {totalPeople} off
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-2">
          <CheckCircle2 size={24} style={{ color: "var(--text-muted-light)" }} />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Full team available
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Company holiday banner */}
          {companyHoliday && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
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
            <div className="space-y-2">
              <p className="typo-tag" style={{ color: "var(--text-muted)" }}>
                Time off
              </p>
              {dayTimeOff.map((entry) => {
                const lt = leaveTypeMap.get(entry.leaveTypeSlug);
                const portion = portionLabel(entry, selectedDate);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
                    style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
                  >
                    <UserAvatar
                      name={entry.userName ?? ""}
                      image={entry.userImage ?? null}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {entry.userName}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {lt && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
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
                        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Workload indicators */}
          {workloadEntries.length > 0 && (
            <div className="space-y-2">
              <p className="typo-tag" style={{ color: "var(--text-muted)" }}>
                Workload
              </p>
              {workloadEntries.map((entry) => (
                <div
                  key={entry.userId}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
                >
                  <UserAvatar
                    name={entry.name}
                    image={entry.image ?? null}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {entry.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle size={12} style={{ color: entry.count >= 3 ? "var(--danger)" : "var(--text-muted)" }} />
                    <span
                      className="text-xs font-medium"
                      style={{ color: entry.count >= 3 ? "var(--danger)" : "var(--text-muted)" }}
                    >
                      {entry.count} deadline{entry.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Birthdays */}
          {dayBirthdays.length > 0 && (
            <div className="space-y-2">
              <p className="typo-tag" style={{ color: "var(--text-muted)" }}>
                Birthdays
              </p>
              {dayBirthdays.map((b) => (
                <div
                  key={b.userId}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
                >
                  <UserAvatar name={b.userName} image={b.userImage} size={28} />
                  <p className="text-sm font-medium truncate flex-1" style={{ color: "var(--text-primary)" }}>
                    {b.userName}
                  </p>
                  <Cake size={16} style={{ color: "var(--birthday)" }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
