"use client";

import { useState, useEffect, useCallback } from "react";
import { Student, Vehicle, Session } from "@/lib/types";
import { distributeDailyAllAction, fetchDailyDistribution, fetchWeeklyScheduleForDay } from "@/lib/actions";

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

const DAY_LABELS: { [key: string]: string } = {
  "0": "Pazar", "1": "Pazartesi", "2": "Salı", "3": "Çarşamba",
  "4": "Perşembe", "5": "Cuma", "6": "Cumartesi",
};

export default function DailyListEditor({ students, vehicles, sessions, onRefresh }: Props) {
  const [distributing, setDistributing] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [distribution, setDistribution] = useState<DailyDist | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<{ [sessionId: string]: string[] }>({});

  const todayKey = String(new Date().getDay());
  const todayLabel = DAY_LABELS[todayKey] || "Bugün";

  const loadData = useCallback(async () => {
    const [dist, sched] = await Promise.all([
      fetchDailyDistribution(),
      fetchWeeklyScheduleForDay(todayKey),
    ]);
    setDistribution(dist);
    setTodaySchedule(sched);
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

  async function handleDistributeAll() {
    setDistributing(true);
    setMsg(null);
    const result = await distributeDailyAllAction();
    if (result.error) {
      setMsg({ type: "error", text: result.error });
    } else {
      setMsg({ type: "success", text: `${result.sessionCount} seans, toplam ${result.totalStudents} öğrenci ${vehicles.length} araca dağıtıldı.` });
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

      {/* Dağıt butonu */}
      {vehicles.length > 0 ? (
        <button
          onClick={handleDistributeAll}
          disabled={distributing || totalStudentsToday === 0}
          className="w-full px-4 py-3 text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2 mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {distributing ? "Dağıtılıyor..." : "Günü Dağıt"}
        </button>
      ) : (
        <p className="text-xs text-gray-600 text-center mb-4">Araç tanımlayın ve programı hazırlayın.</p>
      )}

      {msg && (
        <div className={`rounded-xl p-3 mb-4 text-sm text-center ${
          msg.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {msg.text}
        </div>
      )}

      {/* Dağıtım sonucu */}
      {distribution && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Dağıtım Sonucu</p>
          {sessions.map((session) => {
            const sessionDist = distribution[session.id];
            if (!sessionDist || sessionDist.studentAssignments.length === 0) return null;

            const byVehicle = new Map<string, { studentId: string; order: number }[]>();
            for (const a of sessionDist.studentAssignments) {
              if (!byVehicle.has(a.vehicleId)) byVehicle.set(a.vehicleId, []);
              byVehicle.get(a.vehicleId)!.push(a);
            }

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
                  <span className="text-xs text-gray-500">{sessionDist.studentAssignments.length} öğrenci</span>
                </div>
                <div className="divide-y divide-dark-600">
                  {Array.from(byVehicle.entries()).map(([vId, assignments]) => (
                    <div key={vId} className="px-4 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-400">{getVehicleName(vId)}</span>
                        <span className="text-xs text-accent font-semibold">{assignments.length} kişi</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {assignments.sort((a, b) => a.order - b.order).map((a) => (
                          <span key={a.studentId} className="px-2 py-0.5 text-xs bg-dark-600 text-gray-300 rounded border border-dark-400">
                            {getStudentName(a.studentId)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
