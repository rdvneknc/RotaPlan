"use client";

import { useState } from "react";
import { editStudent } from "@/lib/actions";
import { Student } from "@/lib/types";

interface Props {
  schoolId: string;
  student: Student;
  onClose: () => void;
  onDone: () => void;
}

export default function EditStudentModal({ schoolId, student, onClose, onDone }: Props) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("id", student.id);
    const result = await editStudent(schoolId, formData);

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
          <input type="hidden" name="vehicleId" value={student.vehicleId ?? ""} />
          {(student.sessionIds || []).map((sid) => (
            <input key={sid} type="hidden" name="sessionIds" value={sid} />
          ))}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-contact1Name" className="block text-sm font-medium text-gray-400 mb-1.5">
                İrtibat 1
              </label>
              <input
                id="edit-contact1Name"
                name="contact1Name"
                type="text"
                defaultValue={student.contact1Name}
                placeholder="örn. Baba Ahmet"
                className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>
            <div>
              <label htmlFor="edit-contact1Phone" className="block text-sm font-medium text-gray-400 mb-1.5">
                Telefon 1
              </label>
              <input
                id="edit-contact1Phone"
                name="contact1Phone"
                type="tel"
                defaultValue={student.contact1Phone}
                placeholder="5XX XXX XX XX"
                className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-contact2Name" className="block text-sm font-medium text-gray-400 mb-1.5">
                İrtibat 2
              </label>
              <input
                id="edit-contact2Name"
                name="contact2Name"
                type="text"
                defaultValue={student.contact2Name}
                placeholder="örn. Anne Fatma"
                className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>
            <div>
              <label htmlFor="edit-contact2Phone" className="block text-sm font-medium text-gray-400 mb-1.5">
                Telefon 2
              </label>
              <input
                id="edit-contact2Phone"
                name="contact2Phone"
                type="tel"
                defaultValue={student.contact2Phone}
                placeholder="5XX XXX XX XX"
                className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>
          </div>
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
