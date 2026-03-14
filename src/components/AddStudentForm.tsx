"use client";

import { useState } from "react";
import { Vehicle } from "@/lib/types";
import { createStudent } from "@/lib/actions";

interface Props {
  onDone: () => void;
  vehicles: Vehicle[];
}

export default function AddStudentForm({ onDone, vehicles }: Props) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await createStudent(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    form.reset();
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
