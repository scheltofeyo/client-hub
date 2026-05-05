"use client";

import { useMemo } from "react";
import { Cake } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import { WEEK_CARD_TYPES } from "@/lib/utils";
import type { DayColumn, WeekCalendarItem, WeekCardType } from "@/lib/utils";
import type { BirthdayItem, WeekTeamData } from "@/types";

interface Props {
  days: DayColumn[];
  items: WeekCalendarItem[];
  teamData: WeekTeamData;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const BAR_ORDER: WeekCardType[] = ["delivery", "kickoff", "deadline", "followup", "event"];

export default function WeekOverviewStrip({ days, items, teamData, selectedDate, onSelectDate }: Props) {
  // Group items by date and type
  const dayStats = useMemo(() => {
    const map = new Map<string, Map<WeekCardType, number>>();
    for (const item of items) {
      if (!map.has(item.date)) map.set(item.date, new Map());
      const typeMap = map.get(item.date)!;
      typeMap.set(item.type, (typeMap.get(item.type) ?? 0) + 1);
    }
    return map;
  }, [items]);

  // Index time-off entries by date
  const timeOffByDate = useMemo(() => {
    const map = new Map<string, { userId: string; userName?: string; userImage?: string }[]>();
    for (const entry of teamData.timeOff) {
      for (const day of days) {
        if (day.date >= entry.startDate && day.date <= entry.endDate) {
          if (!map.has(day.date)) map.set(day.date, []);
          const existing = map.get(day.date)!;
          if (!existing.some((e) => e.userId === entry.userId)) {
            existing.push({ userId: entry.userId, userName: entry.userName, userImage: entry.userImage });
          }
        }
      }
    }
    return map;
  }, [teamData.timeOff, days]);

  // Index birthdays by date
  const birthdaysList = teamData.birthdays;
  const birthdaysByDate = useMemo(() => {
    const map = new Map<string, BirthdayItem[]>();
    for (const b of birthdaysList) {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date)!.push(b);
    }
    return map;
  }, [birthdaysList]);

  // Index company holidays by date
  const holidayByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of teamData.companyHolidays) {
      map.set(h.date, h.label);
    }
    return map;
  }, [teamData.companyHolidays]);

  // Max total items across all days (for relative bar widths)
  const maxTotal = useMemo(() => {
    let max = 0;
    for (const day of days) {
      const typeMap = dayStats.get(day.date);
      if (!typeMap) continue;
      let total = 0;
      for (const count of typeMap.values()) total += count;
      if (total > max) max = total;
    }
    return max;
  }, [days, dayStats]);

  return (
    <div className="grid grid-cols-5 gap-2">
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const typeMap = dayStats.get(day.date);
        const totalItems = typeMap ? Array.from(typeMap.values()).reduce((a, b) => a + b, 0) : 0;
        const timeOff = timeOffByDate.get(day.date) ?? [];
        const dayBirthdays = birthdaysByDate.get(day.date) ?? [];
        const holiday = holidayByDate.get(day.date);

        return (
          <div key={day.date} className="relative">
            <button
              type="button"
              onClick={() => onSelectDate(day.date)}
              className="w-full rounded-xl border p-3 text-left transition-all cursor-pointer"
              style={{
                background: holiday
                  ? "var(--primary-light)"
                  : isSelected
                    ? "var(--primary-light)"
                    : "var(--bg-surface)",
                borderColor: isSelected
                  ? "var(--primary)"
                  : day.isToday
                    ? "var(--primary)"
                    : "var(--border)",
                borderWidth: isSelected ? 2 : day.isToday ? 2 : 1,
              }}
            >
              {/* Day header */}
              <div className="flex items-baseline gap-1.5 mb-2">
                <span
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  {day.dayName}
                </span>
                <span
                  className="typo-card-title"
                  style={{ color: day.isToday ? "var(--primary)" : "var(--text-primary)" }}
                >
                  {day.label}
                </span>
              </div>

              {/* Company holiday label */}
              {holiday && (
                <p className="text-xs font-medium mb-2 truncate" style={{ color: "var(--primary)" }}>
                  {holiday}
                </p>
              )}

              {/* Events section */}
              <div className="mb-2">
                <p className="typo-tag mb-1" style={{ color: "var(--text-muted)" }}>
                  Events
                </p>
                <div
                  className="h-2.5 rounded-full overflow-hidden flex"
                  style={{
                    width: totalItems > 0 && maxTotal > 0 ? `${Math.max(30, (totalItems / maxTotal) * 100)}%` : "100%",
                    background: "var(--bg-hover)",
                  }}
                >
                  {BAR_ORDER.map((type) => {
                    const count = typeMap?.get(type) ?? 0;
                    if (count === 0) return null;
                    const pct = (count / totalItems) * 100;
                    return (
                      <div
                        key={type}
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          background: WEEK_CARD_TYPES[type].color,
                          minWidth: 4,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Time off section */}
              {timeOff.length > 0 && (
                <div className="mb-2">
                  <p className="typo-tag mb-1" style={{ color: "var(--text-muted)" }}>
                    Time off
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {timeOff.slice(0, 3).map((person) => (
                      <UserAvatar
                        key={person.userId}
                        name={person.userName ?? ""}
                        image={person.userImage ?? null}
                        size={18}
                      />
                    ))}
                    {timeOff.length > 3 && (
                      <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                        +{timeOff.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Birthdays section */}
              {dayBirthdays.length > 0 && (
                <div>
                  <p className="typo-tag mb-1" style={{ color: "var(--birthday)" }}>
                    Birthdays
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {dayBirthdays.map((b) => (
                      <div key={b.userId} className="flex items-center gap-1">
                        <Cake size={12} style={{ color: "var(--birthday)" }} />
                        <span className="text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>
                          {b.userName.split(" ")[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
