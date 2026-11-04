"use server";

import { timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { clearSession, getSessionUser, setSession } from "@/lib/session";
import type { Container, ContainerItem } from "@/lib/containers";
import type { ItemInput } from "@/lib/item-measure";
import { lineMeasurement } from "@/lib/item-measure";
import type { AppUser } from "@/lib/users";

const ADMIN_PIN = "1512";

type AuthError = { message: string; code?: string };

function pinMatches(pin: string) {
  const given = Buffer.from(pin);
  const expected = Buffer.from(ADMIN_PIN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function passwordsMatch(stored: string, given: string) {
  const left = Buffer.from(stored);
  const right = Buffer.from(given);
  return left.length === right.length && timingSafeEqual(left, right);
}

function mapError(error: AuthError) {
  const message = error.message ?? "";

  if (error.code === "23505" || message.includes("duplicate key")) {
    return "ناوی بەکارهێنەر پێشتر هەیە.";
  }

  if (message.includes("row-level security")) {
    return "نەتوانرا بەکارهێنەران دەستکاری بکرێن. مۆڵەتی خشتەکە ڕێگە بە زیادکردن یان سڕینەوە نادات.";
  }

  return "کردارەکە سەرنەکەوت. دووبارە هەوڵبدەرەوە.";
}

export async function login(username: string, password: string) {
  const cleanUsername = username.trim();

  if (!cleanUsername || !password) {
    return { ok: false as const, message: "ناوی بەکارهێنەر و وشەی نهێنی بنووسە." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("username, password")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (error) return { ok: false as const, message: mapError(error) };
  if (!data || !passwordsMatch(String(data.password ?? ""), password)) {
    return { ok: false as const, message: "ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە." };
  }

  await setSession(data.username);
  return { ok: true as const, username: data.username as string };
}

export async function logout() {
  await clearSession();
  return { ok: true as const };
}

export async function listUsers(pin: string) {
  if (!pinMatches(pin)) {
    return { ok: false as const, message: "کۆدی بەڕێوەبردن هەڵەیە." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, created_at")
    .order("created_at", { ascending: false });

  if (error) return { ok: false as const, message: mapError(error) };

  const users = (data ?? []).map((user) => ({
    id: String(user.id),
    username: user.username,
    created_at: user.created_at,
  })) as AppUser[];

  return { ok: true as const, users };
}

export async function createUser(
  pin: string,
  username: string,
  password: string,
) {
  if (!pinMatches(pin)) {
    return { ok: false as const, message: "کۆدی بەڕێوەبردن هەڵەیە." };
  }

  const cleanUsername = username.trim();
  if (cleanUsername.length < 2 || cleanUsername.length > 50) {
    return { ok: false as const, message: "ناوی بەکارهێنەر دەبێت لە نێوان ٢ بۆ ٥٠ پیت بێت." };
  }
  if (password.length < 4 || password.length > 100) {
    return { ok: false as const, message: "وشەی نهێنی دەبێت لە نێوان ٤ بۆ ١٠٠ پیت بێت." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("app_users").insert({
      username: cleanUsername,
      password,
    });

    if (error) return { ok: false as const, message: mapError(error) };
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "پەیوەندی بە بنکەی زانیارییەوە سەرنەکەوت. دووبارە هەوڵبدەرەوە." };
  }
}

export async function deleteUser(pin: string, id: string) {
  if (!pinMatches(pin)) {
    return { ok: false as const, message: "کۆدی بەڕێوەبردن هەڵەیە." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_users")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) return { ok: false as const, message: mapError(error) };
    if (!data?.length) {
      return { ok: false as const, message: "نەتوانرا بەکارهێنەر بسڕدرێتەوە. مۆڵەتی سڕینەوە لە خشتەکەدا بپشکنە." };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "پەیوەندی بە بنکەی زانیارییەوە سەرنەکەوت. دووبارە هەوڵبدەرەوە." };
  }
}

const itemColumns =
  "id, container_id, item_name, quantity, weight_kg, cbm, owner_name, created_at, width, length, height, notes";
const basicItemColumns =
  "id, container_id, item_name, quantity, weight_kg, cbm, owner_name, created_at";
const packedPrefix = "amz1:";

let hasMeasurementColumns: boolean | null = null;

function mapContainerError(error: AuthError) {
  const message = error.message ?? "";

  if (error.code === "23505" || message.includes("duplicate key")) {
    return "ژمارەی کۆنتێنەر پێشتر هەیە.";
  }

  if (message.includes("row-level security")) {
    return "نەتوانرا کۆنتێنەرەکان دەستکاری بکرێن. مۆڵەتی خشتەکە ڕێگە بەم کردارە نادات.";
  }

  return "کردارەکە سەرنەکەوت. دووبارە هەوڵبدەرەوە.";
}

function isMissingColumn(error: AuthError) {
  const message = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("Could not find")
  );
}

function mapItemError(error: AuthError) {
  const message = error.message ?? "";

  if (message.includes("row-level security")) {
    return "نەتوانرا ماددەکان دەستکاری بکرێن. مۆڵەتی خشتەکە ڕێگە بەم کردارە نادات.";
  }

  return "پاشەکەوتکردن سەرنەکەوت. دووبارە هەوڵبدەرەوە.";
}

function packItem(value: {
  merchant: string;
  width: number | null;
  length: number | null;
  height: number | null;
  notes: string;
}) {
  return packedPrefix + JSON.stringify(value);
}

function unpackItem(itemName: string) {
  if (!itemName.startsWith(packedPrefix)) return null;
  try {
    const value = JSON.parse(itemName.slice(packedPrefix.length)) as {
      merchant?: unknown;
      width?: unknown;
      length?: unknown;
      height?: unknown;
      notes?: unknown;
    };
    return {
      merchant: typeof value.merchant === "string" ? value.merchant : "",
      width: typeof value.width === "number" ? value.width : null,
      length: typeof value.length === "number" ? value.length : null,
      height: typeof value.height === "number" ? value.height : null,
      notes: typeof value.notes === "string" ? value.notes : "",
    };
  } catch {
    return null;
  }
}

function mapItem(item: {
  id: unknown;
  container_id: unknown;
  item_name: string;
  quantity: number | string | null;
  weight_kg: number | string | null;
  cbm: number | string | null;
  owner_name: string | null;
  width?: number | string | null;
  length?: number | string | null;
  height?: number | string | null;
  notes?: string | null;
  created_at: string;
}): ContainerItem {
  const packed = unpackItem(item.item_name ?? "");
  const width = measureOrNull(item.width) ?? packed?.width ?? null;
  const length = measureOrNull(item.length) ?? packed?.length ?? null;
  const height = measureOrNull(item.height) ?? packed?.height ?? null;
  const merchant = item.owner_name || packed?.merchant || null;

  return {
    id: String(item.id),
    container_id: String(item.container_id),
    item_name: merchant || item.item_name,
    quantity: Number(item.quantity ?? 0),
    weight_kg: item.weight_kg === null ? null : Number(item.weight_kg),
    cbm: item.cbm === null ? null : Number(item.cbm),
    owner_name: merchant,
    width,
    length,
    height,
    notes: item.notes || packed?.notes || null,
    created_at: item.created_at,
  };
}

async function requireUser() {
  const username = await getSessionUser();
  if (!username) {
    return { ok: false as const, message: "سەرەتا دەبێت بچیتە ژوورەوە." };
  }
  return { ok: true as const, username };
}

export async function listContainers() {
  const session = await requireUser();
  if (!session.ok) return session;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("containers")
      .select("id, container_number, status, created_at")
      .order("created_at", { ascending: false });

    if (error) return { ok: false as const, message: mapContainerError(error) };

    return {
      ok: true as const,
      containers: (data ?? []).map((container) => ({
        id: String(container.id),
        container_number: container.container_number,
        status: container.status,
        created_at: container.created_at,
      })) as Container[],
    };
  } catch {
    return { ok: false as const, message: "پەیوەندی بە بنکەی زانیارییەوە سەرنەکەوت. دووبارە هەوڵبدەرەوە." };
  }
}

export async function createContainer(containerNumber: string) {
  const session = await requireUser();
  if (!session.ok) return session;

  const cleanNumber = containerNumber.trim();
  if (!cleanNumber || cleanNumber.length > 40) {
    return { ok: false as const, message: "ژمارەیەکی دروستی کۆنتێنەر بنووسە." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("containers")
      .insert({ container_number: cleanNumber })
      .select("id, container_number, status, created_at")
      .single();

    if (error) return { ok: false as const, message: mapContainerError(error) };

    return {
      ok: true as const,
      container: {
        id: String(data.id),
        container_number: data.container_number,
        status: data.status,
        created_at: data.created_at,
      } as Container,
    };
  } catch {
    return { ok: false as const, message: "پەیوەندی بە بنکەی زانیارییەوە سەرنەکەوت. دووبارە هەوڵبدەرەوە." };
  }
}

export async function listContainerItems(containerId: string) {
  const session = await requireUser();
  if (!session.ok) return session;

  try {
    const supabase = await createClient();
    const columns = hasMeasurementColumns === false ? basicItemColumns : itemColumns;
    const { data, error } = await supabase
      .from("container_items")
      .select(columns)
      .eq("container_id", containerId)
      .order("created_at", { ascending: true });

    if (error && hasMeasurementColumns !== false && isMissingColumn(error)) {
      hasMeasurementColumns = false;
      const fallback = await supabase
        .from("container_items")
        .select(basicItemColumns)
        .eq("container_id", containerId)
        .order("created_at", { ascending: true });
      if (fallback.error) return { ok: false as const, message: mapItemError(fallback.error) };
      return { ok: true as const, items: (fallback.data ?? []).map((item) => mapItem(item)) };
    }

    if (error) return { ok: false as const, message: mapItemError(error) };
    if (hasMeasurementColumns === null) hasMeasurementColumns = true;

    return {
      ok: true as const,
      items: (data ?? []).map((item) => mapItem(item)),
    };
  } catch {
    return { ok: false as const, message: "پەیوەندی بە بنکەی زانیارییەوە سەرنەکەوت. دووبارە هەوڵبدەرەوە." };
  }
}

export async function createContainerItem(containerId: string) {
  const session = await requireUser();
  if (!session.ok) return session;

  if (!containerId) {
    return { ok: false as const, message: "کۆنتێنەرەکە نەدۆزرایەوە." };
  }

  try {
    const supabase = await createClient();
    const baseRow = {
      container_id: containerId,
      item_name: "بابەت",
      quantity: 0,
      owner_name: null,
      cbm: 0,
    };
    const inserted =
      hasMeasurementColumns === false
        ? await supabase.from("container_items").insert(baseRow).select(basicItemColumns).single()
        : await supabase
            .from("container_items")
            .insert({ ...baseRow, width: null, length: null, height: null, notes: null })
            .select(itemColumns)
            .single();

    if (inserted.error && hasMeasurementColumns !== false && isMissingColumn(inserted.error)) {
      hasMeasurementColumns = false;
      const fallback = await supabase.from("container_items").insert(baseRow).select(basicItemColumns).single();
      if (fallback.error) return { ok: false as const, message: mapItemError(fallback.error) };
      return { ok: true as const, item: mapItem(fallback.data) };
    }

    if (inserted.error) return { ok: false as const, message: mapItemError(inserted.error) };
    if (hasMeasurementColumns === null) hasMeasurementColumns = true;

    return { ok: true as const, item: mapItem(inserted.data) };
  } catch {
    return { ok: false as const, message: "پەیوەندی بە بنکەی زانیارییەوە سەرنەکەوت. دووبارە هەوڵبدەرەوە." };
  }
}

export async function updateContainerItem(itemId: string, input: ItemInput) {
  const session = await requireUser();
  if (!session.ok) return session;

  const merchant = input.merchant.trim().slice(0, 120);
  const notes = input.notes.trim().slice(0, 500);
  const width = cleanMeasure(input.width);
  const length = cleanMeasure(input.length);
  const height = cleanMeasure(input.height);
  const quantity = cleanMeasure(input.quantity) ?? 0;
  const total = lineMeasurement({
    width: width === null ? "" : String(width),
    length: length === null ? "" : String(length),
    height: height === null ? "" : String(height),
    quantity: String(quantity),
  });

  try {
    const supabase = await createClient();
    const shared = {
      owner_name: merchant || null,
      quantity,
      cbm: total,
    };
    const packedRow = {
      ...shared,
      item_name: packItem({ merchant, width, length, height, notes }),
    };
    const measuredRow = {
      ...shared,
      item_name: merchant || "بابەت",
      width,
      length,
      height,
      notes: notes || null,
    };

    const updated =
      hasMeasurementColumns === false
        ? await supabase.from("container_items").update(packedRow).eq("id", itemId)
        : await supabase.from("container_items").update(measuredRow).eq("id", itemId);

    if (updated.error && hasMeasurementColumns !== false && isMissingColumn(updated.error)) {
      hasMeasurementColumns = false;
      const fallback = await supabase.from("container_items").update(packedRow).eq("id", itemId);
      if (fallback.error) return { ok: false as const, message: mapItemError(fallback.error) };
      return { ok: true as const };
    }

    if (updated.error) return { ok: false as const, message: mapItemError(updated.error) };
    if (hasMeasurementColumns === null) hasMeasurementColumns = true;
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "پەیوەندی بە بنکەی زانیارییەوە سەرنەکەوت. دووبارە هەوڵبدەرەوە." };
  }
}

export async function deleteContainerItem(itemId: string) {
  const session = await requireUser();
  if (!session.ok) return session;

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("container_items").delete().eq("id", itemId);
    if (error) return { ok: false as const, message: mapItemError(error) };
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "پەیوەندی بە بنکەی زانیارییەوە سەرنەکەوت. دووبارە هەوڵبدەرەوە." };
  }
}

function measureOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanMeasure(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) return null;
  return value;
}
