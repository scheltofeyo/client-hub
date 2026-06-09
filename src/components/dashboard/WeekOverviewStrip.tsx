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
  const birthdaysByDate = useMemo(() => {
    const map = new Map<string, BirthdayItem[]>();
    for (const b of teamData.birthdays) {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date)!.push(b);
    }
    return map;
  }, [teamData.birthdays]);

  // Index company holidays by date
  const holidayByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of teamData.companyHolidays) map.set(h.date, h.label);
    return map;
  }, [teamData.companyHolidays]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const typeMap = dayStats.get(day.date);
        const totalItems = typeMap ? Array.from(typeMap.values()).reduce((a, b) => a + b, 0) : 0;
        const timeOff = timeOffByDate.get(day.date) ?? [];
        const dayBirthdays = birthdaysByDate.get(day.date) ?? [];
        const holiday = holidayByDate.get(day.date);
        const hasFooter = timeOff.length > 0 || dayBirthdays.length > 0;

        // Emphasis ring without shifting layout (border stays 1px).
        const boxShadow = isSelected
          ? "0 0 0 1px var(--primary), var(--shadow-card)"
          : undefined;

        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDate(day.date)}
            aria-pressed={isSelected}
            className="group flex w-full flex-col rounded-card border p-3.5 text-left transition-all duration-150 cursor-pointer hover:shadow-subtle"
            style={{
              background: isSelected || holiday ? "var(--primary-light)" : "var(--bg-surface)",
              borderColor: isSelected || day.isToday ? "var(--primary)" : "var(--border)",
              boxShadow,
            }}
          >
            {/* Day header */}
            <div className="flex items-baseline justify-between gap-1.5">
              <div className="flex items-baseline gap-1.5">
                <span
                  className="typo-tag"
                  style={{ color: day.isToday ? "var(--primary)" : "var(--text-muted)" }}
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
              {day.isToday && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--primary)" }}
                  aria-label="Today"
                />
              )}
            </div>

            {/* Holiday label */}
            {holiday && (
              <p
                className="typo-caption mt-2 truncate font-medium"
                style={{ color: "var(--primary)" }}
              >
                {holiday}
              </p>
            )}

            {/* Count + composition bar */}
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[18px] font-bold leading-none tabular-nums"
                  style={{ color: totalItems > 0 ? "var(--text-primary)" : "var(--text-muted)" }}
                >
                  {totalItems}
                </span>
                <span className="typo-caption" style={{ color: "var(--text-muted)" }}>
                  {totalItems === 1 ? "item" : "items"}
                </span>
              </div>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full flex"
                style={{ background: "var(--bg-neutral)" }}
              >
                {BAR_ORDER.map((type) => {
                  const count = typeMap?.get(type) ?? 0;
                  if (count === 0 || totalItems === 0) return null;
                  return (
                    <div
                      key={type}
                      className="h-full"
                      style={{
                        width: `${(count / totalItems) * 100}%`,
                        background: WEEK_CARD_TYPES[type].color,
                        minWidth: 4,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Team footer */}
            {hasFooter && (
              <div
                className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3"
                style={{ borderColor: "var(--border)" }}
              >
                {timeOff.length > 0 && (
                  <div className="flex items-center -space-x-1.5">
                    {timeOff.slice(0, 3).map((person) => (
                      <div
                        key={person.userId}
                        className="rounded-full"
                        style={{ boxShadow: "0 0 0 2px var(--bg-surface)" }}
                      >
                        <UserAvatar
                          name={person.userName ?? ""}
                          image={person.userImage ?? null}
                          size={20}
                        />
                      </div>
                    ))}
                    {timeOff.length > 3 && (
                      <span
                        className="flex h-5 items-center rounded-full pl-2.5 text-[10px] font-semibold"
                        style={{ color: "var(--text-muted)" }}
                      >
                        +{timeOff.length - 3}
                      </span>
                    )}
                  </div>
                )}
                {dayBirthdays.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Cake size={12} style={{ color: "var(--birthday)" }} />
                    <span className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {dayBirthdays.map((b) => b.userName.split(" ")[0]).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
