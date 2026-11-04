"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createUser, deleteUser, listUsers, login, logout } from "@/app/actions";
import { Dashboard } from "@/app/dashboard";
import type { AppUser } from "@/lib/users";

function FormError({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-start text-sm leading-6 text-rose-700">
      {message}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AuthScreen({ initialUsername }: { initialUsername: string | null }) {
  const router = useRouter();
  const titleId = useId();
  const [username, setUsername] = useState(initialUsername);
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [adminOpen, setAdminOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [unlockedPin, setUnlockedPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [users, setUsers] = useState<AppUser[]>([]);
  const [listError, setListError] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshUsers = useCallback(async (activePin: string) => {
    const result = await listUsers(activePin);
    if (!result.ok) {
      setListError(result.message);
      return;
    }
    setUsers(result.users);
    setListError("");
  }, []);

  const closeAdmin = useCallback(() => {
    setAdminOpen(false);
    setPin("");
    setUnlockedPin("");
    setPinError("");
    setUsers([]);
    setListError("");
    setNewName("");
    setNewPassword("");
    setCreateError("");
    setCreateMessage("");
    setPendingDeleteId(null);
  }, []);

  useEffect(() => {
    if (!adminOpen || !unlockedPin) return;
    const timer = window.setInterval(() => {
      void refreshUsers(unlockedPin);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [adminOpen, unlockedPin, refreshUsers]);

  useEffect(() => {
    if (!adminOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAdmin();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [adminOpen, closeAdmin]);

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setLoginPending(true);
    setLoginError("");
    const result = await login(loginName, loginPassword);
    setLoginPending(false);
    if (!result.ok) {
      setLoginError(result.message);
      return;
    }
    setUsername(result.username);
    setLoginPassword("");
    router.refresh();
  }

  async function onLogout() {
    await logout();
    setUsername(null);
    router.refresh();
  }

  function onUnlock(event: FormEvent) {
    event.preventDefault();
    if (pin.trim() !== "1512") {
      setPinError("رمز الإدارة غير صحيح.");
      return;
    }
    setPinError("");
    setUnlockedPin("1512");
    void refreshUsers("1512");
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setCreatePending(true);
    setCreateError("");
    setCreateMessage("");
    const result = await createUser(unlockedPin, newName, newPassword);
    setCreatePending(false);
    if (!result.ok) {
      setCreateError(result.message);
      return;
    }
    setNewName("");
    setNewPassword("");
    setCreateMessage("تم إنشاء المستخدم.");
    await refreshUsers(unlockedPin);
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    const result = await deleteUser(unlockedPin, id);
    setDeletingId(null);
    if (!result.ok) {
      setListError(result.message);
      return;
    }
    setPendingDeleteId(null);
    setUsers((current) => current.filter((user) => user.id !== id));
    await refreshUsers(unlockedPin);
  }

  if (username) {
    return <Dashboard username={username} onLogout={() => void onLogout()} />;
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#eef3f7] px-4 py-10">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-teal-200/70 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 end-0 h-56 w-56 rounded-full bg-sky-200/60 blur-3xl" />

      <main className="relative w-full max-w-md rounded-3xl border border-white/80 bg-white p-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] sm:p-8">
          <section>
            <div className="mb-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <LockIcon />
              </div>
              <h1 className="mt-5 text-2xl font-bold text-slate-900">تسجيل الدخول</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                أدخل اسم المستخدم وكلمة المرور للمتابعة.
              </p>
            </div>

            <form onSubmit={onLogin} className="space-y-4">
              <label className="block text-start">
                <span className="mb-2 block text-sm font-medium text-slate-700">اسم المستخدم</span>
                <input
                  value={loginName}
                  onChange={(event) => setLoginName(event.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-start outline-none transition focus:border-teal-700 focus:bg-white focus:ring-4 focus:ring-teal-700/10"
                />
              </label>
              <label className="block text-start">
                <span className="mb-2 block text-sm font-medium text-slate-700">كلمة المرور</span>
                <span className="flex h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-teal-700 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-700/10">
                  <input
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    type={showLoginPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="h-full min-w-0 flex-1 bg-transparent px-4 text-start outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((current) => !current)}
                    className="px-4 text-xs font-medium text-slate-500"
                  >
                    {showLoginPassword ? "إخفاء" : "إظهار"}
                  </button>
                </span>
              </label>

              {loginError ? <FormError message={loginError} /> : null}

              <button
                type="submit"
                disabled={loginPending}
                className="h-12 w-full rounded-2xl bg-teal-700 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
              >
                {loginPending ? "جارٍ التحقق..." : "دخول"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="mt-3 h-12 w-full rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              لوحة الإدارة
            </button>
          </section>
      </main>

      {adminOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
          <button
            type="button"
            aria-label="إغلاق"
            className="absolute inset-0 cursor-default"
            onClick={closeAdmin}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={closeAdmin}
              className="absolute end-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="إغلاق"
            >
              ×
            </button>

            <h2 id={titleId} className="text-xl font-bold text-slate-900">
              لوحة الإدارة
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {unlockedPin ? "أضف مستخدماً أو احذف حساباً موجوداً." : "أدخل رمز الإدارة للمتابعة."}
            </p>

            {unlockedPin ? (
              <div className="mt-6 space-y-6">
                <form onSubmit={onCreate} className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-800">مستخدم جديد</h3>
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="اسم المستخدم"
                    autoComplete="off"
                    className="admin-field h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-start text-white caret-white outline-none placeholder:text-slate-400 focus:border-teal-400"
                  />
                  <input
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="كلمة المرور"
                    type="password"
                    autoComplete="new-password"
                    className="admin-field h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-start text-white caret-white outline-none placeholder:text-slate-400 focus:border-teal-400"
                  />
                  {createError ? <FormError message={createError} /> : null}
                  {createMessage ? (
                    <p className="text-sm text-teal-700">{createMessage}</p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={createPending}
                    className="h-11 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {createPending ? "جارٍ الإنشاء..." : "إنشاء المستخدم"}
                  </button>
                </form>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">المستخدمون</h3>
                    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
                      مباشر
                    </span>
                  </div>
                  {listError ? (
                    <div className="mb-3">
                      <FormError message={listError} />
                    </div>
                  ) : null}
                  {users.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      لا يوجد مستخدمون بعد.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {users.map((user) => (
                        <li key={user.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0 text-start">
                            <p className="truncate font-medium text-slate-900">{user.username}</p>
                            <p className="text-xs text-slate-500">{formatDate(user.created_at)}</p>
                          </div>
                          {pendingDeleteId === user.id ? (
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => onDelete(user.id)}
                                disabled={deletingId === user.id}
                                className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                تأكيد
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(null)}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                              >
                                تراجع
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(user.id)}
                              className="shrink-0 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              حذف
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : (
              <form onSubmit={onUnlock} className="mt-6 space-y-4">
                <label className="block text-start">
                  <span className="mb-2 block text-sm font-medium text-slate-700">رمز الإدارة</span>
                  <input
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    autoComplete="off"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-start tracking-[0.3em] outline-none focus:border-teal-700 focus:bg-white focus:ring-4 focus:ring-teal-700/10"
                  />
                </label>
                {pinError ? <FormError message={pinError} /> : null}
                <button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-slate-900 text-sm font-semibold text-white"
                >
                  دخول إلى اللوحة
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
