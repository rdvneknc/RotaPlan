"use client";

import { useState } from "react";
import { Vehicle } from "@/lib/types";
import { createVehicle, editVehicle, removeVehicle } from "@/lib/actions";

interface Props {
  vehicles: Vehicle[];
  onRefresh: () => void;
}

export default function VehicleManagement({ vehicles, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const result = await createVehicle(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setShowForm(false);
    setLoading(false);
    onRefresh();
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingVehicle) return;
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("id", editingVehicle.id);
    const result = await editVehicle(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setEditingVehicle(null);
    setLoading(false);
    onRefresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${name} adlı aracı silmek istediğinize emin misiniz? Bu araca atanan öğrenciler atanmamış duruma geçecektir.`)) return;
    const formData = new FormData();
    formData.set("id", id);
    await removeVehicle(formData);
    onRefresh();
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/sofor/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  function getDriverUrl(slug: string) {
    return `${typeof window !== "undefined" ? window.location.origin : ""}/sofor/${slug}`;
  }

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Araç Yönetimi</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditingVehicle(null); setError(""); }}
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
              Araç Ekle
            </>
          )}
        </button>
      </div>

      {/* Ekleme / Düzenleme formu */}
      {(showForm || editingVehicle) && (
        <div className="mb-5 pb-5 border-b border-dark-500">
          <form onSubmit={editingVehicle ? handleEdit : handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Şoför Adı</label>
              <input
                name="driverName"
                type="text"
                required
                defaultValue={editingVehicle?.driverName || ""}
                placeholder="örn. Mehmet Kaya"
                className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Plaka</label>
                <input
                  name="plate"
                  type="text"
                  required
                  defaultValue={editingVehicle?.plate || ""}
                  placeholder="42 ABC 123"
                  className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Kapasite</label>
                <input
                  name="capacity"
                  type="number"
                  min="1"
                  max="50"
                  defaultValue={editingVehicle?.capacity || 15}
                  className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
                />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingVehicle(null); setError(""); }}
                className="flex-1 border border-dark-400 text-gray-400 hover:bg-dark-600 font-medium py-3 px-4 rounded-xl text-sm transition"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-dark-900 font-semibold py-3 px-4 rounded-xl text-sm transition"
              >
                {loading ? "Kaydediliyor..." : (editingVehicle ? "Güncelle" : "Araç Ekle")}
              </button>
            </div>
          </form>
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
          <p className="text-base">Henüz araç eklenmedi.</p>
          <p className="text-xs mt-1 text-gray-600">Yukarıdan ilk aracınızı ekleyin.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-3">{vehicles.length} araç kayıtlı</p>
          <ul className="space-y-3">
            {vehicles.map((vehicle) => (
              <li key={vehicle.id} className="bg-dark-700 rounded-xl p-4 border border-dark-500">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-base font-medium text-white">{vehicle.driverName}</p>
                      <span className="text-xs bg-dark-500 text-gray-300 px-2 py-0.5 rounded-md font-mono">{vehicle.plate}</span>
                    </div>
                    <p className="text-sm text-gray-500">Kapasite: {vehicle.capacity} kişi</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => copyLink(vehicle.slug)}
                        className="text-xs text-accent hover:text-accent-hover flex items-center gap-1 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        {copied === vehicle.slug ? "Kopyalandı!" : "Şoför Linkini Kopyala"}
                      </button>
                      <span className="text-xs text-gray-600 truncate max-w-[180px]">{getDriverUrl(vehicle.slug)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingVehicle(vehicle); setShowForm(false); setError(""); }}
                      className="p-2 text-gray-500 hover:text-accent hover:bg-accent/10 rounded-lg transition"
                      title="Düzenle"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(vehicle.id, vehicle.driverName)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Sil"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
