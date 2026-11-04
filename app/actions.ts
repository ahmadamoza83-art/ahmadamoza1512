"use server";

import { timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { clearSession, getSessionUser, setSession } from "@/lib/session";
import type { Container, ContainerItem } from "@/lib/containers";
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
    const { data, error } = await supabase
      .from("container_items")
      .select("id, container_id, item_name, quantity, weight_kg, cbm, owner_name, created_at")
      .eq("container_id", containerId)
      .order("created_at", { ascending: false });

    if (error) return { ok: false as const, message: mapContainerError(error) };

    return {
      ok: true as const,
      items: (data ?? []).map((item) => ({
        id: String(item.id),
        container_id: String(item.container_id),
        item_name: item.item_name,
        quantity: Number(item.quantity ?? 0),
        weight_kg: item.weight_kg === null ? null : Number(item.weight_kg),
        cbm: item.cbm === null ? null : Number(item.cbm),
        owner_name: item.owner_name,
        created_at: item.created_at,
      })) as ContainerItem[],
    };
  } catch {
    return { ok: false as const, message: "پەیوەندی بە بنکەی زانیارییەوە سەرنەکەوت. دووبارە هەوڵبدەرەوە." };
  }
}
