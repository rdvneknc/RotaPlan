"use client";

import { useState } from "react";
import { Vehicle, Session } from "@/lib/types";
import { createStudent } from "@/lib/actions";

interface Props {
  onDone: () => void;
  vehicles: Vehicle[];
  sessions: Session[];
}

export default function AddStudentForm({ onDone, vehicles, sessions }: Props) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.delete("sessionIds");
    selectedSessions.forEach((sid) => formData.append("sessionIds", sid));
    const result = await createStudent(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    form.reset();
    setSelectedSessions([]);
    setLoading(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1.5">
          Öğrenci Adı
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="örn. Ahmet Yılmaz"
          className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
        />
      </div>
      <div>
        <label htmlFor="label" className="block text-sm font-medium text-gray-400 mb-1.5">
          Adres Notu
        </label>
        <input
          id="label"
          name="label"
          type="text"
          required
          placeholder="örn. Barbaros Mah. veya Okul karşısı"
          className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
        />
        <p className="text-xs text-gray-600 mt-1.5">Listede görünecek kısa açıklama</p>
      </div>
      <div>
        <label htmlFor="mapsUrl" className="block text-sm font-medium text-gray-400 mb-1.5">
          Google Maps Linki
        </label>
        <input
          id="mapsUrl"
          name="mapsUrl"
          type="url"
          required
          placeholder="https://www.google.com/maps/..."
          className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
        />
        <p className="text-xs text-gray-600 mt-1.5">
          Google Maps&apos;te konumu bulun, linki kopyalayıp buraya yapıştırın
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="contact1Name" className="block text-sm font-medium text-gray-400 mb-1.5">
            İrtibat 1
          </label>
          <input
            id="contact1Name"
            name="contact1Name"
            type="text"
            placeholder="örn. Baba Ahmet"
            className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
          />
        </div>
        <div>
          <label htmlFor="contact1Phone" className="block text-sm font-medium text-gray-400 mb-1.5">
            Telefon 1
          </label>
          <input
            id="contact1Phone"
            name="contact1Phone"
            type="tel"
            placeholder="5XX XXX XX XX"
            className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="contact2Name" className="block text-sm font-medium text-gray-400 mb-1.5">
            İrtibat 2
          </label>
          <input
            id="contact2Name"
            name="contact2Name"
            type="text"
            placeholder="örn. Anne Fatma"
            className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
          />
        </div>
        <div>
          <label htmlFor="contact2Phone" className="block text-sm font-medium text-gray-400 mb-1.5">
            Telefon 2
          </label>
          <input
            id="contact2Phone"
            name="contact2Phone"
            type="tel"
            placeholder="5XX XXX XX XX"
            className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
          />
        </div>
      </div>
      {vehicles.length > 0 && (
        <div>
          <label htmlFor="vehicleId" className="block text-sm font-medium text-gray-400 mb-1.5">
            Araç / Servis
          </label>
          <select
            id="vehicleId"
            name="vehicleId"
            className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
          >
            <option value="">Atanmamış</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.driverName} - {v.plate}</option>
            ))}
          </select>
        </div>
      )}
      {sessions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">
            Seanslar
          </label>
          <div className="max-h-32 overflow-y-auto border border-dark-400 rounded-xl divide-y divide-dark-500">
            {sessions.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-dark-600 cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={selectedSessions.includes(s.id)}
                  onChange={() =>
                    setSelectedSessions((prev) =>
                      prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                    )
                  }
                  className="w-4 h-4 rounded border-dark-400 bg-dark-600 text-accent focus:ring-accent"
                />
                <span className="text-sm text-white">{s.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-1">Bu öğrenci hangi seanslarda olacak?</p>
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-dark-900 font-semibold py-3 px-4 rounded-xl text-base transition"
      >
        {loading ? "Ekleniyor..." : "Öğrenci Ekle"}
      </button>
    </form>
  );
}
