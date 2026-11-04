"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Container } from "@/lib/containers";
import { dateKey, dayKey, monthLabel } from "@/lib/format-date";

const weekdayShort = ["ش", "ی", "د", "س", "چ", "پ", "ه"];

type Cursor = { year: number; month: number };
type Mode = "days" | "months" | "years";

export function HistoryCalendar({
  containers,
  selectedDay,
  onSelect,
}: {
  containers: Container[];
  selectedDay: string | null;
  onSelect: (key: string) => void;
}) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [mode, setMode] = useState<Mode>("days");
  const activeCursor = cursor ?? (isClient ? currentMonth() : null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const container of containers) {
      const key = dayKey(container.created_at);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [containers]);

  if (!activeCursor) {
    return <div className="h-[22rem] animate-pulse rounded-3xl bg-slate-950" />;
  }

  const today = currentMonth();
  const todayDate = new Date();
  const todayKey = dateKey(today.year, today.month, todayDate.getDate());
  const yearStart = activeCursor.year - (activeCursor.year % 12);

  function shiftMonth(amount: number) {
    setCursor((current) => {
      const base = current ?? activeCursor;
      if (!base) return current;
      const date = new Date(base.year, base.month + amount, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  function shiftYear(amount: number) {
    setCursor((current) => {
      const base = current ?? activeCursor;
      return base ? { ...base, year: base.year + amount } : current;
    });
  }

  function goPrevious() {
    if (mode === "years") shiftYear(-12);
    else if (mode === "months") shiftYear(-1);
    else shiftMonth(-1);
  }

  function goNext() {
    if (mode === "years") shiftYear(12);
    else if (mode === "months") shiftYear(1);
    else shiftMonth(1);
  }

  const title =
    mode === "years"
      ? `${yearStart} – ${yearStart + 11}`
      : mode === "months"
        ? String(activeCursor.year)
        : `${monthLabel(activeCursor.month)} ${activeCursor.year}`;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {mode === "days" ? (
            <NavButton label="ساڵی پێشوو" onClick={() => shiftYear(-1)}>
              <DoubleChevron direction="right" />
            </NavButton>
          ) : null}
          <NavButton
            label={mode === "days" ? "مانگی پێشوو" : mode === "months" ? "ساڵی پێشوو" : "دوازدە ساڵی پێشوو"}
            onClick={goPrevious}
          >
            <Chevron direction="right" />
          </NavButton>
        </div>

        <button
          type="button"
          onClick={() => setMode((current) => (current === "days" ? "months" : current === "months" ? "years" : "days"))}
          className="rounded-xl px-3 py-1.5 text-sm font-semibold text-emerald-400 outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {title}
        </button>

        <div className="flex gap-1">
          <NavButton
            label={mode === "days" ? "مانگی داهاتوو" : mode === "months" ? "ساڵی داهاتوو" : "دوازدە ساڵی داهاتوو"}
            onClick={goNext}
          >
            <Chevron direction="left" />
          </NavButton>
          {mode === "days" ? (
            <NavButton label="ساڵی داهاتوو" onClick={() => shiftYear(1)}>
              <DoubleChevron direction="left" />
            </NavButton>
          ) : null}
        </div>
      </div>

      {mode === "days" ? (
        <DayGrid
          cursor={activeCursor}
          todayKey={todayKey}
          selectedDay={selectedDay}
          counts={counts}
          onSelect={(key, month, year) => {
            if (month !== activeCursor.month || year !== activeCursor.year) {
              setCursor({ year, month });
            }
            onSelect(key);
          }}
        />
      ) : null}

      {mode === "months" ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, month) => {
            const active = month === activeCursor.month;
            const hasContainers = [...counts.keys()].some((key) =>
              key.startsWith(`${activeCursor.year}-${String(month + 1).padStart(2, "0")}-`),
            );
            return (
              <button
                key={month}
                type="button"
                onClick={() => {
                  setCursor({ year: activeCursor.year, month });
                  setMode("days");
                }}
                className={`rounded-2xl px-2 py-3 text-sm leading-tight outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  active
                    ? "bg-emerald-600 font-semibold text-white"
                    : hasContainers
                      ? "text-emerald-400 hover:bg-white/5"
                      : "text-slate-200 hover:bg-white/5"
                }`}
              >
                {monthLabel(month)}
              </button>
            );
          })}
        </div>
      ) : null}

      {mode === "years" ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, index) => {
            const year = yearStart + index;
            const active = year === activeCursor.year;
            const hasContainers = [...counts.keys()].some((key) => key.startsWith(`${year}-`));
            return (
              <button
                key={year}
                type="button"
                onClick={() => {
                  setCursor({ year, month: activeCursor.month });
                  setMode("months");
                }}
                className={`h-12 rounded-2xl text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  active
                    ? "bg-emerald-600 font-semibold text-white"
                    : hasContainers
                      ? "text-emerald-400 hover:bg-white/5"
                      : "text-slate-200 hover:bg-white/5"
                }`}
              >
                {year}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function DayGrid({
  cursor,
  todayKey,
  selectedDay,
  counts,
  onSelect,
}: {
  cursor: Cursor;
  todayKey: string;
  selectedDay: string | null;
  counts: Map<string, number>;
  onSelect: (key: string, month: number, year: number) => void;
}) {
  const first = new Date(cursor.year, cursor.month, 1);
  const offset = (first.getDay() + 1) % 7;
  const gridStart = new Date(cursor.year, cursor.month, 1 - offset);
  const cells = Array.from({ length: 42 }, (_, index) => {
    return new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
  });

  return (
    <>
      <div className="mt-4 grid grid-cols-7 text-center text-xs font-medium text-slate-500">
        {weekdayShort.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((date) => {
          const year = date.getFullYear();
          const month = date.getMonth();
          const day = date.getDate();
          const key = dateKey(year, month, day);
          const inMonth = month === cursor.month;
          const selected = key === selectedDay;
          const isToday = key === todayKey;
          const count = counts.get(key) ?? 0;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-label={count > 0 ? `${day}، ${count} کۆنتێنەر` : String(day)}
              onClick={() => onSelect(key, month, year)}
              className={`relative flex h-11 items-center justify-center rounded-xl text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                selected
                  ? "bg-emerald-600 font-semibold text-white"
                  : inMonth
                    ? isToday
                      ? "font-semibold text-emerald-400 hover:bg-white/5"
                      : "text-white hover:bg-white/5"
                    : "text-slate-600 hover:bg-white/5"
              }`}
            >
              {day}
              {count > 0 ? (
                <span
                  className={`absolute bottom-1.5 h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-emerald-400"}`}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function currentMonth(): Cursor {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 outline-none transition hover:bg-white/5 hover:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      {children}
    </button>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
      {direction === "right" ? (
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M8 5l5 5-5 5" />
      ) : (
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M12 5l-5 5 5 5" />
      )}
    </svg>
  );
}

function DoubleChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
      {direction === "right" ? (
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M6 5l4 5-4 5M11 5l4 5-4 5" />
      ) : (
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M14 5l-4 5 4 5M9 5l-4 5 4 5" />
      )}
    </svg>
  );
}
