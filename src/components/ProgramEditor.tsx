"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Session, Student } from "@/lib/types";
import {
  fetchWeeklySchedule,
  updateWeeklyScheduleDay,
  fetchStudents,
  fetchSessions,
} from "@/lib/actions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DAY_LABELS: { [key: string]: string } = {
  "1": "Pazartesi",
  "2": "Salı",
  "3": "Çarşamba",
  "4": "Perşembe",
  "5": "Cuma",
};

const DAYS = ["1", "2", "3", "4", "5"];

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
  initialSessions: Session[];
  initialStudents: Student[];
}

export default function ProgramEditor({ initialSessions, initialStudents }: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [schedule, setSchedule] = useState<{ [day: string]: { [sessionId: string]: string[] } }>({});
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date().getDay();
    return today >= 1 && today <= 5 ? String(today) : "1";
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    const [sched, studs, sess] = await Promise.all([
      fetchWeeklySchedule(),
      fetchStudents(),
      fetchSessions(),
    ]);
    setSchedule(sched);
    setStudents(studs);
    setSessions(sess);
  }, []);

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
      await updateWeeklyScheduleDay(selectedDay, session.id, studentIds);
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
        await updateWeeklyScheduleDay(day, session.id, studentIds);
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
        await updateWeeklyScheduleDay(day, session.id, []);
      }
    }
    await loadData();
    setHasChanges(false);
    setSaving(false);
    setMsg({ type: "success", text: "Tüm program temizlendi." });
  }

  async function loadTurkishFont(doc: jsPDF) {
    const [regularRes, boldRes] = await Promise.all([
      fetch("/fonts/Roboto-Regular.ttf"),
      fetch("/fonts/Roboto-Bold.ttf"),
    ]);
    const [regularBuf, boldBuf] = await Promise.all([
      regularRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ]);

    const toBase64 = (buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    };

    doc.addFileToVFS("Roboto-Regular.ttf", toBase64(regularBuf));
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", toBase64(boldBuf));
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto");
  }

  function renderDayToPdf(doc: jsPDF, day: string, startY: number): number {
    const dayLabel = DAY_LABELS[day];
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const targetDayOfWeek = parseInt(day);
    const diff = targetDayOfWeek - currentDayOfWeek;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);
    const dateStr = targetDate.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

    doc.setFont("Roboto", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(`Servis Programi - ${dayLabel}`, 14, startY);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(dateStr, 14, startY + 6);
    doc.setTextColor(0);

    let y = startY + 13;

    for (const session of sessions) {
      const ids = getStudentsForSession(day, session.id);
      if (ids.length === 0) continue;

      const typeLabel = session.type === "pickup" ? "GIRIS" : "CIKIS";
      const headerColor: [number, number, number] = session.type === "pickup" ? [34, 197, 94] : [59, 130, 246];

      const rows = ids.map((id, idx) => {
        const s = getStudent(id);
        if (!s) return [String(idx + 1), "?", "", "", "", "", ""];
        return [
          String(idx + 1),
          s.name,
          s.label,
          s.contact1Name || "-",
          s.contact1Phone || "-",
          s.contact2Name || "-",
          s.contact2Phone || "-",
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [[
          { content: `${session.time} ${typeLabel} - ${session.label}  (${ids.length} ogrenci)`, colSpan: 7, styles: { fillColor: headerColor, textColor: 255, fontStyle: "bold", fontSize: 9, font: "Roboto" } },
        ]],
        body: [],
        theme: "grid",
        margin: { left: 14, right: 14 },
        styles: { font: "Roboto" },
      });

      const afterHeader = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      autoTable(doc, {
        startY: afterHeader,
        head: [["#", "Ad-Soyad", "Konum", "Irtibat 1", "Telefon 1", "Irtibat 2", "Telefon 2"]],
        body: rows,
        theme: "grid",
        styles: { font: "Roboto", fontSize: 8 },
        headStyles: { fillColor: [55, 55, 65], textColor: 200, fontSize: 8, font: "Roboto", fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: 40, font: "Roboto" },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 45 },
          2: { cellWidth: 40 },
          3: { cellWidth: 35 },
          4: { cellWidth: 30 },
          5: { cellWidth: 35 },
          6: { cellWidth: 30 },
        },
        margin: { left: 14, right: 14 },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

      if (y > 180) {
        doc.addPage();
        y = 15;
      }
    }

    return y;
  }

  async function exportDayPdf(day: string) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    await loadTurkishFont(doc);
    renderDayToPdf(doc, day, 15);
    doc.save(`program_${DAY_LABELS[day].toLowerCase()}.pdf`);
  }

  async function exportFullWeekPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    await loadTurkishFont(doc);
    let isFirstPage = true;

    for (const day of DAYS) {
      const hasSessions = sessions.some((s) => getStudentsForSession(day, s.id).length > 0);
      if (!hasSessions) continue;

      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      renderDayToPdf(doc, day, 15);
    }

    doc.save("program_haftalik.pdf");
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
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => exportDayPdf(selectedDay)}
            className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white bg-dark-800 hover:bg-dark-700 border border-dark-500 rounded-xl transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Günü İndir
          </button>
          <button
            onClick={exportFullWeekPdf}
            className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white bg-dark-800 hover:bg-dark-700 border border-dark-500 rounded-xl transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Haftayı İndir
          </button>
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
            const isPickup = session.type === "pickup";

            return (
              <div key={session.id} className="bg-dark-800 rounded-2xl border border-dark-500 overflow-hidden">
                {/* Session header */}
                <div className={`px-5 py-3 flex items-center justify-between border-b ${
                  isPickup
                    ? "bg-green-500/5 border-green-500/10"
                    : "bg-blue-500/5 border-blue-500/10"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-lg text-sm font-bold ${
                      isPickup ? "bg-green-500/15 text-green-400" : "bg-blue-500/15 text-blue-400"
                    }`}>
                      {session.time}
                    </div>
                    <span className={`text-sm font-medium ${isPickup ? "text-green-400" : "text-blue-400"}`}>
                      {isPickup ? "GİRİŞ" : "ÇIKIŞ"}
                    </span>
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
