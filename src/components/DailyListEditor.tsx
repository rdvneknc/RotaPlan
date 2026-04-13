"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Student, Vehicle, Session, DailyDistribution, DistributionGroup } from "@/lib/types";
import {
  clearDailyDistributionAction,
  distributeDailyAllAction,
  fetchDailyDistribution,
  fetchDistributionDayKeysWithData,
  fetchWeeklyScheduleForDay,
  fetchWorkingVehicleIdsForDay,
  setWorkingVehicleIdsForDayAction,
  updateDailyDistributionGroupAction,
  fetchVehicleCountSuggestion,
} from "@/lib/actions";
import type { VehicleCountSuggestion } from "@/lib/optimizer";

interface Props {
  schoolId: string;
  students: Student[];
  vehicles: Vehicle[];
  sessions: Session[];
  onRefresh: () => void;
}

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

function getSortedGroups(distribution: DailyDistribution): { groupId: string; group: DistributionGroup }[] {
  return Object.entries(distribution)
    .map(([groupId, group]) => ({ groupId, group }))
    .sort((a, b) => {
      const ta = a.group.time.localeCompare(b.group.time);
      if (ta !== 0) return ta;
      return a.group.type === "pickup" ? -1 : 1;
    });
}

function CollapsibleBlock({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 rounded-xl border border-dark-500 bg-dark-700/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-dark-600/50 transition"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{title}</p>
          {summary && !open && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{summary}</p>
          )}
        </div>
        <svg
          className={`w-5 h-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-dark-500/80 space-y-3">{children}</div>
      )}
    </div>
  );
}

export default function DailyListEditor({ schoolId, students, vehicles, sessions, onRefresh }: Props) {
  const [distributing, setDistributing] = useState<false | "day" | "week">(false);
  const [undoing, setUndoing] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [distribution, setDistribution] = useState<DailyDistribution | null>(null);
  const [distDayKeys, setDistDayKeys] = useState<string[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<{ [sessionId: string]: string[] }>({});
  const [workingVehicleIds, setWorkingVehicleIds] = useState<string[]>([]);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<VehicleCountSuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const dragRef = useRef<{ groupId: string; studentId: string } | null>(null);

  const todayKey = String(new Date().getDay());
  const todayLabel = DAY_LABELS[todayKey] || "Bugün";

  const loadSuggestion = useCallback(async () => {
    setSuggestionLoading(true);
    try {
      const s = await fetchVehicleCountSuggestion(schoolId, todayKey);
      setSuggestion(s);
    } catch {
      setSuggestion(null);
    } finally {
      setSuggestionLoading(false);
    }
  }, [schoolId, todayKey]);

  const loadData = useCallback(async () => {
    const [dist, sched, working, dayKeys] = await Promise.all([
      fetchDailyDistribution(schoolId),
      fetchWeeklyScheduleForDay(schoolId, todayKey),
      fetchWorkingVehicleIdsForDay(schoolId, todayKey),
      fetchDistributionDayKeysWithData(schoolId),
    ]);
    setDistribution(dist);
    setTodaySchedule(sched);
    setWorkingVehicleIds(working);
    setDistDayKeys(dayKeys);
  }, [schoolId, todayKey]);

  useEffect(() => {
    loadData();
    loadSuggestion();
  }, [loadData, loadSuggestion]);

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

  const totalStudentsToday = (() => {
    const unique = new Set<string>();
    for (const s of sessions) {
      const ids = todaySchedule[s.id] ?? s.studentIds;
      ids.forEach((id) => unique.add(id));
    }
    return unique.size;
  })();

  const hasSavedDistribution = distribution != null;

  function vehiclesForGroupEdit(group: DistributionGroup): Vehicle[] {
    const assigned = new Set<string>();
    for (const a of group.studentAssignments) assigned.add(a.vehicleId);
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
    const r = await setWorkingVehicleIdsForDayAction(schoolId, todayKey, next);
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
    await setWorkingVehicleIdsForDayAction(schoolId, todayKey, all);
    onRefresh();
  }

  async function persistGroupAssignments(groupId: string, assignments: Assignment[]) {
    setSavingGroupId(groupId);
    setMsg(null);
    const result = await updateDailyDistributionGroupAction(schoolId, groupId, assignments);
    if (result.error) {
      setMsg({ type: "error", text: result.error });
    } else {
      setMsg({ type: "success", text: "Dağıtım güncellendi." });
      setTimeout(() => setMsg(null), 3000);
    }
    await loadData();
    onRefresh();
    setSavingGroupId(null);
  }

  function handleDragStart(groupId: string, studentId: string, e: React.DragEvent) {
    dragRef.current = { groupId, studentId };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", studentId);
  }

  function handleDragEnd() {
    dragRef.current = null;
  }

  async function handleDropOnVehicle(groupId: string, targetVehicleId: string, beforeStudentId: string | null) {
    const payload = dragRef.current;
    if (!payload || payload.groupId !== groupId || !distribution?.[groupId]) return;

    const studentId = payload.studentId;
    const assignments = distribution[groupId].studentAssignments;
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

    await persistGroupAssignments(groupId, bucketsToAssignments(buckets));
    handleDragEnd();
  }

  async function handleRemoveFromGroup(groupId: string, studentId: string) {
    if (!distribution?.[groupId]) return;
    const assignments = distribution[groupId].studentAssignments.filter((a) => a.studentId !== studentId);
    await persistGroupAssignments(groupId, assignments);
  }

  async function handleMoveInVehicle(groupId: string, vehicleId: string, studentId: string, dir: "up" | "down") {
    if (!distribution?.[groupId]) return;
    const buckets = assignmentsToBuckets(distribution[groupId].studentAssignments, vehicles);
    const list = [...(buckets[vehicleId] ?? [])];
    const idx = list.indexOf(studentId);
    if (idx === -1) return;
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    buckets[vehicleId] = list;
    await persistGroupAssignments(groupId, bucketsToAssignments(buckets));
  }

  async function handleUndoDistribution() {
    if (!hasSavedDistribution) return;
    if (!window.confirm("Bugünün dağıtımı silinecek. Şoför panellerinde bugünkü atamalar kalkacak. Devam edilsin mi?")) return;
    setUndoing(true);
    setMsg(null);
    await clearDailyDistributionAction(schoolId, "today");
    await loadData();
    onRefresh();
    setMsg({ type: "success", text: "Bugünün dağıtımı geri alındı." });
    setUndoing(false);
    setTimeout(() => setMsg(null), 4000);
  }

  async function handleUndoAllWeek() {
    if (distDayKeys.length === 0) return;
    if (!window.confirm("Haftanın tüm günleri için kayıtlı dağıtımlar silinecek. Emin misiniz?")) return;
    setUndoing(true);
    setMsg(null);
    await clearDailyDistributionAction(schoolId, "all");
    await loadData();
    onRefresh();
    setMsg({ type: "success", text: "Tüm günlerin dağıtımı temizlendi." });
    setUndoing(false);
    setTimeout(() => setMsg(null), 4000);
  }

  async function handleDistribute(scope: "day" | "week") {
    setDistributing(scope);
    setMsg(null);
    const result = await distributeDailyAllAction(schoolId, scope);
    if (result.error) {
      setMsg({ type: "error", text: result.error });
    } else if (result.scope === "week") {
      setMsg({
        type: "success",
        text: `Haftalık dağıtım tamamlandı. ${result.daysProcessed ?? 0} günde toplam ${result.groupCount ?? 0} grup oluşturuldu.`,
      });
    } else {
      setMsg({
        type: "success",
        text: `${result.groupCount} grup, toplam ${result.uniqueStudents} öğrenci ${result.vehicleCount} araca dağıtıldı.`,
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
          Önce ders saatleri tanımlayın ve programa öğrenci ekleyin.
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
        Sadece bugün veya tüm hafta (Pazartesi–Pazar) için programı araçlara dağıtın. Şoför paneli her zaman yalnızca bugünün dağıtımını gösterir.
      </p>

      <CollapsibleBlock
        title="Bugünün Ders Saatleri"
        summary={`${sessions.length} saat · ${totalStudentsToday} tekil öğrenci`}
        defaultOpen={false}
      >
        <div className="space-y-1.5">
          {sessions.map((s) => {
            const count = getSessionStudentCount(s);
            return (
              <div key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-sm text-gray-300">{s.label}</span>
                </div>
                <span className="text-xs text-gray-500">{count} öğrenci</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-dark-500 flex justify-between">
          <span className="text-xs text-gray-500">Tekil öğrenci</span>
          <span className="text-xs font-medium text-white">{totalStudentsToday}</span>
        </div>
      </CollapsibleBlock>

      {vehicles.length > 0 && (
        <CollapsibleBlock
          title="Bugün çalışan şoförler"
          summary={`${workingVehicleIds.length} / ${vehicles.length} araç seçili`}
          defaultOpen={false}
        >
          <p className="text-xs text-gray-600 mb-3">
            Sadece işaretlediğiniz araçlara öğrenci dağıtılır. Her gün için ayrı kaydedilir; ilk kez açıyorsanız tümü seçilidir. Haftalık dağıtırken her gün kendi listesi kullanılır.
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
        </CollapsibleBlock>
      )}

      {/* Araç önerisi */}
      {suggestion && suggestion.studentCount > 0 && suggestion.simulations.length > 1 && (
        <CollapsibleBlock
          title="Araç Sayısı Önerisi"
          summary={`${suggestion.recommended} araç önerilir`}
          defaultOpen={false}
        >
          <div className="space-y-2">
            <p className="text-xs text-gray-400">
              Bugün <span className="text-white font-medium">{suggestion.studentCount}</span> öğrenci,{" "}
              <span className="text-white font-medium">{suggestion.totalVehicles}</span> araç mevcut.
              Coğrafi dağılıma göre{" "}
              <span className="text-accent font-semibold">{suggestion.recommended} araç</span> önerilir.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-dark-500 text-gray-500">
                    <th className="py-1 pr-2">Araç</th>
                    <th className="py-1 pr-2">En uzun rota</th>
                    <th className="py-1">Toplam rota</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestion.simulations
                    .filter((s) => s.maxRouteKm < Infinity)
                    .map((s) => (
                      <tr
                        key={s.vehicleCount}
                        className={`border-b border-dark-600 ${
                          s.vehicleCount === suggestion.recommended
                            ? "bg-accent/10 text-accent"
                            : "text-gray-300"
                        }`}
                      >
                        <td className="py-1.5 pr-2 font-medium">{s.vehicleCount} araç</td>
                        <td className="py-1.5 pr-2 font-mono">{s.maxRouteKm.toFixed(1)} km</td>
                        <td className="py-1.5 font-mono">{s.totalRouteKm.toFixed(1)} km</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-600 mt-1">
              Kuş uçuşu mesafe tahminidir. Gerçek sürüş mesafesi trafik ve yol durumuna göre değişir.
            </p>
          </div>
        </CollapsibleBlock>
      )}
      {suggestionLoading && vehicles.length > 0 && totalStudentsToday > 0 && (
        <div className="text-xs text-gray-500 text-center py-2 animate-pulse">Araç önerisi hesaplanıyor...</div>
      )}

      {/* Dağıt / Geri al */}
      {vehicles.length > 0 ? (
        <div className="flex flex-col gap-2 mb-4">
          <button
            type="button"
            onClick={() => void handleDistribute("day")}
            disabled={distributing !== false || undoing || totalStudentsToday === 0 || workingVehicleIds.length === 0}
            className="w-full px-4 py-3 text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {distributing === "day" ? "Dağıtılıyor..." : "Günü Dağıt"}
          </button>
          <button
            type="button"
            onClick={() => void handleDistribute("week")}
            disabled={distributing !== false || undoing}
            className="w-full px-4 py-3 text-sm font-semibold text-accent/85 bg-accent/10 hover:bg-accent/18 border border-accent/22 shadow-[inset_0_1px_0_0_rgba(245,183,49,0.07)] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {distributing === "week" ? "Hafta dağıtılıyor..." : "Haftayı Dağıt"}
          </button>
          {hasSavedDistribution && (
            <button
              type="button"
              onClick={handleUndoDistribution}
              disabled={distributing !== false || undoing}
              className="w-full px-4 py-3 text-sm font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              {undoing ? "Geri alınıyor..." : "Bugünün dağıtımını geri al"}
            </button>
          )}
          {distDayKeys.length > 0 && (
            <button
              type="button"
              onClick={handleUndoAllWeek}
              disabled={distributing !== false || undoing}
              className="w-full px-4 py-3 text-sm font-semibold text-rose-100 bg-rose-950/55 hover:bg-rose-900/60 border border-rose-500/35 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Tüm haftanın dağıtımını sil ({distDayKeys.length} gün)
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
      {distribution && Object.keys(distribution).length > 0 && (
        <CollapsibleBlock
          title="Dağıtım Sonucu"
          summary={`${getSortedGroups(distribution).filter((g) => g.group.studentAssignments.length > 0).length} aktif grup`}
          defaultOpen
        >
          <p className="text-xs text-gray-600">
            Öğrenciyi sürükleyerek başka araca taşıyın; ↑↓ ile sıra değiştirin. Kaldır bu gruptaki atamayı siler.
          </p>
          {getSortedGroups(distribution).map(({ groupId, group }) => {
            if (group.studentAssignments.length === 0) return null;

            const gridVehicles = vehiclesForGroupEdit(group);
            const buckets = assignmentsToBuckets(group.studentAssignments, vehicles);
            const saving = savingGroupId === groupId;
            const isPickup = group.type === "pickup";

            return (
              <div key={groupId} className="border border-dark-500 rounded-xl overflow-hidden">
                <div className={`px-4 py-2.5 flex items-center justify-between ${
                  isPickup ? "bg-green-500/5 border-b border-green-500/10" : "bg-blue-500/5 border-b border-blue-500/10"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      isPickup ? "bg-green-500/15 text-green-400" : "bg-blue-500/15 text-blue-400"
                    }`}>
                      {group.time}
                    </span>
                    <span className="text-sm font-medium text-white">{group.label}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {group.studentAssignments.length} öğrenci
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
                          void handleDropOnVehicle(groupId, v.id, null);
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
                              onDragStart={(e) => handleDragStart(groupId, studentId, e)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = "move";
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleDropOnVehicle(groupId, v.id, studentId);
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-dark-500 bg-dark-800 px-2 py-2 text-sm cursor-grab active:cursor-grabbing"
                            >
                              <span className="text-[10px] font-bold text-accent w-5 text-center shrink-0">{idx + 1}</span>
                              <span className="flex-1 min-w-0 truncate text-gray-200">{getStudentName(studentId)}</span>
                              <div className="flex items-center shrink-0 gap-0.5">
                                <button
                                  type="button"
                                  disabled={saving || idx === 0}
                                  onClick={() => void handleMoveInVehicle(groupId, v.id, studentId, "up")}
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
                                  onClick={() => void handleMoveInVehicle(groupId, v.id, studentId, "down")}
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
                                    if (window.confirm("Bu öğrenciyi bu grubun dağıtımından kaldırmak istiyor musunuz?")) {
                                      void handleRemoveFromGroup(groupId, studentId);
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
        </CollapsibleBlock>
      )}
    </div>
  );
}
