"use client";

import { useState, useEffect, useCallback } from "react";
import { Session, Student } from "@/lib/types";
import { fetchWeeklySchedule, updateWeeklyScheduleDay } from "@/lib/actions";
import { DAY_LABELS, DAY_SHORT, DAYS } from "@/lib/weekly-program-shared";

interface Props {
  schoolId: string;
  sessions: Session[];
  students: Student[];
  onRefresh: () => void;
}

export default function WeeklySchedule({ schoolId, sessions, students, onRefresh }: Props) {
  const todayIndex = new Date().getDay();
  const defaultDay = todayIndex >= 1 && todayIndex <= 5 ? String(todayIndex) : "1";

  const [selectedDay, setSelectedDay] = useState(defaultDay);
  const [schedule, setSchedule] = useState<{ [day: string]: { [sessionId: string]: string[] } }>({});
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editStudentIds, setEditStudentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadSchedule = useCallback(async () => {
    const data = await fetchWeeklySchedule(schoolId);
    setSchedule(data);
  }, [schoolId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  function getStudentsForSession(day: string, sessionId: string): string[] {
    return schedule[day]?.[sessionId] ?? sessions.find((s) => s.id === sessionId)?.studentIds ?? [];
  }

  function startEdit(sessionId: string) {
    const current = getStudentsForSession(selectedDay, sessionId);
    setEditStudentIds([...current]);
    setEditingSession(sessionId);
    setMsg(null);
  }

  function cancelEdit() {
    setEditingSession(null);
    setEditStudentIds([]);
  }

  function toggleStudent(studentId: string) {
    setEditStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  }

  async function handleSave() {
    if (!editingSession) return;
    setSaving(true);
    await updateWeeklyScheduleDay(schoolId, selectedDay, editingSession, editStudentIds);
    await loadSchedule();
    setEditingSession(null);
    setEditStudentIds([]);
    setSaving(false);
    setMsg({ type: "success", text: `${DAY_LABELS[selectedDay]} programı kaydedildi.` });
    onRefresh();
  }

  async function copyToOtherDays() {
    if (!editingSession) return;
    setSaving(true);
    for (const day of DAYS) {
      await updateWeeklyScheduleDay(schoolId, day, editingSession, editStudentIds);
    }
    await loadSchedule();
    setEditingSession(null);
    setEditStudentIds([]);
    setSaving(false);
    setMsg({ type: "success", text: "Tüm günlere kopyalandı." });
    onRefresh();
  }

  function getStudentName(id: string): string {
    return students.find((s) => s.id === id)?.name ?? "?";
  }

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-500 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Haftalık Program</h2>
          <p className="text-xs text-gray-500 mt-0.5">Her gün hangi öğrenci hangi seansta olacak</p>
        </div>
      </div>

      {/* Day tabs — mobilde yatay kaydırma */}
      <div className="flex overflow-x-auto overscroll-x-contain snap-x snap-mandatory gap-1 p-1 bg-dark-700 rounded-xl mb-5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        {DAYS.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => { setSelectedDay(day); cancelEdit(); setMsg(null); }}
            className={`shrink-0 snap-start min-w-[4.5rem] sm:min-w-0 sm:flex-1 py-2.5 px-1 sm:px-0 text-xs sm:text-sm font-medium rounded-lg transition ${
              selectedDay === day
                ? "bg-accent text-dark-900"
                : "text-gray-400 hover:text-white hover:bg-dark-600"
            } ${String(todayIndex) === day ? "ring-1 ring-accent/30" : ""}`}
          >
            <span className="hidden sm:inline">{DAY_LABELS[day]}</span>
            <span className="sm:hidden">{DAY_SHORT[day]}</span>
            {String(todayIndex) === day && (
              <span className="block sm:inline sm:ml-1 text-[9px] sm:text-[10px] opacity-60 leading-tight">bugün</span>
            )}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`rounded-xl p-3 mb-4 text-sm text-center ${
          msg.type === "success"
            ? "bg-green-500/10 text-green-400 border border-green-500/20"
            : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {msg.text}
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          Henüz seans tanımlanmadı. Önce &quot;Seanslar&quot; sekmesinden seans ekleyin.
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const sessionStudents = getStudentsForSession(selectedDay, session.id);
            const isEditing = editingSession === session.id;

            return (
              <div
                key={session.id}
                className={`rounded-xl border transition ${
                  isEditing
                    ? "bg-dark-600 border-accent/30"
                    : "bg-dark-700 border-dark-500"
                }`}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-accent/10 text-accent">
                      <span className="text-xs font-bold">{session.time.slice(0, 5)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{session.label}</p>
                      <p className="text-xs text-gray-500">
                        {sessionStudents.length} öğrenci
                      </p>
                    </div>
                  </div>

                  {!isEditing ? (
                    <button
                      onClick={() => startEdit(session.id)}
                      className="px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg transition"
                    >
                      Düzenle
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white border border-dark-400 rounded-lg transition"
                      >
                        İptal
                      </button>
                      <button
                        onClick={copyToOtherDays}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition disabled:opacity-50"
                        title="Bu listeyi haftanın tüm günlerine kopyala"
                      >
                        Tümüne
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs font-medium text-dark-900 bg-accent hover:bg-accent-hover rounded-lg transition disabled:opacity-50"
                      >
                        {saving ? "..." : "Kaydet"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Student list / edit */}
                {isEditing ? (
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">{editStudentIds.length} öğrenci seçili</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditStudentIds(students.map((s) => s.id))}
                          className="text-xs text-accent hover:underline"
                        >
                          Hepsini Seç
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditStudentIds([])}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          Temizle
                        </button>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-dark-400 rounded-xl divide-y divide-dark-500">
                      {students.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-dark-500 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={editStudentIds.includes(s.id)}
                            onChange={() => toggleStudent(s.id)}
                            className="w-4 h-4 rounded border-dark-400 bg-dark-600 text-accent focus:ring-accent"
                          />
                          <span className="text-sm text-white">{s.name}</span>
                          <span className="text-xs text-gray-600 ml-auto">{s.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : sessionStudents.length > 0 ? (
                  <div className="px-4 pb-3">
                    <div className="flex flex-wrap gap-1.5">
                      {sessionStudents.map((id) => (
                        <span
                          key={id}
                          className="px-2 py-0.5 text-xs bg-dark-600 text-gray-300 rounded-md border border-dark-400"
                        >
                          {getStudentName(id)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-gray-600 italic">Bu gün için öğrenci atanmadı</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
