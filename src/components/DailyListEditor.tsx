"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Student, Vehicle, Session } from "@/lib/types";
import {
  clearDailyDistributionAction,
  distributeDailyAllAction,
  fetchDailyDistribution,
  fetchWeeklyScheduleForDay,
  fetchWorkingVehicleIdsForDay,
  setWorkingVehicleIdsForDayAction,
  updateDailyDistributionSessionAction,
} from "@/lib/actions";

interface Props {
  students: Student[];
  vehicles: Vehicle[];
  sessions: Session[];
  onRefresh: () => void;
}

type DailyDist = {
  [sessionId: string]: {
    studentAssignments: { studentId: string; vehicleId: string; order: number }[];
  };
};

type Assignment = { studentId: string; vehicleId: string; order: number };

const DAY_LABELS: { [key: string]: string } = {
  "0": "Pazar", "1": "Pazartesi", "2": "Salı", "3": "Çarşamba",
  "4": "Perşembe", "5": "Cuma", "6": "Cumartesi",
};

function assignmentsToBuckets(assignments: Assignment[], vehicleList: Vehicle[]): Record<string, string[]> {
  const buckets: Record<string, string[]> = {};
  for (const v of vehicleList) buckets[v.id] = [];
  for (const v of vehicleList) {
    const items = assignments
      .filter((a) => a.vehicleId === v.id)
      .sort((a, b) => a.order - b.order);
    buckets[v.id] = items.map((a) => a.studentId);
  }
  return buckets;
}

function bucketsToAssignments(buckets: Record<string, string[]>): Assignment[] {
  const out: Assignment[] = [];
  for (const [vId, ids] of Object.entries(buckets)) {
    ids.forEach((sid, i) => out.push({ studentId: sid, vehicleId: vId, order: i }));
  }
  return out;
}

