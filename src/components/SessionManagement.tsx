"use client";

import { useState } from "react";
import { Session } from "@/lib/types";
import { createSession, editSession, removeSession } from "@/lib/actions";

interface Props {
  sessions: Session[];
  onRefresh: () => void;
}

export default function SessionManagement({ sessions, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState<"pickup" | "dropoff">("pickup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setLabel("");
    setTime("");
    setType("pickup");
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  function startEdit(session: Session) {
    setLabel(session.label);
    setTime(session.time);
    setType(session.type);
    setEditingId(session.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !time.trim()) {
      setError("Etiket ve saat zorunludur.");
      return;
    }
    setLoading(true);
    setError("");

    if (editingId) {
      const result = await editSession(editingId, { label: label.trim(), time: time.trim(), type });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
    } else {
      await createSession({ label: label.trim(), time: time.trim(), type, studentIds: [] });
    }

    resetForm();
    setLoading(false);
    onRefresh();
  }

  async function handleDelete(id: string) {
    await removeSession(id);
    onRefresh();
  }

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Seanslar</h2>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 text-sm font-medium text-dark-900 bg-accent hover:bg-accent-hover rounded-xl transition"
          >
            + Seans Ekle
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-dark-700 rounded-xl border border-dark-400 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Etiket</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="örn. 09:00 Giriş"
                className="w-full rounded-xl border border-dark-400 bg-dark-600 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Saat</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-dark-400 bg-dark-600 px-3 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Yön</label>
            <div className="flex bg-dark-600 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setType("pickup")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                  type === "pickup" ? "bg-accent text-dark-900" : "text-gray-400 hover:text-white"
                }`}
              >
                Evlerden Okula
              </button>
              <button
                type="button"
                onClick={() => setType("dropoff")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                  type === "dropoff" ? "bg-accent text-dark-900" : "text-gray-400 hover:text-white"
                }`}
              >
                Okuldan Evlere
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-600">Öğrencileri &quot;Program&quot; sayfasından seanslara atayabilirsiniz.</p>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 border border-dark-400 text-gray-400 hover:bg-dark-600 font-medium py-2.5 rounded-xl text-sm transition"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-dark-900 font-semibold py-2.5 rounded-xl text-sm transition"
            >
              {loading ? "Kaydediliyor..." : editingId ? "Güncelle" : "Ekle"}
            </button>
          </div>
        </form>
      )}

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          Henüz seans tanımlanmadı. Saatlerinize göre seanslar ekleyin.
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between bg-dark-700 border border-dark-500 rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  session.type === "pickup" ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"
                }`}>
                  {session.type === "pickup" ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{session.label}</p>
                  <p className="text-xs text-gray-500">
                    {session.type === "pickup" ? "Evlerden Okula" : "Okuldan Evlere"} • {session.studentIds.length} öğrenci
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => startEdit(session)}
                  className="p-2 text-gray-500 hover:text-accent hover:bg-accent/10 rounded-lg transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(session.id)}
                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
