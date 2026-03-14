"use client";

import { useState, useEffect, useCallback } from "react";
import { Student, Vehicle } from "@/lib/types";
import { fetchStudentsByVehicle } from "@/lib/actions";
import RouteButton from "./RouteButton";

interface Props {
  initialStudents: Student[];
  vehicle: Vehicle;
}

export default function DriverDashboard({ initialStudents, vehicle }: Props) {
  const [students, setStudents] = useState<Student[]>(initialStudents);

  const refresh = useCallback(async () => {
    const data = await fetchStudentsByVehicle(vehicle.id);
    setStudents(data);
  }, [vehicle.id]);

  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const activeStudents = students.filter((s) => s.isActive);

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Araç bilgisi */}
      <div className="bg-dark-800 rounded-2xl border border-dark-500 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <div>
            <p className="text-base font-medium text-white">{vehicle.driverName}</p>
            <p className="text-sm text-gray-500">{vehicle.plate} • Kapasite: {vehicle.capacity}</p>
          </div>
        </div>
      </div>

      {/* Bugünün özeti */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-5 text-center">
          <p className="text-3xl font-bold text-accent">{activeStudents.length}</p>
          <p className="text-xs text-gray-500 mt-1">Bugünkü Öğrenci</p>
        </div>
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-5 text-center">
          <p className="text-3xl font-bold text-white">{vehicle.capacity}</p>
          <p className="text-xs text-gray-500 mt-1">Kapasite</p>
        </div>
      </div>

      {/* Rota Oluştur */}
      <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
        <h2 className="text-base font-semibold text-white mb-4">Rota Oluşturma</h2>
        <RouteButton activeCount={activeStudents.length} vehicleId={vehicle.id} />
      </div>

      {/* Aktif öğrenci listesi */}
      <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
        <h2 className="text-base font-semibold text-white mb-4">Bugünkü Liste</h2>

        {activeStudents.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-base">Bugün için aktif öğrenci yok.</p>
            <p className="text-xs mt-1 text-gray-600">Admin panelinden öğrenciler aktif edildiğinde burada görünecek.</p>
          </div>
        ) : (
          <ul className="divide-y divide-dark-500">
            {activeStudents.map((student, index) => (
              <li key={student.id} className="flex items-center gap-3 py-3.5">
                <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent text-sm font-bold flex items-center justify-center shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-white">{student.name}</p>
                  <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {student.label}
                  </p>
                </div>
                <a
                  href={student.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 text-gray-500 hover:text-accent hover:bg-accent/10 rounded-lg transition"
                  title="Haritada Göster"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
