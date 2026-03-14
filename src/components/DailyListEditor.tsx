"use client";

import { useState } from "react";
import { Student, Vehicle } from "@/lib/types";
import { toggleActive, moveStudent, setAllActive, autoDistribute } from "@/lib/actions";

interface Props {
  students: Student[];
  vehicles: Vehicle[];
  onRefresh: () => void;
}

type ViewMode = "list" | "distribution";

export default function DailyListEditor({ students, vehicles, onRefresh }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [distributeMsg, setDistributeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const filtered = selectedVehicle === "all"
    ? students
    : selectedVehicle === "unassigned"
      ? students.filter((s) => !s.vehicleId)
      : students.filter((s) => s.vehicleId === selectedVehicle);

  const activeStudents = filtered.filter((s) => s.isActive);
  const inactiveStudents = filtered.filter((s) => !s.isActive);
  const allActiveStudents = students.filter((s) => s.isActive);

  const selectedVehicleObj = vehicles.find((v) => v.id === selectedVehicle);
  const capacityLimit = selectedVehicleObj?.capacity || 15;

  // Group active students by vehicle for distribution view
  const distributionGroups = vehicles.map((v) => ({
    vehicle: v,
    students: allActiveStudents.filter((s) => s.vehicleId === v.id),
  }));
  const unassignedActive = allActiveStudents.filter((s) => !s.vehicleId);

  async function handleToggle(id: string) {
    setLoadingId(id);
    const formData = new FormData();
    formData.set("id", id);
    await toggleActive(formData);
    onRefresh();
    setLoadingId(null);
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("direction", direction);
    await moveStudent(formData);
    onRefresh();
  }

  async function handleSelectAll() {
    setBulkLoading(true);
    const vehicleId = selectedVehicle !== "all" && selectedVehicle !== "unassigned" ? selectedVehicle : undefined;
    await setAllActive(true, vehicleId);
    onRefresh();
    setBulkLoading(false);
  }

  async function handleDeselectAll() {
    setBulkLoading(true);
    const vehicleId = selectedVehicle !== "all" && selectedVehicle !== "unassigned" ? selectedVehicle : undefined;
    await setAllActive(false, vehicleId);
    onRefresh();
    setBulkLoading(false);
  }

  async function handleAutoDistribute() {
    setDistributing(true);
    setDistributeMsg(null);
    const result = await autoDistribute();
    if (result.error) {
      setDistributeMsg({ type: "error", text: result.error });
    } else {
      setDistributeMsg({ type: "success", text: `${result.distributed} öğrenci ${vehicles.length} araca dağıtıldı.` });
      setViewMode("distribution");
    }
    onRefresh();
    setDistributing(false);
    setTimeout(() => setDistributeMsg(null), 5000);
  }

  function getVehiclePlate(vehicleId: string | null): string | null {
    if (!vehicleId) return null;
    return vehicles.find((v) => v.id === vehicleId)?.plate || null;
  }

  if (students.length === 0) {
    return (
      <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
        <h2 className="text-base font-semibold text-white mb-3">Günlük Liste</h2>
        <p className="text-sm text-gray-500 text-center py-8">
          Önce öğrenci ekleyin, sonra günlük listeyi oluşturun.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white">Günlük Liste</h2>
        <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
          {allActiveStudents.length} aktif
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">Bugün servise binecek öğrencileri seçin ve araçlara dağıtın</p>

      {/* Görünüm seçici */}
      {vehicles.length > 0 && (
        <div className="flex bg-dark-700 rounded-xl p-1 gap-1 mb-4">
          <button
            onClick={() => setViewMode("list")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              viewMode === "list"
                ? "bg-dark-500 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Öğrenci Listesi
          </button>
          <button
            onClick={() => setViewMode("distribution")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              viewMode === "distribution"
                ? "bg-dark-500 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Araç Dağılımı
          </button>
        </div>
      )}

      {/* Otomatik Dağıt butonu */}
      {vehicles.length > 0 && (
        <div className="mb-4">
          <button
            onClick={handleAutoDistribute}
            disabled={distributing || allActiveStudents.length === 0}
            className="w-full px-4 py-3 text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {distributing ? "Dağıtılıyor..." : "Otomatik Dağıt ve Optimize Et"}
          </button>
          {allActiveStudents.length === 0 && (
            <p className="text-xs text-gray-600 text-center mt-1.5">Önce listeye öğrenci ekleyin</p>
          )}
          {distributeMsg && (
            <p className={`text-sm text-center mt-2 ${distributeMsg.type === "success" ? "text-green-400" : "text-red-400"}`}>
              {distributeMsg.text}
            </p>
          )}
        </div>
      )}

      {/* === DISTRIBUTION VIEW === */}
      {viewMode === "distribution" && vehicles.length > 0 && (
        <div className="space-y-3">
          {distributionGroups.map(({ vehicle, students: vStudents }) => (
            <div key={vehicle.id} className="border border-dark-400 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-dark-700 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{vehicle.driverName}</p>
                    <p className="text-xs text-gray-500">{vehicle.plate}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold px-2.5 py-1 rounded-lg ${
                  vStudents.length > vehicle.capacity
                    ? "text-red-400 bg-red-500/10"
                    : vStudents.length > 0
                      ? "text-accent bg-accent/10"
                      : "text-gray-600 bg-dark-600"
                }`}>
                  {vStudents.length} / {vehicle.capacity}
                </span>
              </div>

              {vStudents.length === 0 ? (
                <div className="px-4 py-4 text-center">
                  <p className="text-sm text-gray-600">Bu araca atanmış öğrenci yok</p>
                </div>
              ) : (
                <ul className="divide-y divide-dark-500">
                  {vStudents.map((student, index) => (
                    <li key={student.id} className="flex items-center gap-3 py-2.5 px-4">
                      <span className="w-6 h-6 rounded-md bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{student.name}</p>
                        <p className="text-xs text-gray-500 truncate">{student.label}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {unassignedActive.length > 0 && (
            <div className="border border-amber-700/30 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-amber-900/20 px-4 py-3">
                <p className="text-sm font-medium text-amber-400">Atanmamış Öğrenciler</p>
                <span className="text-sm font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                  {unassignedActive.length}
                </span>
              </div>
              <ul className="divide-y divide-dark-500">
                {unassignedActive.map((student) => (
                  <li key={student.id} className="flex items-center gap-3 py-2.5 px-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-400">{student.name}</p>
                      <p className="text-xs text-gray-600 truncate">{student.label}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* === LIST VIEW === */}
      {viewMode === "list" && (
        <>
          {/* Araç filtresi */}
          {vehicles.length > 0 && (
            <div className="mb-4">
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              >
                <option value="all">Tüm Öğrenciler</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.driverName} - {v.plate}</option>
                ))}
                <option value="unassigned">Atanmamış Öğrenciler</option>
              </select>
            </div>
          )}

          {/* Toplu işlem butonları */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleSelectAll}
              disabled={bulkLoading || inactiveStudents.length === 0}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-accent bg-accent/10 hover:bg-accent/20 disabled:opacity-30 disabled:cursor-not-allowed border border-accent/20 rounded-xl transition"
            >
              Hepsini Seç
            </button>
            <button
              onClick={handleDeselectAll}
              disabled={bulkLoading || activeStudents.length === 0}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-400 bg-dark-600 hover:bg-dark-500 disabled:opacity-30 disabled:cursor-not-allowed border border-dark-400 rounded-xl transition"
            >
              Hepsini Bırak
            </button>
          </div>

          {selectedVehicleObj && activeStudents.length > capacityLimit && (
            <div className="bg-amber-900/30 border border-amber-700/30 rounded-xl p-3 mb-4">
              <p className="text-amber-400 text-sm text-center">
                Uyarı: {capacityLimit}&apos;ten fazla öğrenci seçili. Araç kapasitesi {capacityLimit} kişidir.
              </p>
            </div>
          )}

          {/* Aktif öğrenciler */}
          {activeStudents.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-accent mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Bugün binecekler ({activeStudents.length})
              </p>
              <ul className="divide-y divide-dark-500 border border-accent/20 rounded-xl overflow-hidden">
                {activeStudents.map((student, index) => (
                  <li
                    key={student.id}
                    className={`flex items-center gap-3 py-3 px-4 bg-accent/5 transition ${loadingId === student.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex flex-col items-center shrink-0 gap-0.5">
                      <button
                        onClick={() => handleMove(student.id, "up")}
                        disabled={index === 0}
                        className="p-1 text-dark-400 hover:text-accent disabled:opacity-20 disabled:cursor-not-allowed transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <span className="text-xs font-bold text-accent leading-none">{index + 1}</span>
                      <button
                        onClick={() => handleMove(student.id, "down")}
                        disabled={index === activeStudents.length - 1}
                        className="p-1 text-dark-400 hover:text-accent disabled:opacity-20 disabled:cursor-not-allowed transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-medium text-white">{student.name}</p>
                        {student.vehicleId && (
                          <span className="text-[10px] bg-dark-500 text-gray-300 px-1.5 py-0.5 rounded font-mono">
                            {getVehiclePlate(student.vehicleId)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{student.label}</p>
                    </div>

                    <button
                      onClick={() => handleToggle(student.id)}
                      disabled={loadingId === student.id}
                      className="px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/30 rounded-lg transition"
                    >
                      Çıkar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pasif öğrenciler */}
          {inactiveStudents.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">
                Diğer öğrenciler ({inactiveStudents.length})
              </p>
              <ul className="divide-y divide-dark-500 border border-dark-500 rounded-xl overflow-hidden">
                {inactiveStudents.map((student) => (
                  <li
                    key={student.id}
                    className={`flex items-center gap-3 py-3 px-4 transition ${loadingId === student.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-base text-gray-400">{student.name}</p>
                      <p className="text-sm text-gray-600 truncate">{student.label}</p>
                    </div>
                    <button
                      onClick={() => handleToggle(student.id)}
                      disabled={loadingId === student.id}
                      className="px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 border border-accent/30 rounded-lg transition"
                    >
                      Ekle
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
