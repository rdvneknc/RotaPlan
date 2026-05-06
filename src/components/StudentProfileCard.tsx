"use client";

import { useEffect } from "react";
import { Student, Vehicle, Session } from "@/lib/types";
import { studentMapOpenUrl } from "@/lib/parse-maps-url";

interface Props {
  student: Student;
  vehicles: Vehicle[];
  sessions: Session[];
  onClose: () => void;
  /** Profil kapanır ve düzenleme modali açılır */
  onEdit: (student: Student) => void;
}

export default function StudentProfileCard({ student, vehicles, sessions, onClose, onEdit }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const vehicle = student.vehicleId ? vehicles.find((v) => v.id === student.vehicleId) : null;
  const sessionLabels = (student.sessionIds || [])
    .map((sid) => sessions.find((s) => s.id === sid)?.label)
    .filter((x): x is string => Boolean(x));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-student-profile-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[min(90dvh,640px)] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-dark-500 bg-dark-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-dark-500 bg-dark-800/95">
          <h2 id="admin-student-profile-title" className="text-lg font-semibold text-white">
            Öğrenci profili
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-600 transition"
            aria-label="Kapat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                student.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-dark-600 text-gray-500"
              }`}
            >
              {student.isActive ? "Aktif" : "Pasif"}
            </span>
            {vehicle && (
              <span className="text-[10px] font-medium text-gray-400 bg-dark-700 px-2 py-0.5 rounded border border-dark-500">
                {vehicle.driverName} · {vehicle.plate}
              </span>
            )}
          </div>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">Ad Soyad</p>
            <p className="text-base text-white font-medium">{student.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">Adres notu</p>
            <p className="text-sm text-gray-300 leading-relaxed">{student.label || "—"}</p>
          </div>

          {sessionLabels.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">Ders saatleri</p>
              <p className="text-sm text-gray-300">{sessionLabels.join(" · ")}</p>
            </div>
          )}

          {(student.contact1Name || student.contact1Phone) && (
            <div className="rounded-xl border border-dark-500 bg-dark-700/40 p-4 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">İletişim 1</p>
              {student.contact1Name ? <p className="text-sm text-white">{student.contact1Name}</p> : null}
              {student.contact1Phone ? (
                <a
                  href={`tel:${student.contact1Phone.replace(/\s/g, "")}`}
                  className="text-sm text-accent hover:underline font-medium inline-block"
                >
                  {student.contact1Phone}
                </a>
              ) : (
                <p className="text-sm text-gray-500">Telefon yok</p>
              )}
            </div>
          )}
          {(student.contact2Name || student.contact2Phone) && (
            <div className="rounded-xl border border-dark-500 bg-dark-700/40 p-4 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">İletişim 2</p>
              {student.contact2Name ? <p className="text-sm text-white">{student.contact2Name}</p> : null}
              {student.contact2Phone ? (
                <a
                  href={`tel:${student.contact2Phone.replace(/\s/g, "")}`}
                  className="text-sm text-accent hover:underline font-medium inline-block"
                >
                  {student.contact2Phone}
                </a>
              ) : null}
            </div>
          )}
          {!student.contact1Phone &&
            !student.contact2Phone &&
            !student.contact1Name &&
            !student.contact2Name && (
              <p className="text-sm text-gray-500">Kayıtlı veli iletişim bilgisi yok.</p>
            )}

          {(() => {
            const h = studentMapOpenUrl(student);
            return h ? (
              <a
                href={h}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Haritada aç
              </a>
            ) : null;
          })()}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onEdit(student);
                onClose();
              }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-dark-900 bg-accent/90 hover:bg-accent transition"
            >
              Düzenle
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-300 border border-dark-500 hover:bg-dark-700 transition"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
