"use client";

import { useState, useEffect, useCallback } from "react";
import { Student, SchoolInfo, Vehicle, Session } from "@/lib/types";
import { fetchStudents, fetchVehicles, fetchSessions } from "@/lib/actions";
import SchoolSettings from "./SchoolSettings";
import StudentManagement from "./StudentManagement";
import DailyListEditor from "./DailyListEditor";
import VehicleManagement from "./VehicleManagement";
import SessionManagement from "./SessionManagement";
import Link from "next/link";

interface Props {
  initialStudents: Student[];
  initialSchool: SchoolInfo;
  initialVehicles: Vehicle[];
  initialSessions: Session[];
}

export default function AdminDashboard({ initialStudents, initialSchool, initialVehicles, initialSessions }: Props) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [activeTab, setActiveTab] = useState<"daily" | "program" | "students" | "sessions" | "vehicles" | "school">("daily");

  const refresh = useCallback(async () => {
    const [s, v, ses] = await Promise.all([fetchStudents(), fetchVehicles(), fetchSessions()]);
    setStudents(s);
    setVehicles(v);
    setSessions(ses);
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const activeCount = students.filter((s) => s.isActive).length;

  const tabs = [
    { id: "daily" as const, label: "Günlük Liste", count: activeCount },
    { id: "program" as const, label: "Program", count: null },
    { id: "students" as const, label: "Öğrenciler", count: students.length },
    { id: "sessions" as const, label: "Seanslar", count: sessions.length },
    { id: "vehicles" as const, label: "Araçlar", count: vehicles.length },
    { id: "school" as const, label: "Okul", count: null },
  ];

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Stat kartları */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-4 text-center">
          <p className="text-2xl font-bold text-white">{students.length}</p>
          <p className="text-xs text-gray-500 mt-1">Öğrenci</p>
        </div>
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-4 text-center">
          <p className="text-2xl font-bold text-accent">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-1">Aktif</p>
        </div>
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-4 text-center">
          <p className="text-2xl font-bold text-white">{sessions.length}</p>
          <p className="text-xs text-gray-500 mt-1">Seans</p>
        </div>
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-4 text-center">
          <p className="text-2xl font-bold text-white">{vehicles.length}</p>
          <p className="text-xs text-gray-500 mt-1">Araç</p>
        </div>
      </div>

      {/* Tab navigasyon */}
      <div className="flex bg-dark-800 rounded-2xl border border-dark-500 p-1.5 gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition flex items-center justify-center gap-1 whitespace-nowrap min-w-0 ${
              activeTab === tab.id
                ? "bg-accent text-dark-900"
                : "text-gray-400 hover:text-white hover:bg-dark-600"
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full text-xs font-bold px-1 ${
                  activeTab === tab.id
                    ? "bg-dark-900/20 text-dark-900"
                    : "bg-dark-600 text-gray-400"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "daily" && (
        <DailyListEditor students={students} vehicles={vehicles} sessions={sessions} onRefresh={refresh} />
      )}

      {activeTab === "program" && (
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
          <h2 className="text-base font-semibold text-white mb-2">Haftalık Program</h2>
          <p className="text-sm text-gray-500 mb-5">
            Haftalık programı geniş tablo görünümünde düzenleyin. Her gün için hangi öğrencinin hangi seansta olacağını belirleyin.
          </p>
          <Link
            href="/admin/program"
            className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover rounded-xl transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Programı Düzenle
          </Link>
        </div>
      )}

      {activeTab === "students" && (
        <StudentManagement students={students} vehicles={vehicles} sessions={sessions} onRefresh={refresh} />
      )}

      {activeTab === "sessions" && (
        <SessionManagement sessions={sessions} onRefresh={refresh} />
      )}

      {activeTab === "vehicles" && (
        <VehicleManagement vehicles={vehicles} onRefresh={refresh} />
      )}

      {activeTab === "school" && (
        <SchoolSettings initialSchool={initialSchool} />
      )}
    </main>
  );
}
