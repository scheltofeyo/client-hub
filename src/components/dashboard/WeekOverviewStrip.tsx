"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Cake, ChevronDown } from "lucide-react";
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
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

  // Group items by date for tooltip
  const itemsByDate = useMemo(() => {
    const map = new Map<string, WeekCalendarItem[]>();
    for (const item of items) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date)!.push(item);
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

  const handleMouseEnter = useCallback((date: string) => {
    setHoveredDate(date);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredDate(null);
  }, []);

  return (
    <div className="grid grid-cols-5 gap-2">
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const typeMap = dayStats.get(day.date);
        const totalItems = typeMap ? Array.from(typeMap.values()).reduce((a, b) => a + b, 0) : 0;
        const timeOff = timeOffByDate.get(day.date) ?? [];
        const dayBirthdays = birthdaysByDate.get(day.date) ?? [];
        const holiday = holidayByDate.get(day.date);
        const isHovered = hoveredDate === day.date;

        // Tooltip data
        const dayItems = itemsByDate.get(day.date) ?? [];

        return (
          <div key={day.date} className="relative">
            <button
              type="button"
              ref={(el) => { if (el) cellRefs.current.set(day.date, el); }}
              onClick={() => onSelectDate(day.date)}
              onMouseEnter={() => handleMouseEnter(day.date)}
              onMouseLeave={handleMouseLeave}
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

            {/* Custom hover tooltip */}
            {isHovered && (dayItems.length > 0 || timeOff.length > 0 || dayBirthdays.length > 0 || holiday) && (
              <DayTooltip
                items={dayItems}
                timeOff={timeOff}
                birthdays={dayBirthdays}
                holiday={holiday}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tooltip Card ─────────────────────────────────────────────────────

function DayTooltip({
  items,
  timeOff,
  birthdays,
  holiday,
}: {
  items: WeekCalendarItem[];
  timeOff: { userId: string; userName?: string; userImage?: string }[];
  birthdays: BirthdayItem[];
  holiday?: string;
}) {
  // Group items by type
  const grouped = useMemo(() => {
    const map = new Map<WeekCardType, WeekCalendarItem[]>();
    for (const item of items) {
      if (!map.has(item.type)) map.set(item.type, []);
      map.get(item.type)!.push(item);
    }
    return map;
  }, [items]);

  return (
    <div
      className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 w-72 rounded-xl border shadow-lg p-4 space-y-3"
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      {/* Holiday banner */}
      {holiday && (
        <div
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          {holiday}
        </div>
      )}

      {/* Planned items grouped by type */}
      {BAR_ORDER.map((type) => {
        const typeItems = grouped.get(type);
        if (!typeItems) return null;
        const config = WEEK_CARD_TYPES[type];
        return (
          <div key={type}>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: config.color }} />
              <span className="typo-tag" style={{ color: config.color }}>
                {config.label}s
              </span>
            </div>
            <div className="space-y-1 pl-3.5">
              {typeItems.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center gap-2 min-w-0">
                  <p className="text-xs truncate flex-1" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </p>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                    {item.clientName}
                  </span>
                </div>
              ))}
              {typeItems.length > 4 && (
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  +{typeItems.length - 4} more
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Time off */}
      {timeOff.length > 0 && (
        <div>
          <p className="typo-tag mb-1" style={{ color: "var(--text-muted)" }}>
            Off
          </p>
          <div className="space-y-1 pl-0.5">
            {timeOff.map((person) => (
              <div key={person.userId} className="flex items-center gap-2">
                <UserAvatar name={person.userName ?? ""} image={person.userImage ?? null} size={16} />
                <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                  {person.userName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Birthdays */}
      {birthdays.length > 0 && (
        <div>
          <p className="typo-tag mb-1" style={{ color: "var(--birthday)" }}>
            Birthdays
          </p>
          <div className="space-y-1 pl-0.5">
            {birthdays.map((b) => (
              <div key={b.userId} className="flex items-center gap-2">
                <Cake size={14} style={{ color: "var(--birthday)" }} />
                <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                  {b.userName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show details hint */}
      <div
        className="flex items-center justify-center gap-1 pt-2 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-[10px] font-medium" style={{ color: "var(--primary)" }}>
          Show details
        </span>
        <ChevronDown size={10} style={{ color: "var(--primary)" }} />
      </div>
    </div>
  );
}
