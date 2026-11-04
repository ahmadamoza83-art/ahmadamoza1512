"use client";

import { useEffect, useRef, useState } from "react";
import { createContainerItem, deleteContainerItem, updateContainerItem } from "@/app/actions";
import type { ContainerItem } from "@/lib/containers";
import {
  formatMeasurement,
  lineMeasurement,
  liveNumber,
  parseItemDraft,
  type ItemDraft,
} from "@/lib/item-measure";

const fieldClass =
  "admin-field h-10 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white caret-white outline-none placeholder:text-slate-500 focus:border-emerald-400";

export function ItemsTable({
  containerId,
  items,
}: {
  containerId: string;
  items: ContainerItem[];
}) {
  const [rows, setRows] = useState<ItemDraft[]>(() => items.map(toDraft));
  const [adding, setAdding] = useState(false);
  const [tableError, setTableError] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  const quantityTotal = rows.reduce((sum, row) => sum + liveNumber(row.quantity), 0);
  const measurementTotal = rows.reduce((sum, row) => sum + lineMeasurement(row), 0);

  function updateRow(next: ItemDraft) {
    setRows((current) => current.map((row) => (row.id === next.id ? next : row)));
  }

  async function addRow() {
    setAdding(true);
    setTableError("");
    const result = await createContainerItem(containerId);
    setAdding(false);
    if (!result.ok) {
      setTableError(result.message);
      return;
    }
    setRows((current) => [...current, toDraft(result.item)]);
    setFocusId(result.item.id);
  }

  async function removeRow(id: string) {
    setTableError("");
    const result = await deleteContainerItem(id);
    if (!result.ok) {
      setTableError(result.message);
      return;
    }
    setRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-start text-sm text-slate-400">گۆڕانکارییەکان خۆکارانە پاشەکەوت دەکرێن.</p>
        <button
          type="button"
          onClick={() => void addRow()}
          disabled={adding}
          className="h-10 shrink-0 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {adding ? "خەریکە زیاد دەکرێت..." : "زیادکردنی ڕیز"}
        </button>
      </div>

      {tableError ? (
        <p role="alert" className="mb-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {tableError}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-start">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="border-b border-white/10 px-2 py-3 font-medium">ناوی بازرگان</th>
              <th className="border-b border-white/10 px-2 py-3 font-medium">پانی</th>
              <th className="border-b border-white/10 px-2 py-3 font-medium">درێژی</th>
              <th className="border-b border-white/10 px-2 py-3 font-medium">بەرزی</th>
              <th className="border-b border-white/10 px-2 py-3 font-medium">عدد</th>
              <th className="border-b border-white/10 px-2 py-3 font-medium">تێبینی</th>
              <th className="border-b border-white/10 px-2 py-3 font-medium">کۆی گشتی یەک بابەت</th>
              <th className="border-b border-white/10 px-2 py-3 font-medium">
                <span className="sr-only">سڕینەوە</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-8 text-center text-sm text-slate-400">
                  هیچ ماددەیەک لە ناو ئەم کۆنتێنەرەدا نییە.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <ItemRow
                  key={row.id}
                  row={row}
                  autoFocus={row.id === focusId}
                  onChange={updateRow}
                  onDelete={() => void removeRow(row.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-start">
          <p className="text-sm text-slate-400">کۆی گشتی عددی هەموو تاجرەکان</p>
          <p className="mt-1 text-xl font-semibold text-emerald-400">{formatMeasurement(quantityTotal)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-start">
          <p className="text-sm text-slate-400">کۆی گشتی قیاسی هەموو تاجرەکان</p>
          <p className="mt-1 text-xl font-semibold text-emerald-400">{formatMeasurement(measurementTotal)}</p>
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  row,
  autoFocus,
  onChange,
  onDelete,
}: {
  row: ItemDraft;
  autoFocus: boolean;
  onChange: (row: ItemDraft) => void;
  onDelete: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const latest = useRef(row);
  const savedKey = useRef(draftKey(row));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);
  const merchantRef = useRef<HTMLInputElement>(null);
  const saveNow = useRef<(notify: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    latest.current = row;
    saveNow.current = async (notify) => {
      const next = latest.current;
      const parsed = parseItemDraft(next);
      if (!parsed.ok) {
        if (notify) {
          setStatus("error");
          setError(parsed.message);
        }
        return;
      }

      const key = JSON.stringify(parsed.value);
      if (key === savedKey.current) {
        if (notify) setStatus((current) => (current === "saving" ? "saved" : current));
        return;
      }

      const token = ++request.current;
      if (notify) {
        setStatus("saving");
        setError("");
      }

      const result = await updateContainerItem(next.id, parsed.value);
      if (token !== request.current) return;
      if (!result.ok) {
        if (notify) {
          setStatus("error");
          setError(result.message);
        }
        return;
      }

      savedKey.current = key;
      if (notify) {
        setStatus("saved");
        setError("");
      }
    };
  });

  useEffect(() => {
    if (autoFocus) merchantRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void saveNow.current(false);
      }
    };
  }, []);

  function edit(partial: Partial<ItemDraft>) {
    const next = { ...latest.current, ...partial };
    latest.current = next;
    onChange(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void saveNow.current(true);
    }, 500);
  }

  function flush() {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    void saveNow.current(true);
  }

  const total = lineMeasurement(row);

  return (
    <tr className="align-top">
      <td className="px-2 py-2">
        <input
          ref={merchantRef}
          value={row.merchant}
          onChange={(event) => edit({ merchant: event.target.value })}
          onBlur={flush}
          placeholder="ناوی بازرگان"
          className={fieldClass}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={row.width}
          onChange={(event) => edit({ width: event.target.value })}
          onBlur={flush}
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          className={`${fieldClass} text-center`}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={row.length}
          onChange={(event) => edit({ length: event.target.value })}
          onBlur={flush}
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          className={`${fieldClass} text-center`}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={row.height}
          onChange={(event) => edit({ height: event.target.value })}
          onBlur={flush}
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          className={`${fieldClass} text-center`}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={row.quantity}
          onChange={(event) => edit({ quantity: event.target.value })}
          onBlur={flush}
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          className={`${fieldClass} text-center`}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={row.notes}
          onChange={(event) => edit({ notes: event.target.value })}
          onBlur={flush}
          placeholder="تێبینی"
          className={fieldClass}
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex h-10 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-semibold text-emerald-400">
          {formatMeasurement(total)}
        </div>
        <p className="mt-1 text-center text-[11px] text-slate-500">
          {status === "saving" ? "خەریکە پاشەکەوت دەکرێت..." : null}
          {status === "saved" ? <span className="text-emerald-400">پاشەکەوتکرا</span> : null}
          {status === "error" ? <span className="text-rose-300">{error}</span> : null}
        </p>
      </td>
      <td className="px-2 py-2">
        <button
          type="button"
          onClick={onDelete}
          className="h-10 rounded-xl px-3 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10"
        >
          سڕینەوە
        </button>
      </td>
    </tr>
  );
}

function toDraft(item: ContainerItem): ItemDraft {
  return {
    id: item.id,
    merchant: item.owner_name ?? "",
    width: fieldNumber(item.width),
    length: fieldNumber(item.length),
    height: fieldNumber(item.height),
    quantity: item.quantity ? fieldNumber(item.quantity) : "",
    notes: item.notes ?? "",
  };
}

function fieldNumber(value: number | null) {
  if (value === null || Number.isNaN(value)) return "";
  return String(value);
}

function draftKey(row: ItemDraft) {
  const parsed = parseItemDraft(row);
  return parsed.ok ? JSON.stringify(parsed.value) : "";
}
