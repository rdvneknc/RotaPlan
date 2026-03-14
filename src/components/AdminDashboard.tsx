"use client";

import { useState, useEffect, useCallback } from "react";
import { Student, SchoolInfo, Vehicle } from "@/lib/types";
import { fetchStudents, fetchVehicles } from "@/lib/actions";
import SchoolSettings from "./SchoolSettings";
import StudentManagement from "./StudentManagement";
import DailyListEditor from "./DailyListEditor";
import VehicleManagement from "./VehicleManagement";

interface Props {
  initialStudents: Student[];
  initialSchool: SchoolInfo;
  initialVehicles: Vehicle[];
}

export default function AdminDashboard({ initialStudents, initialSchool, initialVehicles }: Props) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [activeTab, setActiveTab] = useState<"daily" | "students" | "vehicles" | "school">("daily");

  const refresh = useCallback(async () => {
    const [s, v] = await Promise.all([fetchStudents(), fetchVehicles()]);
    setStudents(s);
    setVehicles(v);
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const activeCount = students.filter((s) => s.isActive).length;

  const tabs = [
    { id: "daily" as const, label: "Günlük Liste", count: activeCount },
    { id: "students" as const, label: "Öğrenciler", count: students.length },
    { id: "vehicles" as const, label: "Araçlar", count: vehicles.length },
    { id: "school" as const, label: "Okul", count: null },
  ];

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Stat kartları */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-5 text-center">
          <p className="text-3xl font-bold text-white">{students.length}</p>
          <p className="text-xs text-gray-500 mt-1">Toplam Öğrenci</p>
        </div>
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-5 text-center">
          <p className="text-3xl font-bold text-accent">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-1">Bugün Aktif</p>
        </div>
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-5 text-center">
          <p className="text-3xl font-bold text-white">{vehicles.length}</p>
          <p className="text-xs text-gray-500 mt-1">Araç</p>
        </div>
      </div>

      {/* Tab navigasyon */}
      <div className="flex bg-dark-800 rounded-2xl border border-dark-500 p-1.5 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-medium rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? "bg-accent text-dark-900"
                : "text-gray-400 hover:text-white hover:bg-dark-600"
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span
                className={`inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-xs font-bold px-1 ${
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
        <DailyListEditor students={students} vehicles={vehicles} onRefresh={refresh} />
      )}

      {activeTab === "students" && (
        <StudentManagement students={students} vehicles={vehicles} onRefresh={refresh} />
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
