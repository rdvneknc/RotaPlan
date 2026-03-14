"use client";

import { useState } from "react";
import { editStudent } from "@/lib/actions";
import { Student, Vehicle } from "@/lib/types";

interface Props {
  student: Student;
  vehicles: Vehicle[];
  onClose: () => void;
  onDone: () => void;
}

export default function EditStudentModal({ student, vehicles, onClose, onDone }: Props) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("id", student.id);
    const result = await editStudent(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-dark-800 border border-dark-500 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-xl font-semibold text-white mb-5">Öğrenci Düzenle</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-400 mb-1.5">
              Öğrenci Adı
            </label>
            <input
              id="edit-name"
              name="name"
              type="text"
              required
              defaultValue={student.name}
              className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
            />
          </div>
          <div>
            <label htmlFor="edit-label" className="block text-sm font-medium text-gray-400 mb-1.5">
              Adres Notu
            </label>
            <input
              id="edit-label"
              name="label"
              type="text"
              required
              defaultValue={student.label}
              className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
            />
          </div>
          <div>
            <label htmlFor="edit-mapsUrl" className="block text-sm font-medium text-gray-400 mb-1.5">
              Google Maps Linki
            </label>
            <input
              id="edit-mapsUrl"
              name="mapsUrl"
              type="url"
              required
              defaultValue={student.mapsUrl}
              className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
            />
            <p className="text-xs text-gray-600 mt-1.5">
              Değiştirmek istemiyorsanız mevcut linki bırakın
            </p>
          </div>
          {vehicles.length > 0 && (
            <div>
              <label htmlFor="edit-vehicleId" className="block text-sm font-medium text-gray-400 mb-1.5">
                Araç / Servis
              </label>
              <select
                id="edit-vehicleId"
                name="vehicleId"
                defaultValue={student.vehicleId || ""}
                className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              >
                <option value="">Atanmamış</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.driverName} - {v.plate}</option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-dark-400 text-gray-400 hover:bg-dark-600 font-medium py-3 px-4 rounded-xl text-sm transition"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-dark-900 font-semibold py-3 px-4 rounded-xl text-sm transition"
            >
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
