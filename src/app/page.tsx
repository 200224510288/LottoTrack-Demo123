"use client";

import { useEffect, useState } from "react";

interface Item {
  id: string;
  value: string;
}

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load items from backend
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/items");
        const data = await res.json();
        setItems(data.items ?? []);
      } catch (err) {
        setError("Failed to load items");
      } finally {
        setLoadingList(false);
      }
    };
    load();
  }, []);

  // Add item
  const addItem = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: input }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setItems((prev) => [...prev, { id: data.id, value: data.value }]);
      setInput("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err) || "Could not add");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-semibold text-center mb-4">
          Next.js + Firebase Input List
        </h1>

        <div className="flex gap-2 mb-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm"
            placeholder="Type something..."
          />
          <button
            onClick={addItem}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-sm hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "..." : "Add"}
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-xs mb-3 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <h2 className="text-sm font-semibold mb-2">Stored Values</h2>

        <div className="bg-slate-900/60 rounded-xl border border-slate-800 max-h-64 overflow-y-auto">
          {loadingList ? (
            <p className="text-center text-xs text-slate-400 py-6">
              Loading...
            </p>
          ) : items.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">
              No items yet
            </p>
          ) : (
            <ul className="divide-y divide-slate-800 text-sm">
              {items.map((item) => (
                <li key={item.id} className="px-3 py-2">
                  {item.value}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
