export type ItemDraft = {
  id: string;
  merchant: string;
  width: string;
  length: string;
  height: string;
  quantity: string;
  notes: string;
};

export type ItemInput = {
  merchant: string;
  width: number | null;
  length: number | null;
  height: number | null;
  quantity: number;
  notes: string;
};

export function liveNumber(value: string) {
  const trimmed = value.trim().replace(/,/g, ".");
  if (!trimmed) return 0;
  const number = Number(trimmed);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function lineMeasurement(draft: Pick<ItemDraft, "width" | "length" | "height" | "quantity">) {
  return (
    liveNumber(draft.width) *
    liveNumber(draft.length) *
    liveNumber(draft.height) *
    liveNumber(draft.quantity)
  );
}

export function formatMeasurement(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return String(rounded);
}

export function parseItemDraft(
  draft: ItemDraft,
): { ok: true; value: ItemInput } | { ok: false; message: string } {
  const merchant = draft.merchant.trim();
  const notes = draft.notes.trim();

  if (merchant.length > 120) {
    return { ok: false, message: "ناوی بازرگان زۆر درێژە." };
  }

  if (notes.length > 500) {
    return { ok: false, message: "تێبینی زۆر درێژە." };
  }

  const width = parseOptionalNumber(draft.width, "پانی");
  if (!width.ok) return width;
  const length = parseOptionalNumber(draft.length, "درێژی");
  if (!length.ok) return length;
  const height = parseOptionalNumber(draft.height, "بەرزی");
  if (!height.ok) return height;
  const quantity = parseOptionalNumber(draft.quantity, "عدد");
  if (!quantity.ok) return quantity;

  return {
    ok: true,
    value: {
      merchant,
      width: width.value,
      length: length.value,
      height: height.value,
      quantity: quantity.value ?? 0,
      notes,
    },
  };
}

function parseOptionalNumber(
  value: string,
  label: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const trimmed = value.trim().replace(/,/g, ".");
  if (!trimmed) return { ok: true, value: null };
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    return { ok: false, message: `${label} دەبێت ژمارەیەکی دروست بێت.` };
  }
  const number = Number(trimmed);
  if (!Number.isFinite(number) || number > 1_000_000_000) {
    return { ok: false, message: `${label} زۆر گەورەیە.` };
  }
  return { ok: true, value: number };
}
