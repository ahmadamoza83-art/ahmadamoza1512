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
  "admin-field box-border h-7 w-full min-w-0 rounded border border-slate-700 bg-slate-950 px-0.5 text-[11px] leading-none text-white caret-white outline-none placeholder:text-slate-500 focus:border-emerald-400";

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
  const merchantTotals = new Map<string, number>();
  for (const row of rows) {
    const key = row.merchant.trim();
    merchantTotals.set(key, (merchantTotals.get(key) ?? 0) + lineMeasurement(row));
  }

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
      <div className="no-print mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-start text-sm leading-6 text-slate-400">گۆڕانکارییەکان خۆکارانە پاشەکەوت دەکرێن.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 w-full shrink-0 rounded-2xl border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/5 sm:w-auto"
          >
            چاپکردن
          </button>
          <button
            type="button"
            onClick={() => void addRow()}
            disabled={adding}
            className="h-10 w-full shrink-0 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60 sm:w-auto"
          >
            {adding ? "خەریکە زیاد دەکرێت..." : "زیادکردنی ڕیز"}
          </button>
        </div>
      </div>

      {tableError ? (
        <p role="alert" className="mb-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {tableError}
        </p>
      ) : null}

      <div className="w-full overflow-hidden rounded-xl border border-white/10">
        <table className="w-full table-fixed border-collapse text-start text-[11px]">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[14%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="bg-slate-950 text-slate-300">
              <th className={headClass}>ناوی بازرگان</th>
              <th className={headClass}>پانی</th>
              <th className={headClass}>درێژی</th>
              <th className={headClass}>بەرزی</th>
              <th className={headClass}>عدد</th>
              <th className={headClass}>تێبینی</th>
              <th className={headClass}>کۆی گشتی یەک بابەت</th>
              <th className={headClass}>کۆی گشتی تاجر</th>
              <th className={headClass}>
                <span className="sr-only">سڕینەوە</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-2 py-8 text-center text-xs text-slate-400">
                  هیچ ماددەیەک لە ناو ئەم کۆنتێنەرەدا نییە.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <ItemRow
                  key={row.id}
                  row={row}
                  merchantTotal={merchantTotals.get(row.merchant.trim()) ?? 0}
                  autoFocus={row.id === focusId}
                  onChange={updateRow}
                  onDelete={() => void removeRow(row.id)}
                />
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-emerald-950/40 text-xs">
              <td colSpan={4} className="border border-emerald-400/25 px-1 py-1.5 text-end text-[10px] leading-tight text-emerald-100/80">
                کۆی گشتی عددی هەموو تاجرەکان
              </td>
              <td className="border border-emerald-400/40 bg-emerald-950/60 px-0.5 py-1.5 text-center text-sm font-semibold tabular-nums text-emerald-300">
                {formatMeasurement(quantityTotal)}
              </td>
              <td className="border border-emerald-400/25" />
              <td colSpan={2} className="border border-emerald-400/40 bg-emerald-950/60 px-1 py-1.5 text-center">
                <p className="text-[10px] leading-tight text-emerald-100/80">کۆی گشتی قیاسی هەموو تاجرەکان</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-300">{formatMeasurement(measurementTotal)}</p>
              </td>
              <td className="border border-emerald-400/25" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const headClass = "border border-white/10 px-0.5 py-1 text-center text-[10px] font-medium leading-tight break-words";
const cellClass = "border border-white/10 p-0.5 align-middle";

function ItemRow({
  row,
  merchantTotal,
  autoFocus,
  onChange,
  onDelete,
}: {
  row: ItemDraft;
  merchantTotal: number;
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
    <tr>
      <td className={cellClass}>
        <input
          ref={merchantRef}
          value={row.merchant}
          onChange={(event) => edit({ merchant: event.target.value })}
          onBlur={flush}
          placeholder="بازرگان"
          aria-label="ناوی بازرگان"
          className={`${fieldClass} text-start`}
        />
      </td>
      <td className={cellClass}>
        <input
          value={row.width}
          onChange={(event) => edit({ width: event.target.value })}
          onBlur={flush}
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          aria-label="پانی"
          className={`${fieldClass} text-center tabular-nums`}
        />
      </td>
      <td className={cellClass}>
        <input
          value={row.length}
          onChange={(event) => edit({ length: event.target.value })}
          onBlur={flush}
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          aria-label="درێژی"
          className={`${fieldClass} text-center tabular-nums`}
        />
      </td>
      <td className={cellClass}>
        <input
          value={row.height}
          onChange={(event) => edit({ height: event.target.value })}
          onBlur={flush}
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          aria-label="بەرزی"
          className={`${fieldClass} text-center tabular-nums`}
        />
      </td>
      <td className={cellClass}>
        <input
          value={row.quantity}
          onChange={(event) => edit({ quantity: event.target.value })}
          onBlur={flush}
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          aria-label="عدد"
          className={`${fieldClass} text-center tabular-nums`}
        />
      </td>
      <td className={cellClass}>
        <input
          value={row.notes}
          onChange={(event) => edit({ notes: event.target.value })}
          onBlur={flush}
          placeholder="تێبینی"
          aria-label="تێبینی"
          className={fieldClass}
        />
      </td>
      <td className={`${cellClass} text-center`}>
        <div className="truncate px-0.5 text-[11px] font-semibold tabular-nums text-emerald-400">{formatMeasurement(total)}</div>
        {status === "idle" ? null : (
          <p className="truncate text-center text-[9px] leading-none text-slate-500" title={error}>
            {status === "saving" ? "..." : null}
            {status === "saved" ? <span className="text-emerald-400">پاشەکەوتکرا</span> : null}
            {status === "error" ? <span className="text-rose-300">{error}</span> : null}
          </p>
        )}
      </td>
      <td className={`${cellClass} text-center text-[11px] font-semibold tabular-nums text-emerald-300`}>
        {formatMeasurement(merchantTotal)}
      </td>
      <td className={`${cellClass} text-center`}>
        <button
          type="button"
          onClick={onDelete}
          aria-label="سڕینەوە"
          className="no-print h-7 w-full rounded text-xs font-medium text-rose-300 transition hover:bg-rose-500/10"
        >
          ×
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
