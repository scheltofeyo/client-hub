"use client";

import { useMemo } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import LeaveBlock from "./LeaveBlock";
import type { TimeOffEntry, LeaveType, CompanyHoliday } from "@/types";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

interface CalendarUser {
  id: string;
  name: string;
  image: string | null;
  role: string;
}

interface CalendarGridProps {
  year: number;
  month: number;
  users: CalendarUser[];
  entries: TimeOffEntry[];
  leaveTypes: LeaveType[];
  companyHolidays: CompanyHoliday[];
  currentUserId: string;
  canManageOwn: boolean;
  canManageAny: boolean;
  onCellClick: (userId: string, date: string, existingEntry?: TimeOffEntry) => void;
}

interface DayInfo {
  date: string;
  dayNum: number;
  dow: number;
  isWeekend: boolean;
  isToday: boolean;
  isCompanyHoliday: boolean;
  holidayLabel?: string;
}

function getDaysInMonth(year: number, month: number): DayInfo[] {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const daysCount = new Date(year, month, 0).getDate();
  const days: DayInfo[] = [];

  for (let d = 1; d <= daysCount; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = dateObj.getDay();
    days.push({
      date: dateStr,
      dayNum: d,
      dow,
      isWeekend: dow === 0 || dow === 6,
      isToday: dateStr === todayStr,
      isCompanyHoliday: false,
    });
  }
  return days;
}

function getEntryForDay(
  entries: TimeOffEntry[],
  userId: string,
  date: string
): TimeOffEntry | undefined {
  return entries.find(
    (e) => e.userId === userId && e.startDate <= date && e.endDate >= date
  );
}

function getPortionForDay(entry: TimeOffEntry, date: string): "full" | "am" | "pm" {
  if (date === entry.startDate && date === entry.endDate) {
    return entry.startDayPortion;
  }
  if (date === entry.startDate) return entry.startDayPortion;
  if (date === entry.endDate) return entry.endDayPortion;
  return "full";
}

/** Background color for a cell based on day type */
function cellBg(day: DayInfo): string {
  if (day.isCompanyHoliday) return "var(--primary-light)";
  if (day.isWeekend) return "color-mix(in srgb, var(--border) 30%, var(--bg-surface))";
  return "var(--bg-surface)";
}

export default function CalendarGrid({
  year,
  month,
  users,
  entries,
  leaveTypes,
  companyHolidays,
  currentUserId,
  canManageOwn,
  canManageAny,
  onCellClick,
}: CalendarGridProps) {
  const days = useMemo(() => {
    const d = getDaysInMonth(year, month);
    const holidaySet = new Map(companyHolidays.map((h) => [h.date, h.label]));
    return d.map((day) => ({
      ...day,
      isCompanyHoliday: holidaySet.has(day.date),
      holidayLabel: holidaySet.get(day.date),
    }));
  }, [year, month, companyHolidays]);

  const leaveTypeMap = useMemo(
    () => new Map(leaveTypes.map((lt) => [lt.slug, lt])),
    [leaveTypes]
  );

  const numDays = days.length;
  const nameColWidth = 220;
  const minCellWidth = 36;
  const totalMinWidth = nameColWidth + numDays * minCellWidth;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
      <div
        className="rounded-xl border overflow-x-auto"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <table style={{ minWidth: totalMinWidth, width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20"
                style={{
                  width: nameColWidth,
                  minWidth: nameColWidth,
                  background: "var(--bg-surface)",
                  borderRight: "1px solid var(--border)",
                }}
              />
              {days.map((day) => (
                <th
                  key={day.date}
                  className="text-center text-[11px] font-medium py-2 px-0 relative"
                  style={{
                    color: day.isToday ? "var(--primary)" : "var(--text-muted)",
                    minWidth: minCellWidth,
                    background: cellBg(day),
                    borderLeft: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                  }}
                  title={day.holidayLabel}
                >
                  <div style={{ opacity: day.isWeekend ? 0.6 : 1 }}>{DAY_LETTERS[day.dow]}</div>
                  <div
                    className="text-xs font-semibold mt-0.5"
                    style={{
                      color: day.isToday
                        ? "var(--primary)"
                        : day.isWeekend
                          ? "var(--text-muted)"
                          : "var(--text-primary)",
                    }}
                  >
                    {day.dayNum}
                  </div>
                  {day.isToday && (
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                      style={{ background: "var(--primary)" }}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {users.map((user) => {
              const isOwn = user.id === currentUserId;
              const canClick = canManageAny || (canManageOwn && isOwn);

              return (
                <tr
                  key={user.id}
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  {/* Sticky name column */}
                  <td
                    className="sticky left-0 z-10 px-4 py-2"
                    style={{
                      background: "var(--bg-surface)",
                      borderRight: "1px solid var(--border)",
                      boxShadow: "2px 0 4px -1px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={user.name} image={user.image} size={28} />
                      <div className="min-w-0">
                        {(() => {
                          const parts = user.name.split(" ");
                          const firstName = parts[0] ?? "";
                          const rest = parts.slice(1).join(" ");
                          return (
                            <>
                              <div
                                className="text-sm font-medium truncate"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {firstName}
                              </div>
                              {rest && (
                                <div
                                  className="text-[11px] truncate"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {rest}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </td>

                  {/* Day cells */}
                  {days.map((day) => {
                    const entry = getEntryForDay(entries, user.id, day.date);
                    const leaveType = entry ? leaveTypeMap.get(entry.leaveTypeSlug) : undefined;
                    const portion = entry ? getPortionForDay(entry, day.date) : undefined;
                    const bg = cellBg(day);

                    return (
                      <td
                        key={day.date}
                        className={`relative p-0 transition-colors ${canClick ? "cursor-pointer" : ""}`}
                        style={{
                          minWidth: minCellWidth,
                          height: 48,
                          background: bg,
                          borderLeft: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                        }}
                        onMouseEnter={(e) => {
                          if (canClick) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                        }}
                        onMouseLeave={(e) => {
                          if (canClick) (e.currentTarget as HTMLElement).style.background = bg ?? "";
                        }}
                        onClick={() => {
                          if (!canClick) return;
                          onCellClick(user.id, day.date, entry);
                        }}
                        title={
                          day.isCompanyHoliday
                            ? day.holidayLabel
                            : entry
                              ? `${leaveType?.label ?? entry.leaveTypeSlug}${entry.notes ? ` — ${entry.notes}` : ""}`
                              : undefined
                        }
                      >
                        {/* Weekend hatching — always rendered on weekends, behind leave blocks */}
                        {day.isWeekend && (
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              opacity: 0.25,
                              backgroundImage:
                                "repeating-linear-gradient(45deg, transparent, transparent 3px, var(--border) 3px, var(--border) 4px)",
                            }}
                          />
                        )}
                        {entry && leaveType && (
                          <LeaveBlock
                            color={leaveType.color}
                            icon={leaveType.icon}
                            portion={portion ?? "full"}
                            muted={day.isWeekend}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {users.length === 0 && (
              <tr>
                <td
                  colSpan={numDays + 1}
                  className="text-center py-12 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  No team members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
