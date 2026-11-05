"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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
  "admin-field box-border h-7 w-full min-w-0 max-w-full rounded border border-slate-700 bg-slate-900 px-0.5 text-[11px] leading-none text-white caret-white outline-none placeholder:text-slate-500 focus:border-emerald-400";

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
  const [focusField, setFocusField] = useState<"merchant" | "width">("merchant");
  const rowsRef = useRef(rows);
  const addingRef = useRef(false);
  const groupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupIds = useRef<string[]>([]);

  useEffect(() => {
    rowsRef.current = rows;
  });

  const groups = groupRows(rows);
  const quantityTotal = rows.reduce((sum, row) => sum + liveNumber(row.quantity), 0);
  const measurementTotal = rows.reduce((sum, row) => sum + lineMeasurement(row), 0);

  function updateRow(next: ItemDraft) {
    const updated = rowsRef.current.map((row) => (row.id === next.id ? next : row));
    rowsRef.current = updated;
    setRows(updated);
  }

  async function addRow(merchant = "") {
    if (addingRef.current) return;
    addingRef.current = true;
    setAdding(true);
    setTableError("");
    const result = await createContainerItem(containerId);
    setAdding(false);
    addingRef.current = false;
    if (!result.ok) {
      setTableError(result.message);
      return;
    }

    const name = merchant.trim();
    const draft = { ...toDraft(result.item), merchant: name };
    const next = [...rowsRef.current];
    let insertAt = next.length;
    const key = merchantKey(name);
    if (key) {
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (merchantKey(next[index].merchant) === key) {
          insertAt = index + 1;
          break;
        }
      }
    }
    next.splice(insertAt, 0, draft);
    rowsRef.current = next;
    setRows(next);
    setFocusField(key ? "width" : "merchant");
    setFocusId(draft.id);

    if (!key) return;
    const parsed = parseItemDraft(draft);
    if (!parsed.ok) {
      setTableError(parsed.message);
      return;
    }
    const saved = await updateContainerItem(draft.id, parsed.value);
    if (!saved.ok) setTableError(saved.message);
  }

  function patchMerchant(ids: string[], merchant: string) {
    groupIds.current = ids;
    const next = rowsRef.current.map((row) => (ids.includes(row.id) ? { ...row, merchant } : row));
    rowsRef.current = next;
    setRows(next);
    if (groupTimer.current) clearTimeout(groupTimer.current);
    groupTimer.current = setTimeout(() => {
      groupTimer.current = null;
      void saveIds(ids);
    }, 500);
  }

  function flushMerchant() {
    if (!groupTimer.current) return;
    clearTimeout(groupTimer.current);
    groupTimer.current = null;
    void saveIds(groupIds.current);
  }

  async function saveIds(ids: string[]) {
    for (const row of rowsRef.current) {
      if (!ids.includes(row.id)) continue;
      const parsed = parseItemDraft(row);
      if (!parsed.ok) {
        setTableError(parsed.message);
        return;
      }
      const result = await updateContainerItem(row.id, parsed.value);
      if (!result.ok) {
        setTableError(result.message);
        return;
      }
    }
  }

  async function removeRow(id: string) {
    setTableError("");
    const result = await deleteContainerItem(id);
    if (!result.ok) {
      setTableError(result.message);
      return;
    }
    const updated = rowsRef.current.filter((row) => row.id !== id);
    rowsRef.current = updated;
    setRows(updated);
  }

  return (
    <div>
      <div className="no-print flex h-10 items-center justify-between gap-2 border-b border-white/10 px-2">
        <p className="min-w-0 truncate text-start text-[11px] text-slate-500">گۆڕانکارییەکان خۆکارانە پاشەکەوت دەکرێن.</p>
        <button
          type="button"
          onClick={() => void addRow()}
          disabled={adding}
          className="h-8 shrink-0 rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {adding ? "..." : "زیادکردنی ڕیز"}
        </button>
      </div>

      {tableError ? (
        <p role="alert" className="mb-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {tableError}
        </p>
      ) : null}

      <div className="w-full max-w-full overflow-x-hidden">
        <table className="w-full max-w-full table-fixed border-collapse text-start text-[11px]">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="bg-slate-950 text-slate-300">
              <th className={headClass}>ناوی بازرگان</th>
              <th className={headClass}>پانی</th>
              <th className={headClass}>درێژی</th>
              <th className={headClass}>بەرزی</th>
              <th className={headClass}>عدد</th>
              <th className={headClass}>
                <span className="inline-flex flex-wrap items-center justify-center gap-0.5">
                  <PencilIcon />
                  تێبینی
                </span>
              </th>
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
              groups.flatMap((group) =>
                group.map((row, index) => (
                  <ItemRow
                    key={row.id}
                    row={row}
                    lead={index === 0}
                    span={group.length}
                    merchantTotal={groupTotal(group)}
                    autoFocus={row.id === focusId}
                    focusField={focusField}
                    onChange={updateRow}
                    onDelete={() => void removeRow(row.id)}
                    onError={setTableError}
                    onPatchMerchant={(merchant) => patchMerchant(group.map((item) => item.id), merchant)}
                    onFlushMerchant={flushMerchant}
                    onAddLine={(merchant) => void addRow(merchant)}
                  />
                )),
              )
            )}
          </tbody>
          <tfoot>
            <tr className="bg-emerald-950/40 text-[11px]">
              <td colSpan={4} className="border border-emerald-400/25 px-0.5 py-1 text-end text-[10px] leading-tight text-emerald-100/80">
                کۆی گشتی عدد
              </td>
              <td className="border border-emerald-400/40 bg-emerald-950/60 px-0.5 py-1 text-center text-[11px] font-semibold break-all tabular-nums text-emerald-300">
                {formatMeasurement(quantityTotal)}
              </td>
              <td className="border border-emerald-400/25" />
              <td colSpan={2} className="border border-emerald-400/40 bg-emerald-950/60 px-0.5 py-1 text-center">
                <p className="text-[10px] leading-tight text-emerald-100/80">کۆی گشتی قیاسەکان</p>
                <p className="text-[11px] font-semibold break-all tabular-nums text-emerald-300">{formatMeasurement(measurementTotal)}</p>
              </td>
              <td className="border border-emerald-400/25" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const headClass = "border border-white/10 px-px py-1 text-center text-[9px] font-medium leading-tight break-words sm:text-[10px]";
