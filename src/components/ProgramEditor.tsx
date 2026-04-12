"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Session, Student } from "@/lib/types";
import {
  fetchWeeklySchedule,
  updateWeeklyScheduleDay,
  fetchStudents,
  fetchSessions,
  pushWeeklyProgramToGoogleSheets,
  pullWeeklyProgramFromGoogleSheets,
} from "@/lib/actions";
import { DAY_LABELS, DAYS } from "@/lib/weekly-program-shared";

function StudentSearchDropdown({
  available,
  onSelect,
}: {
  available: Student[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = available.filter((s) => {
    const q = query.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.label.toLowerCase().includes(q);
  });

  return (
    <div ref={ref} className="relative">
      <div
        className="flex items-center rounded-lg border border-dark-400 bg-dark-700 overflow-hidden min-w-[260px] cursor-text"
        onClick={() => setOpen(true)}
      >
        <svg className="w-4 h-4 text-gray-500 ml-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Öğrenci ara ve ekle..."
          className="w-full bg-transparent px-2 py-1.5 text-sm text-white placeholder-gray-600 outline-none"
        />
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-full min-w-[300px] bg-dark-700 border border-dark-400 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-600 p-3 text-center">
              {query ? "Sonuç bulunamadı" : "Tüm öğrenciler ekli"}
            </p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelect(s.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-dark-600 transition flex items-center justify-between gap-3"
              >
                <span className="text-sm text-white">{s.name}</span>
                <span className="text-xs text-gray-500 shrink-0">{s.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  schoolId: string;
  initialSessions: Session[];
  initialStudents: Student[];
  googleSheetId?: string | null;
  googleSheetsConfigured?: boolean;
}

export default function ProgramEditor({
  schoolId,
  initialSessions,
  initialStudents,
  googleSheetId = null,
  googleSheetsConfigured = false,
}: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [schedule, setSchedule] = useState<{ [day: string]: { [sessionId: string]: string[] } }>({});
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date().getDay();
    return String(today);
  });
  const [saving, setSaving] = useState(false);
  const [sheetsBusy, setSheetsBusy] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    const [sched, studs, sess] = await Promise.all([
      fetchWeeklySchedule(schoolId),
      fetchStudents(schoolId),
      fetchSessions(schoolId),
    ]);
    setSchedule(sched);
    setStudents(studs);
    setSessions(sess);
  }, [schoolId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getStudentsForSession(day: string, sessionId: string): string[] {
    return schedule[day]?.[sessionId] ?? sessions.find((s) => s.id === sessionId)?.studentIds ?? [];
  }

  function getStudent(id: string): Student | undefined {
    return students.find((s) => s.id === id);
  }

  function addStudentToSession(sessionId: string, studentId: string) {
    setSchedule((prev) => {
      const dayData = prev[selectedDay] || {};
      const current = dayData[sessionId] ?? sessions.find((s) => s.id === sessionId)?.studentIds ?? [];
      if (current.includes(studentId)) return prev;
      return {
        ...prev,
        [selectedDay]: {
          ...dayData,
          [sessionId]: [...current, studentId],
        },
      };
    });
    setHasChanges(true);
    setMsg(null);
  }

  function removeStudentFromSession(sessionId: string, studentId: string) {
    setSchedule((prev) => {
      const dayData = prev[selectedDay] || {};
      const current = dayData[sessionId] ?? sessions.find((s) => s.id === sessionId)?.studentIds ?? [];
      return {
        ...prev,
        [selectedDay]: {
          ...dayData,
          [sessionId]: current.filter((id) => id !== studentId),
        },
      };
    });
    setHasChanges(true);
    setMsg(null);
  }

  async function handleSave() {
    setSaving(true);
    const dayData = schedule[selectedDay] || {};
    for (const session of sessions) {
      const studentIds = dayData[session.id] ?? session.studentIds;
      await updateWeeklyScheduleDay(schoolId, selectedDay, session.id, studentIds);
    }
    setHasChanges(false);
    setSaving(false);
    setMsg({ type: "success", text: `${DAY_LABELS[selectedDay]} programı kaydedildi.` });
  }

  async function handleCopyToAll() {
    setSaving(true);
    const dayData = schedule[selectedDay] || {};
    for (const day of DAYS) {
      for (const session of sessions) {
        const studentIds = dayData[session.id] ?? session.studentIds;
        await updateWeeklyScheduleDay(schoolId, day, session.id, studentIds);
      }
    }
    await loadData();
    setHasChanges(false);
    setSaving(false);
    setMsg({ type: "success", text: "Program tüm günlere kopyalandı." });
  }

  function clearDay() {
    setSchedule((prev) => {
      const dayData: { [sessionId: string]: string[] } = {};
      for (const session of sessions) {
        dayData[session.id] = [];
      }
      return { ...prev, [selectedDay]: dayData };
    });
    setHasChanges(true);
    setMsg(null);
  }

  async function clearAllDays() {
    setSaving(true);
    for (const day of DAYS) {
      for (const session of sessions) {
        await updateWeeklyScheduleDay(schoolId, day, session.id, []);
      }
    }
    await loadData();
    setHasChanges(false);
    setSaving(false);
    setMsg({ type: "success", text: "Tüm program temizlendi." });
  }

  async function handlePushSheets() {
    setSheetsBusy(true);
    setMsg(null);
    const res = await pushWeeklyProgramToGoogleSheets(schoolId);
    setSheetsBusy(false);
    if ("error" in res && res.error) {
      setMsg({ type: "error", text: res.error });
      return;
    }
    setMsg({ type: "success", text: "Program Google Sheets’e yazıldı (Haftalık Program sekmesi)." });
  }

  async function handlePullSheets() {
    if (!confirm("Sheets’teki tablo ile bu okulun haftalık programı tamamen güncellenecek. Devam edilsin mi?")) return;
    setSheetsBusy(true);
    setMsg(null);
    const res = await pullWeeklyProgramFromGoogleSheets(schoolId);
    setSheetsBusy(false);
    if ("error" in res && res.error) {
      const extra =
        "warnings" in res && res.warnings?.length
          ? ` — ${res.warnings.slice(0, 8).join(" ")}`
          : "";
      setMsg({ type: "error", text: res.error + extra });
      return;
    }
    await loadData();
    setHasChanges(false);
    const w =
      "warnings" in res && res.warnings && res.warnings.length > 0
        ? ` ${res.warnings.length} uyarı (eşleşmeyen isim).`
        : "";
    setMsg({ type: "success", text: `Sheets’ten program alındı.${w}` });
  }

  function getAvailableStudents(sessionId: string): Student[] {
    const assigned = getStudentsForSession(selectedDay, sessionId);
    return students.filter((s) => !assigned.includes(s.id));
  }

  const todayIndex = new Date().getDay();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Haftalık Program</h1>
          <p className="text-sm text-gray-500 mt-1">Her gün için seansları ve öğrencileri düzenleyin</p>
          {!googleSheetId && (
            <p className="text-xs text-gray-600 mt-2">
              Google Sheets: Admin → Okul sekmesinde dosya linkini kaydedin.
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {googleSheetId ? (
            <>
              <button
                type="button"
                onClick={() => void handlePushSheets()}
                disabled={saving || sheetsBusy || !googleSheetsConfigured}
                title={!googleSheetsConfigured ? "Sunucuda GOOGLE_SERVICE_ACCOUNT_JSON gerekli" : undefined}
                className="px-4 py-2.5 text-sm font-medium text-sky-200/90 bg-sky-600/15 hover:bg-sky-600/25 border border-sky-500/30 rounded-xl transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 8v8m0 0l-3-3m3 3l3-3M12 3v3" />
                </svg>
                {sheetsBusy ? "Sheets…" : "Sheets'e gönder"}
              </button>
              <button
                type="button"
                onClick={() => void handlePullSheets()}
                disabled={saving || sheetsBusy || !googleSheetsConfigured}
                title={!googleSheetsConfigured ? "Sunucuda GOOGLE_SERVICE_ACCOUNT_JSON gerekli" : undefined}
                className="px-4 py-2.5 text-sm font-medium text-sky-200/90 bg-sky-600/15 hover:bg-sky-600/25 border border-sky-500/30 rounded-xl transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {sheetsBusy ? "Sheets…" : "Sheets'ten al"}
              </button>
            </>
          ) : null}
          <button
            onClick={clearDay}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-red-400 bg-dark-800 hover:bg-red-500/10 border border-dark-500 hover:border-red-500/20 rounded-xl transition disabled:opacity-50"
          >
            Günü Temizle
          </button>
          <button
            onClick={() => {
              if (confirm("Tüm haftanın programı silinecek. Emin misiniz?")) {
                clearAllDays();
              }
            }}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-red-400 bg-dark-800 hover:bg-red-500/10 border border-dark-500 hover:border-red-500/20 rounded-xl transition disabled:opacity-50"
          >
            Tümünü Temizle
          </button>
          {hasChanges && (
            <button
              onClick={handleCopyToAll}
              disabled={saving}
              className="px-4 py-2.5 text-sm font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition disabled:opacity-50"
            >
              Tüm Günlere Kopyala
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-5 py-2.5 text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-xl transition"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      {/* Day tabs */}
      <div className="flex bg-dark-800 rounded-xl border border-dark-500 p-1.5 gap-1">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => { setSelectedDay(day); setMsg(null); }}
            className={`flex-1 py-3 text-sm font-medium rounded-lg transition ${
              selectedDay === day
                ? "bg-accent text-dark-900"
                : "text-gray-400 hover:text-white hover:bg-dark-700"
            } ${String(todayIndex) === day && selectedDay !== day ? "ring-1 ring-accent/30" : ""}`}
          >
            {DAY_LABELS[day]}
            {String(todayIndex) === day && (
              <span className="ml-1.5 text-[10px] opacity-60">bugün</span>
            )}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`rounded-xl p-3 text-sm text-center ${
          msg.type === "success"
            ? "bg-green-500/10 text-green-400 border border-green-500/20"
            : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {msg.text}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-12 text-center">
          <p className="text-gray-400">Henüz seans tanımlanmadı.</p>
          <p className="text-sm text-gray-600 mt-1">Admin panelinden seans ekleyin.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sessions.map((session) => {
            const sessionStudents = getStudentsForSession(selectedDay, session.id);
            const available = getAvailableStudents(session.id);

            return (
              <div key={session.id} className="bg-dark-800 rounded-2xl border border-dark-500 overflow-hidden">
                {/* Session header */}
                <div className="px-5 py-3 flex items-center justify-between border-b bg-accent/5 border-accent/10">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 rounded-lg text-sm font-bold bg-accent/15 text-accent">
                      {session.time}
                    </div>
                    <span className="text-xs text-gray-500">
                      {session.label} • {sessionStudents.length} öğrenci
                    </span>
                  </div>
                  {available.length > 0 && (
                    <StudentSearchDropdown
                      available={available}
                      onSelect={(id) => addStudentToSession(session.id, id)}
                    />
                  )}
                </div>

                {/* Table */}
                {sessionStudents.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-dark-500">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">#</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad-Soyad</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konum</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İrtibat 1</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon 1</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İrtibat 2</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon 2</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-600">
                        {sessionStudents.map((studentId, idx) => {
                          const student = getStudent(studentId);
                          if (!student) return null;
                          return (
                            <tr key={studentId} className="hover:bg-dark-700/50 transition">
                              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{idx + 1}</td>
                              <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{student.name}</td>
                              <td className="px-4 py-3">
                                <a
                                  href={student.mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-accent hover:underline text-xs truncate block max-w-[200px]"
                                  title={student.mapsUrl}
                                >
                                  {student.label}
                                </a>
                              </td>
                              <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{student.contact1Name || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {student.contact1Phone ? (
                                  <a href={`tel:${student.contact1Phone.replace(/\s/g, "")}`} className="text-accent hover:underline">
                                    {student.contact1Phone}
                                  </a>
                                ) : (
                                  <span className="text-gray-600">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{student.contact2Name || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {student.contact2Phone ? (
                                  <a href={`tel:${student.contact2Phone.replace(/\s/g, "")}`} className="text-accent hover:underline">
                                    {student.contact2Phone}
                                  </a>
                                ) : (
                                  <span className="text-gray-600">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => removeStudentFromSession(session.id, studentId)}
                                  className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                                  title="Kaldır"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 py-6 text-center">
                    <p className="text-sm text-gray-600 italic">Bu seans için öğrenci eklenmedi</p>
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
