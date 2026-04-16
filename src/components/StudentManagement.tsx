"use client";

import { useState } from "react";
import { Student, Vehicle, Session } from "@/lib/types";
import { removeStudent } from "@/lib/actions";
import { studentMapOpenUrl } from "@/lib/parse-maps-url";
import AddStudentForm from "./AddStudentForm";
import EditStudentModal from "./EditStudentModal";

interface Props {
  schoolId: string;
  students: Student[];
  vehicles: Vehicle[];
  sessions: Session[];
  onRefresh: () => void;
}

export default function StudentManagement({ schoolId, students, vehicles, sessions, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function getVehicleLabel(vehicleId: string | null): string | null {
    if (!vehicleId) return null;
    const v = vehicles.find((ve) => ve.id === vehicleId);
    return v ? `${v.plate}` : null;
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${name} adlı öğrenciyi silmek istediğinize emin misiniz?`)) return;
    setLoadingId(id);
    const formData = new FormData();
    formData.set("id", id);
    await removeStudent(schoolId, formData);
    onRefresh();
    setLoadingId(null);
  }

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-500 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Öğrenci Yönetimi</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm text-accent hover:text-accent-hover font-medium flex items-center gap-1.5 transition"
        >
          {showForm ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Kapat
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Öğrenci Ekle
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="mb-5 pb-5 border-b border-dark-500">
          <AddStudentForm
            schoolId={schoolId}
            onDone={() => {
              setShowForm(false);
              onRefresh();
            }}
          />
        </div>
      )}

      {students.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-base">Henüz öğrenci yok.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-3">Toplam {students.length} öğrenci kayıtlı</p>
          <ul className="divide-y divide-dark-500">
            {students.map((student) => {
              const vehicleLabel = getVehicleLabel(student.vehicleId);
              const pinHref = studentMapOpenUrl(student);
              return (
                <li
                  key={student.id}
                  className={`flex items-center gap-3 py-3 transition ${loadingId === student.id ? "opacity-50" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-medium text-white">{student.name}</p>
                      {vehicleLabel && (
                        <span className="text-[10px] bg-dark-500 text-gray-300 px-1.5 py-0.5 rounded font-mono">{vehicleLabel}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {student.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {pinHref ? (
                      <a
                        href={pinHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-500 hover:text-accent hover:bg-accent/10 rounded-lg transition"
                        title="Haritada Göster"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </a>
                    ) : (
                      <span className="p-2 text-gray-600 opacity-50 cursor-not-allowed" title="Konum bilgisi yok">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </span>
                    )}
                    <button
                      onClick={() => setEditingStudent(student)}
                      className="p-2 text-gray-500 hover:text-accent hover:bg-accent/10 rounded-lg transition"
                      title="Düzenle"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(student.id, student.name)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Sil"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editingStudent && (
        <EditStudentModal
          schoolId={schoolId}
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onDone={() => {
            setEditingStudent(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