const cellClass = "border border-white/10 p-px align-middle overflow-hidden";

function ItemRow({
  row,
  lead,
  span,
  merchantTotal,
  autoFocus,
  focusField,
  onChange,
  onDelete,
  onError,
  onPatchMerchant,
  onFlushMerchant,
  onAddLine,
}: {
  row: ItemDraft;
  lead: boolean;
  span: number;
  merchantTotal: string;
  autoFocus: boolean;
  focusField: "merchant" | "width";
  onChange: (row: ItemDraft) => void;
  onDelete: () => void;
  onError: (message: string) => void;
  onPatchMerchant: (merchant: string) => void;
  onFlushMerchant: () => void;
  onAddLine: (merchant: string) => void;
}) {
  const latest = useRef(row);
  const savedKey = useRef(draftKey(row));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);
  const merchantRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const saveNow = useRef<(notify: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    latest.current = row;
    saveNow.current = async (notify) => {
      const next = latest.current;
      const parsed = parseItemDraft(next);
      if (!parsed.ok) {
        if (notify) onError(parsed.message);
        return;
      }

      const key = JSON.stringify(parsed.value);
      if (key === savedKey.current) return;

      const token = ++request.current;
      const result = await updateContainerItem(next.id, parsed.value);
      if (token !== request.current) return;
      if (!result.ok) {
        if (notify) onError(result.message);
        return;
      }

      savedKey.current = key;
      if (notify) onError("");
    };
  });

  useEffect(() => {
    if (!autoFocus) return;
    const field = focusField === "width" ? widthRef.current : merchantRef.current;
    field?.focus();
  }, [autoFocus, focusField]);

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

  function onEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    flush();
    onFlushMerchant();
    onAddLine(latest.current.merchant);
  }

  return (
    <tr>
      {lead ? (
        <td rowSpan={span} className={`${cellClass} align-middle`}>
          <div className="flex min-w-0 items-center gap-0.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[9px] font-semibold text-emerald-300">
              {merchantBadge(row.merchant)}
            </span>
            <input
              ref={merchantRef}
              value={row.merchant}
              onChange={(event) => {
                latest.current = { ...latest.current, merchant: event.target.value };
                onPatchMerchant(event.target.value);
              }}
              onBlur={() => {
                flush();
                onFlushMerchant();
              }}
              onKeyDown={onEnter}
              placeholder="بازرگان"
              aria-label="ناوی بازرگان"
              className={`${fieldClass} min-w-0 flex-1 text-start`}
            />
          </div>
        </td>
      ) : null}
      <td className={cellClass}>
        <input
          ref={widthRef}
          value={row.width}
          onChange={(event) => edit({ width: event.target.value })}
          onBlur={flush}
          onKeyDown={onEnter}
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
          onKeyDown={onEnter}
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
          onKeyDown={onEnter}
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
          onKeyDown={onEnter}
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
          onKeyDown={onEnter}
          placeholder="تێبینی"
          aria-label="تێبینی"
          className={fieldClass}
        />
      </td>
      <td className={`${cellClass} text-center text-[10px] font-semibold break-all tabular-nums leading-tight text-emerald-400`}>
        {rowMeasure(row)}
      </td>
      {lead ? (
        <td rowSpan={span} className={`${cellClass} align-middle text-center text-[10px] font-semibold break-all tabular-nums leading-tight text-emerald-300`}>
          {merchantTotal}
        </td>
      ) : null}
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

function merchantBadge(name: string) {
  const letter = name.trim().charAt(0);
  return letter || "•";
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 fill-none stroke-slate-400 stroke-[1.6]">
      <path d="M12.5 3.5l4 4L7 17H3v-4L12.5 3.5z" strokeLinejoin="round" />
    </svg>
  );
}

function merchantKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function groupRows(rows: ItemDraft[]) {
  const groups: ItemDraft[][] = [];
  const named = new Map<string, ItemDraft[]>();
  for (const row of rows) {
    const key = merchantKey(row.merchant);
    if (!key) {
      groups.push([row]);
      continue;
    }
    const existing = named.get(key);
    if (existing) {
      existing.push(row);
      continue;
    }
    const group = [row];
    named.set(key, group);
    groups.push(group);
  }
  return groups;
}

function groupTotal(group: ItemDraft[]) {
  if (group.every((row) => unusedRow(row))) return "";
  return formatMeasurement(group.reduce((sum, row) => sum + lineMeasurement(row), 0));
}

function unusedRow(row: ItemDraft) {
  return [row.width, row.length, row.height, row.quantity].every((value) => value.trim() === "");
}

function rowMeasure(row: ItemDraft) {
  if (unusedRow(row)) return "";
  return formatMeasurement(lineMeasurement(row));
}

function draftKey(row: ItemDraft) {
  const parsed = parseItemDraft(row);
  return parsed.ok ? JSON.stringify(parsed.value) : "";
}
