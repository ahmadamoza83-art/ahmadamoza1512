import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

const COOKIE = "app_user_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  return process.env.SESSION_SECRET || "ahmadamoza-local-session";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function getSessionUser() {
  await connection();
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE)?.value;
  if (!raw) return null;

  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return null;

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { username?: string; exp?: number };

    if (!data.username || !data.exp || data.exp < Date.now()) return null;
    return data.username;
  } catch {
    return null;
  }
}

export async function setSession(username: string) {
  const payload = Buffer.from(
    JSON.stringify({ username, exp: Date.now() + MAX_AGE * 1000 }),
  ).toString("base64url");
  const cookieStore = await cookies();

  cookieStore.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
