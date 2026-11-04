"use server";

import { timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { clearSession, setSession } from "@/lib/session";
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
    return "اسم المستخدم موجود مسبقاً.";
  }

  if (message.includes("row-level security")) {
    return "تعذر تعديل المستخدمين. صلاحيات الجدول لا تسمح بالإضافة أو الحذف.";
  }

  return "تعذر تنفيذ العملية. حاول مرة أخرى.";
}

export async function login(username: string, password: string) {
  const cleanUsername = username.trim();

  if (!cleanUsername || !password) {
    return { ok: false as const, message: "أدخل اسم المستخدم وكلمة المرور." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("username, password")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (error) return { ok: false as const, message: mapError(error) };
  if (!data || !passwordsMatch(String(data.password ?? ""), password)) {
    return { ok: false as const, message: "اسم المستخدم أو كلمة المرور غير صحيحة." };
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
    return { ok: false as const, message: "رمز الإدارة غير صحيح." };
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
    return { ok: false as const, message: "رمز الإدارة غير صحيح." };
  }

  const cleanUsername = username.trim();
  if (cleanUsername.length < 2 || cleanUsername.length > 50) {
    return { ok: false as const, message: "اسم المستخدم يجب أن يكون بين 2 و 50 حرفاً." };
  }
  if (password.length < 4 || password.length > 100) {
    return { ok: false as const, message: "كلمة المرور يجب أن تكون بين 4 و 100 حرف." };
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
    return { ok: false as const, message: "تعذر الاتصال بقاعدة البيانات. حاول مرة أخرى." };
  }
}

export async function deleteUser(pin: string, id: string) {
  if (!pinMatches(pin)) {
    return { ok: false as const, message: "رمز الإدارة غير صحيح." };
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
      return { ok: false as const, message: "تعذر حذف المستخدم. تحقق من صلاحيات الحذف في الجدول." };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "تعذر الاتصال بقاعدة البيانات. حاول مرة أخرى." };
  }
}
