"use client";

import { useState, useEffect } from "react";
import { Session } from "@/lib/types";
import { createSession, editSession, removeSession, fetchClassDuration, updateClassDuration } from "@/lib/actions";

interface Props {
  schoolId: string;
  sessions: Session[];
  onRefresh: () => void;
}

export default function SessionManagement({ schoolId, sessions, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [classDuration, setClassDuration] = useState(40);
  const [durationSaving, setDurationSaving] = useState(false);

  useEffect(() => {
    fetchClassDuration(schoolId).then(setClassDuration);
  }, []);

  function resetForm() {
    setLabel("");
    setTime("");
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  function startEdit(session: Session) {
    setLabel(session.label);
    setTime(session.time);
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
      const result = await editSession(schoolId, editingId, { label: label.trim(), time: time.trim() });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
    } else {
      await createSession(schoolId, { label: label.trim(), time: time.trim(), studentIds: [] });
    }

    resetForm();
    setLoading(false);
    onRefresh();
  }

  async function handleDelete(id: string) {
    await removeSession(schoolId, id);
    onRefresh();
  }

  async function handleDurationChange(val: number) {
    const clamped = Math.max(1, Math.min(120, val));
    setClassDuration(clamped);
    setDurationSaving(true);
    await updateClassDuration(schoolId, clamped);
    setDurationSaving(false);
  }

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-500 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Ders Saatleri</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-dark-900 bg-accent hover:bg-accent-hover rounded-xl transition"
          >
            + Ders Saati Ekle
          </button>
        )}
      </div>

      {/* Ders süresi ayarı */}
      <div className="mb-5 p-3 bg-dark-700 rounded-xl border border-dark-400 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">Ders Süresi</p>
          <p className="text-xs text-gray-600">Çıkış saati = ders başlangıcı + bu süre</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={classDuration}
            onChange={(e) => handleDurationChange(parseInt(e.target.value) || 40)}
            min={1}
            max={120}
            className="w-16 rounded-lg border border-dark-400 bg-dark-600 px-2 py-1.5 text-sm text-white text-center focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          />
          <span className="text-sm text-gray-400">dk</span>
          {durationSaving && <span className="text-xs text-gray-600">...</span>}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-dark-700 rounded-xl border border-dark-400 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Etiket</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="örn. 09:00 Dersi"
                className="w-full rounded-xl border border-dark-400 bg-dark-600 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Ders Başlangıç Saati</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-dark-400 bg-dark-600 px-3 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>
          </div>

          <p className="text-xs text-gray-600">Öğrencileri &quot;Program&quot; sayfasından ders saatlerine atayabilirsiniz.</p>

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
          Henüz ders saati tanımlanmadı. Saatlerinize göre ders saatleri ekleyin.
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-dark-700 border border-dark-500 rounded-xl p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-accent/10 text-accent">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{session.label}</p>
                  <p className="text-xs text-gray-500">
                    Başlangıç: {session.time} • {session.studentIds.length} öğrenci
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
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
