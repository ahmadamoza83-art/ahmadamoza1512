const KEY = "app_user_session";
const MAX_AGE = 60 * 60 * 24 * 7;

type StoredSession = {
  username: string;
  exp: number;
};

export function getSessionUser() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredSession;
    if (!data.username || !data.exp || data.exp < Date.now()) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return data.username;
  } catch {
    return null;
  }
}

export function setSession(username: string) {
  const data: StoredSession = { username, exp: Date.now() + MAX_AGE * 1000 };
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearSession() {
  window.localStorage.removeItem(KEY);
}

export function subscribeSession(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
