"use client";

import { useState } from "react";
import { SchoolInfo } from "@/lib/types";
import { saveSchool } from "@/lib/actions";

export default function SchoolSettings({ schoolId, initialSchool }: { schoolId: string; initialSchool: SchoolInfo }) {
  const [school, setSchool] = useState(initialSchool);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await saveSchool(schoolId, formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSchool({
      label: (formData.get("label") as string).trim(),
      lat: school.lat,
      lng: school.lng,
      mapsUrl: (formData.get("mapsUrl") as string).trim(),
    });
    setEditing(false);
    setLoading(false);
  }

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Okul Konumu</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-accent hover:text-accent-hover font-medium flex items-center gap-1.5 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Düzenle
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="school-label" className="block text-sm font-medium text-gray-400 mb-1.5">
              Okul Adı / Açıklama
            </label>
            <input
              id="school-label"
              name="label"
              type="text"
              required
              defaultValue={school.label}
              placeholder="örn. Ereğli Anadolu Lisesi"
              className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
            />
          </div>
          <div>
            <label htmlFor="school-mapsUrl" className="block text-sm font-medium text-gray-400 mb-1.5">
              Google Maps Linki
            </label>
            <input
              id="school-mapsUrl"
              name="mapsUrl"
              type="url"
              required
              defaultValue={school.mapsUrl}
              placeholder="https://www.google.com/maps/..."
              className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
            />
            <p className="text-xs text-gray-600 mt-1.5">
              Okulun konumunu Google Maps&apos;te bulun, linki kopyalayın
            </p>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setEditing(false); setError(""); }}
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
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-white">{school.label}</p>
            <p className="text-sm text-gray-500">{school.lat.toFixed(4)}, {school.lng.toFixed(4)}</p>
          </div>
          <a
            href={school.mapsUrl}
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
        </div>
      )}
    </div>
  );
}
