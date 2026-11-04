"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { createContainer, listContainerItems, listContainers } from "@/app/actions";
import type { Container, ContainerItem } from "@/lib/containers";
import { HistoryCalendar } from "@/app/history-calendar";
import { dayKey, formatDate, formatDayLabel } from "@/lib/format-date";

const statusLabels: Record<string, string> = {
  pending: "چاوەڕوان",
  active: "چالاک",
  delivered: "گەیشتووە",
  closed: "داخراو",
};

export function Dashboard({
  username,
  onLogout,
}: {
  username: string;
  onLogout: () => void;
}) {
  const titleId = useId();
  const [containers, setContainers] = useState<Container[]>([]);
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<ContainerItem[]>([]);
  const [itemsError, setItemsError] = useState("");
  const [itemsLoading, setItemsLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [containerNumber, setContainerNumber] = useState("");
  const [addError, setAddError] = useState("");
  const [addPending, setAddPending] = useState(false);
  const [view, setView] = useState<"containers" | "history">("containers");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await listContainers();
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setListError(result.message);
        return;
      }
      setContainers(result.containers);
      setListError("");
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!addOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [addOpen]);

  const selected = containers.find((container) => container.id === selectedId) ?? null;
  const dayContainers = selectedDay
    ? containers.filter((container) => dayKey(container.created_at) === selectedDay)
    : [];

  function chooseDay(key: string) {
    setSelectedDay(key);
    const matches = containers.filter((container) => dayKey(container.created_at) === key);
    if (!matches.some((container) => container.id === selectedId)) {
      setSelectedId(null);
      setItems([]);
      setItemsError("");
    }
  }

  async function openContainer(container: Container) {
    setSelectedId(container.id);
    setItemsLoading(true);
    setItemsError("");
    const result = await listContainerItems(container.id);
    setItemsLoading(false);
    if (!result.ok) {
      setItems([]);
      setItemsError(result.message);
      return;
    }
    setItems(result.items);
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setAddPending(true);
    setAddError("");
    const result = await createContainer(containerNumber);
    setAddPending(false);
    if (!result.ok) {
      setAddError(result.message);
      return;
    }
    setContainers((current) => [result.container, ...current]);
    setContainerNumber("");
    setAddOpen(false);
    await openContainer(result.container);
  }

  return (
    <div className="min-h-full flex-1 bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="min-w-0 text-start">
            <p className="text-sm text-slate-400">بەخێربێیت، {username}</p>
            <h1 className="truncate text-2xl font-bold">کۆنتێنەرەکان</h1>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="h-11 shrink-0 rounded-2xl border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
          >
            دەرچوون
          </button>
        </div>
        <div className="mx-auto flex w-full max-w-6xl gap-2 px-4 pb-5 sm:px-6">
          <button
            type="button"
            onClick={() => setView("containers")}
            className={`h-10 rounded-2xl px-4 text-sm font-semibold transition ${
              view === "containers" ? "bg-white text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            کۆنتێنەرەکان
          </button>
          <button
            type="button"
            onClick={() => setView("history")}
            className={`h-10 rounded-2xl px-4 text-sm font-semibold transition ${
              view === "history" ? "bg-white text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            مێژوو
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-3xl border border-white/10 bg-slate-900 p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="text-start">
              <h2 className="text-lg font-semibold">
                {view === "history" ? "مێژوو" : "هەموو کۆنتێنەرەکان"}
              </h2>
              {view === "history" ? (
                <p className="mt-1 text-sm text-slate-400">تۆماری پێشووی گواستنەوەکان بە بەروار و کات.</p>
              ) : null}
            </div>
            {view === "containers" ? (
              <button
                type="button"
                onClick={() => {
                  setAddError("");
                  setAddOpen(true);
                }}
                className="h-11 shrink-0 rounded-2xl bg-teal-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
              >
                زیادکردنی کۆنتێنەر
              </button>
            ) : null}
          </div>

          {listError ? (
            <p role="alert" className="mb-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {listError}
            </p>
          ) : null}

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">باردەکرێت...</p>
          ) : view === "history" ? (
            <div className="space-y-5">
              <HistoryCalendar containers={containers} selectedDay={selectedDay} onSelect={chooseDay} />
              {selectedDay ? (
                <>
                  <p className="text-start text-sm font-medium text-emerald-400">{formatDayLabel(selectedDay)}</p>
                  {dayContainers.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
                      هیچ کۆنتێنەرێک لەم ڕۆژەدا دروست نەکراوە.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {dayContainers.map((container) => {
                        const active = container.id === selectedId;
                        return (
                          <li key={container.id}>
                            <button
                              type="button"
                              onClick={() => void openContainer(container)}
                              className={`w-full rounded-2xl border px-4 py-4 text-start transition ${
                                active
                                  ? "border-emerald-400 bg-emerald-600/10"
                                  : "border-white/10 bg-slate-950 hover:border-white/20"
                              }`}
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span className="truncate text-base font-semibold">
                                  {container.container_number}
                                </span>
                                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                                  {statusLabels[container.status] ?? container.status}
                                </span>
                              </span>
                              <time
                                dateTime={container.created_at}
                                className="mt-2 block text-xs text-slate-400"
                              >
                                {formatDate(container.created_at)}
                              </time>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
                  ڕۆژێک هەڵبژێرە بۆ بینینی کۆنتێنەرەکانی ئەو ڕۆژە.
                </p>
              )}
            </div>
          ) : containers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-slate-400">
              هێشتا هیچ کۆنتێنەرێک نییە. یەکەم کۆنتێنەر زیاد بکە.
            </p>
          ) : (
            <ul className="space-y-3">
              {containers.map((container) => {
                const active = container.id === selectedId;
                return (
                  <li key={container.id}>
                    <button
                      type="button"
                      onClick={() => void openContainer(container)}
                      className={`w-full rounded-2xl border px-4 py-4 text-start transition ${
                        active
                          ? "border-teal-400 bg-teal-400/10"
                          : "border-white/10 bg-slate-950 hover:border-white/20"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-base font-semibold">
                          {container.container_number}
                        </span>
                        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                          {statusLabels[container.status] ?? container.status}
                        </span>
                      </span>
                      <span className="mt-2 block text-xs text-slate-400">
                        <time dateTime={container.created_at}>{formatDate(container.created_at)}</time>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">ماددەکانی کۆنتێنەر</h2>
          {selected ? (
            <p className="mt-1 text-sm text-slate-400">{selected.container_number}</p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">
              {view === "history" && !selectedDay
                ? "سەرەتا ڕۆژێک لە ڕۆژژمێرەکە هەڵبژێرە."
                : "کۆنتێنەرێک هەڵبژێرە بۆ بینینی ماددەکانی."}
            </p>
          )}

          {itemsError ? (
            <p role="alert" className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {itemsError}
            </p>
          ) : null}

          {!selected ? null : itemsLoading ? (
            <p className="py-10 text-center text-sm text-slate-400">باردەکرێت...</p>
          ) : items.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-slate-400">
              هیچ ماددەیەک لە ناو ئەم کۆنتێنەرەدا نییە.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-white/10">
              {items.map((item) => (
                <li key={item.id} className="py-4 text-start">
                  <p className="font-medium">{item.item_name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    بڕ {item.quantity}
                    {item.weight_kg !== null ? ` · کێش ${item.weight_kg} کگم` : ""}
                    {item.cbm !== null ? ` · قەبارە ${item.cbm}` : ""}
                    {item.owner_name ? ` · ${item.owner_name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <button
            type="button"
            aria-label="داخستن"
            className="absolute inset-0 cursor-default"
            onClick={() => setAddOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
          >
            <h2 id={titleId} className="text-xl font-bold">
              زیادکردنی کۆنتێنەر
            </h2>
            <p className="mt-1 text-sm text-slate-400">ژمارەی کۆنتێنەر بنووسە بۆ پاشەکەوتکردن.</p>
            <form onSubmit={onAdd} className="mt-5 space-y-4">
              <label className="block text-start">
                <span className="mb-2 block text-sm font-medium text-slate-200">ژمارەی کۆنتێنەر</span>
                <input
                  value={containerNumber}
                  onChange={(event) => setContainerNumber(event.target.value)}
                  placeholder="نموونە: MSCU1234567"
                  autoFocus
                  autoComplete="off"
                  className="admin-field h-12 w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 text-start text-white caret-white outline-none placeholder:text-slate-400 focus:border-teal-400"
                />
              </label>
              {addError ? (
                <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {addError}
                </p>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addPending}
                  className="h-12 flex-1 rounded-2xl bg-teal-500 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  {addPending ? "خەریکە پاشەکەوت دەکرێت..." : "پاشەکەوتکردن"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="h-12 rounded-2xl border border-white/10 px-4 text-sm font-semibold text-slate-200"
                >
                  هەڵوەشاندنەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
