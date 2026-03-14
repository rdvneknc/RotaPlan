"use client";

import { useState } from "react";
import { getRouteLink } from "@/lib/actions";
import { RouteMode } from "@/lib/types";

interface Props {
  activeCount: number;
  vehicleId?: string;
}

export default function RouteButton({ activeCount, vehicleId }: Props) {
  const [mode, setMode] = useState<RouteMode>("pickup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");

    const link = await getRouteLink(mode, vehicleId);

    if (!link) {
      setError("Aktif öğrenci yok.");
      setLoading(false);
      return;
    }

    window.open(link, "_blank");
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {/* Mod seçici */}
      <div className="flex bg-dark-700 rounded-xl p-1.5 gap-1">
        <button
          type="button"
          onClick={() => setMode("pickup")}
          className={`flex-1 py-3 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${
            mode === "pickup"
              ? "bg-accent text-dark-900"
              : "text-gray-400 hover:text-white hover:bg-dark-600"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
          </svg>
          Evlerden Okula
        </button>
        <button
          type="button"
          onClick={() => setMode("dropoff")}
          className={`flex-1 py-3 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${
            mode === "dropoff"
              ? "bg-accent text-dark-900"
              : "text-gray-400 hover:text-white hover:bg-dark-600"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Okuldan Evlere
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        {mode === "pickup"
          ? "Mevcut konumunuzdan öğrencileri toplayıp okula bırakır"
          : "Okuldan öğrencileri alıp evlerine bırakır"}
      </p>

      <button
        onClick={handleGenerate}
        disabled={loading || activeCount === 0}
        className="w-full bg-accent hover:bg-accent-hover disabled:bg-dark-600 disabled:text-gray-500 disabled:cursor-not-allowed text-dark-900 font-semibold py-4 px-6 rounded-xl text-base transition flex items-center justify-center gap-2"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        {loading ? "Oluşturuluyor..." : "Rota Oluştur"}
      </button>

      {activeCount === 0 && (
        <p className="text-xs text-gray-600 text-center">
          Rota oluşturmak için öğrencileri aktif olarak işaretleyin.
        </p>
      )}

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </div>
  );
}