export default function DailyListEditor({ students, vehicles, sessions, onRefresh }: Props) {
  const [distributing, setDistributing] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [distribution, setDistribution] = useState<DailyDist | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<{ [sessionId: string]: string[] }>({});
  const [workingVehicleIds, setWorkingVehicleIds] = useState<string[]>([]);
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);
  const dragRef = useRef<{ sessionId: string; studentId: string } | null>(null);

  const todayKey = String(new Date().getDay());
  const todayLabel = DAY_LABELS[todayKey] || "Bugün";

  const loadData = useCallback(async () => {
    const [dist, sched, working] = await Promise.all([
      fetchDailyDistribution(),
      fetchWeeklyScheduleForDay(todayKey),
      fetchWorkingVehicleIdsForDay(todayKey),
    ]);
    setDistribution(dist);
    setTodaySchedule(sched);
    setWorkingVehicleIds(working);
  }, [todayKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getSessionStudentCount(session: Session): number {
    const fromSchedule = todaySchedule[session.id];
    if (fromSchedule) return fromSchedule.length;
    return session.studentIds.length;
  }

  function getStudentName(id: string): string {
    return students.find((s) => s.id === id)?.name ?? "?";
  }

  function getVehicleName(id: string): string {
    const v = vehicles.find((v) => v.id === id);
    return v ? `${v.driverName} (${v.plate})` : "?";
  }

  const totalStudentsToday = sessions.reduce((sum, s) => sum + getSessionStudentCount(s), 0);

  const hasSavedDistribution = distribution != null;

  function vehiclesForSessionEdit(session: Session): Vehicle[] {
    const assigned = new Set<string>();
    const dist = distribution?.[session.id];
    if (dist) {
      for (const a of dist.studentAssignments) assigned.add(a.vehicleId);
    }
    const w = new Set(workingVehicleIds);
    return vehicles.filter((v) => w.has(v.id) || assigned.has(v.id));
  }

  async function toggleWorkingVehicle(vehicleId: string) {
    const next = workingVehicleIds.includes(vehicleId)
      ? workingVehicleIds.filter((id) => id !== vehicleId)
      : [...workingVehicleIds, vehicleId];
    if (next.length === 0) {
      setMsg({ type: "error", text: "En az bir araç çalışıyor olarak işaretli olmalı." });
      return;
    }
    setWorkingVehicleIds(next);
    setMsg(null);
    const r = await setWorkingVehicleIdsForDayAction(todayKey, next);
    if (r.error) {
      setMsg({ type: "error", text: r.error });
      await loadData();
    }
    onRefresh();
  }

  async function selectAllWorkingVehicles() {
    const all = vehicles.map((v) => v.id);
    setWorkingVehicleIds(all);
    setMsg(null);
    await setWorkingVehicleIdsForDayAction(todayKey, all);
    onRefresh();
  }

  async function persistSessionAssignments(sessionId: string, assignments: Assignment[]) {
    setSavingSessionId(sessionId);
    setMsg(null);
    const result = await updateDailyDistributionSessionAction(sessionId, assignments);
    if (result.error) {
      setMsg({ type: "error", text: result.error });
    } else {
      setMsg({ type: "success", text: "Dağıtım güncellendi." });
      setTimeout(() => setMsg(null), 3000);
    }
    await loadData();
    onRefresh();
    setSavingSessionId(null);
  }

  function handleDragStart(sessionId: string, studentId: string, e: React.DragEvent) {
    dragRef.current = { sessionId, studentId };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", studentId);
  }

  function handleDragEnd() {
    dragRef.current = null;
  }

  async function handleDropOnVehicle(sessionId: string, targetVehicleId: string, beforeStudentId: string | null) {
    const payload = dragRef.current;
    if (!payload || payload.sessionId !== sessionId || !distribution?.[sessionId]) return;

    const studentId = payload.studentId;
    const assignments = distribution[sessionId].studentAssignments;
    const buckets = assignmentsToBuckets(assignments, vehicles);

    for (const vid of Object.keys(buckets)) {
      buckets[vid] = buckets[vid].filter((id) => id !== studentId);
    }

    const list = buckets[targetVehicleId] ?? [];
    if (beforeStudentId == null) {
      list.push(studentId);
    } else {
      const idx = list.indexOf(beforeStudentId);
      if (idx === -1) list.push(studentId);
      else list.splice(idx, 0, studentId);
    }
    buckets[targetVehicleId] = list;

    await persistSessionAssignments(sessionId, bucketsToAssignments(buckets));
    handleDragEnd();
  }

  async function handleRemoveFromSession(sessionId: string, studentId: string) {
    if (!distribution?.[sessionId]) return;
    const assignments = distribution[sessionId].studentAssignments.filter((a) => a.studentId !== studentId);
    await persistSessionAssignments(sessionId, assignments);
  }

  async function handleMoveInVehicle(sessionId: string, vehicleId: string, studentId: string, dir: "up" | "down") {
    if (!distribution?.[sessionId]) return;
    const buckets = assignmentsToBuckets(distribution[sessionId].studentAssignments, vehicles);
    const list = [...(buckets[vehicleId] ?? [])];
    const idx = list.indexOf(studentId);
    if (idx === -1) return;
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    buckets[vehicleId] = list;
    await persistSessionAssignments(sessionId, bucketsToAssignments(buckets));
  }

  async function handleUndoDistribution() {
    if (!hasSavedDistribution) return;
    if (!window.confirm("Günün dağıtımı silinecek. Şoför panellerindeki atamalar da kalkacak. Devam edilsin mi?")) return;
    setUndoing(true);
    setMsg(null);
    await clearDailyDistributionAction();
    await loadData();
    onRefresh();
    setMsg({ type: "success", text: "Dağıtım geri alındı." });
    setUndoing(false);
    setTimeout(() => setMsg(null), 4000);
  }

  async function handleDistributeAll() {
    setDistributing(true);
    setMsg(null);
    const result = await distributeDailyAllAction();
    if (result.error) {
      setMsg({ type: "error", text: result.error });
    } else {
      setMsg({
        type: "success",
        text: `${result.sessionCount} seans, toplam ${result.totalStudents} öğrenci ${result.vehicleCount ?? workingVehicleIds.length} çalışan araca dağıtıldı.`,
      });
    }
    await loadData();
    onRefresh();
    setDistributing(false);
    setTimeout(() => setMsg(null), 5000);
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
        <h2 className="text-base font-semibold text-white mb-3">Günlük Dağıtım</h2>
        <p className="text-sm text-gray-500 text-center py-8">
          Önce seans tanımlayın ve programa öğrenci ekleyin.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white">Günlük Dağıtım</h2>
        <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
          {todayLabel}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Bugünün programına göre tüm seansları araçlara dağıtın
      </p>

      {/* Bugünün seans özeti */}
      <div className="mb-4 p-4 bg-dark-700 rounded-xl border border-dark-500">
        <p className="text-xs font-medium text-gray-500 mb-2">Bugünün Programı</p>
        <div className="space-y-1.5">
          {sessions.map((s) => {
            const count = getSessionStudentCount(s);
            return (
              <div key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.type === "pickup" ? "bg-green-400" : "bg-blue-400"}`} />
                  <span className="text-sm text-gray-300">{s.label}</span>
                </div>
                <span className="text-xs text-gray-500">{count} öğrenci</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-dark-500 flex justify-between">
          <span className="text-xs text-gray-500">Toplam (tekrarsız seans bazlı)</span>
          <span className="text-xs font-medium text-white">{totalStudentsToday}</span>
        </div>
      </div>

      {/* Bugün çalışan şoförler */}
      {vehicles.length > 0 && (
        <div className="mb-4 p-4 bg-dark-700 rounded-xl border border-dark-500">
          <p className="text-xs font-medium text-gray-400 mb-1">Bugün çalışan şoförler</p>
          <p className="text-xs text-gray-600 mb-3">
            Sadece işaretlediğiniz araçlara öğrenci dağıtılır. Her gün için ayrı kaydedilir; ilk kez açıyorsanız tümü seçilidir.
          </p>
          <div className="space-y-2">
            {vehicles.map((v) => (
              <label
                key={v.id}
                className="flex items-center gap-3 cursor-pointer rounded-lg border border-dark-500 bg-dark-800/80 px-3 py-2.5 hover:bg-dark-800 transition"
              >
                <input
                  type="checkbox"
                  checked={workingVehicleIds.includes(v.id)}
                  onChange={() => void toggleWorkingVehicle(v.id)}
                  className="w-4 h-4 rounded border-dark-400 text-accent focus:ring-accent"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{v.driverName}</p>
                  <p className="text-xs text-gray-500 font-mono">{v.plate}</p>
                </div>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void selectAllWorkingVehicles()}
            className="mt-3 text-xs font-medium text-accent hover:text-accent-hover"
          >
            Tümünü çalışıyor olarak işaretle
          </button>
        </div>
      )}

      {/* Dağıt / Geri al */}
      {vehicles.length > 0 ? (
        <div className="flex flex-col gap-2 mb-4">
          <button
            onClick={handleDistributeAll}
            disabled={distributing || undoing || totalStudentsToday === 0 || workingVehicleIds.length === 0}
            className="w-full px-4 py-3 text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {distributing ? "Dağıtılıyor..." : "Günü Dağıt"}
          </button>
          {hasSavedDistribution && (
            <button
              type="button"
              onClick={handleUndoDistribution}
              disabled={distributing || undoing}
              className="w-full px-4 py-3 text-sm font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              {undoing ? "Geri alınıyor..." : "Dağıtımı Geri Al"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-600 text-center mb-4">Araç tanımlayın ve programı hazırlayın.</p>
      )}

      {msg && (
        <div className={`rounded-xl p-3 mb-4 text-sm text-center ${
          msg.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"
        }`}>
          {msg.text}
        </div>
      )}

      {/* Dağıtım sonucu + manuel düzenleme */}
      {distribution && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Dağıtım Sonucu</p>
            <p className="text-xs text-gray-600">
              Öğrenciyi sürükleyerek başka araca taşıyın; aynı araçta sırayı değiştirmek için sürükleyip başka öğrencinin üstüne bırakın veya ↑↓ kullanın. Kaldır bu seanstaki atamayı siler (programdan silmez).
            </p>
          </div>
          {sessions.map((session) => {
            const sessionDist = distribution[session.id];
            if (!sessionDist || sessionDist.studentAssignments.length === 0) return null;

            const gridVehicles = vehiclesForSessionEdit(session);
            const buckets = assignmentsToBuckets(sessionDist.studentAssignments, vehicles);
            const saving = savingSessionId === session.id;

            return (
              <div key={session.id} className="border border-dark-500 rounded-xl overflow-hidden">
                <div className={`px-4 py-2.5 flex items-center justify-between ${
                  session.type === "pickup" ? "bg-green-500/5 border-b border-green-500/10" : "bg-blue-500/5 border-b border-blue-500/10"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      session.type === "pickup" ? "bg-green-500/15 text-green-400" : "bg-blue-500/15 text-blue-400"
                    }`}>
                      {session.time}
                    </span>
                    <span className="text-sm font-medium text-white">{session.label}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {sessionDist.studentAssignments.length} öğrenci
                    {saving ? " • kaydediliyor..." : ""}
                  </span>
                </div>

                <div className="p-3 grid gap-3 md:grid-cols-2">
                  {gridVehicles.map((v) => {
                    const ids = buckets[v.id] ?? [];
                    const overCap = ids.length > v.capacity;
                    return (
                      <div
                        key={v.id}
                        className={`rounded-xl border p-3 min-h-[100px] transition-colors ${
                          overCap ? "border-amber-600/50 bg-amber-500/5" : "border-dark-400 bg-dark-700/50"
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          void handleDropOnVehicle(session.id, v.id, null);
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-300">{getVehicleName(v.id)}</span>
                          <span className={`text-xs font-semibold ${overCap ? "text-amber-400" : "text-accent"}`}>
                            {ids.length} / {v.capacity}
                          </span>
                        </div>
                        {overCap && (
                          <p className="text-[10px] text-amber-400/90 mb-2">Kapasite aşımı (manuel onay)</p>
                        )}
                        <ul className="space-y-1.5">
                          {ids.map((studentId, idx) => (
                            <li
                              key={studentId}
                              draggable={!saving}
                              onDragStart={(e) => handleDragStart(session.id, studentId, e)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = "move";
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleDropOnVehicle(session.id, v.id, studentId);
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-dark-500 bg-dark-800 px-2 py-2 text-sm cursor-grab active:cursor-grabbing"
                            >
                              <span className="text-[10px] font-bold text-accent w-5 text-center shrink-0">{idx + 1}</span>
                              <span className="flex-1 min-w-0 truncate text-gray-200">{getStudentName(studentId)}</span>
                              <div className="flex items-center shrink-0 gap-0.5">
                                <button
                                  type="button"
                                  disabled={saving || idx === 0}
                                  onClick={() => void handleMoveInVehicle(session.id, v.id, studentId, "up")}
                                  className="p-1 rounded text-gray-500 hover:text-accent disabled:opacity-20"
                                  title="Yukarı"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  disabled={saving || idx >= ids.length - 1}
                                  onClick={() => void handleMoveInVehicle(session.id, v.id, studentId, "down")}
                                  className="p-1 rounded text-gray-500 hover:text-accent disabled:opacity-20"
                                  title="Aşağı"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => {
                                    if (window.confirm("Bu öğrenciyi bu seansın dağıtımından kaldırmak istiyor musunuz?")) {
                                      void handleRemoveFromSession(session.id, studentId);
                                    }
                                  }}
                                  className="p-1 rounded text-red-400/80 hover:bg-red-500/15"
                                  title="Kaldır"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {ids.length === 0 && (
                          <p className="text-xs text-gray-600 text-center py-4">Boş — öğrenci sürükleyin</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
