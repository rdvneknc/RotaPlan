"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Student, Vehicle, Session } from "@/lib/types";
import { fetchDailyDistribution, fetchSessionDistribution, fetchVehicleWorkingToday, getRouteLinkForSession } from "@/lib/actions";

type DailyDist = {
  [sessionId: string]: {
    studentAssignments: { studentId: string; vehicleId: string; order: number }[];
  };
};

/** Görünür sekmede ~1 dağıtım isteği/dk; liste, dağıtım güncellenince veya sekme odaklanınca yenilenir. */
const DISTRIBUTION_POLL_MS = 60_000;

/** "Geçti" seans stilini denemek için [saat, dakika] verin; normal kullanımda null. */
const DEMO_FIXED_TIME_HM: [number, number] | null = null;

function getClockNowForSessionUi(nowTick: number): Date {
  if (DEMO_FIXED_TIME_HM) {
    const d = new Date();
    d.setHours(DEMO_FIXED_TIME_HM[0], DEMO_FIXED_TIME_HM[1], 0, 0);
    return d;
  }
  return new Date(nowTick);
}

/** Seans saati (örn. 09:40) geçti mi — dakika çözünürlüğü, yerel saat. */
function sessionTimeToMinutes(timeStr: string): number | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function isSessionTimePast(session: Session, now: Date): boolean {
  const t = sessionTimeToMinutes(session.time);
  if (t === null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur > t;
}

interface Props {
  vehicle: Vehicle;
  sessions: Session[];
  initialDistribution: DailyDist | null;
  initialWorkingToday: boolean;
}

export default function DriverDashboard({ vehicle, sessions, initialDistribution, initialWorkingToday }: Props) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionStudents, setSessionStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeLink, setRouteLink] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [distribution, setDistribution] = useState<DailyDist | null>(initialDistribution);
  const [workingToday, setWorkingToday] = useState(initialWorkingToday);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const selectedSessionRef = useRef(selectedSessionId);
  selectedSessionRef.current = selectedSessionId;

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  useEffect(() => {
    if (DEMO_FIXED_TIME_HM) return;
    function tick() {
      setNowTick(Date.now());
    }
    const id = setInterval(tick, 60_000);
    function onVisible() {
      if (document.visibilityState === "visible") tick();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  function getSessionStudentCount(sessionId: string): number {
    if (!distribution || !distribution[sessionId]) return 0;
    return distribution[sessionId].studentAssignments
      .filter((a) => a.vehicleId === vehicle.id).length;
  }

  const totalStudentsToday = sessions.reduce((sum, s) => sum + getSessionStudentCount(s.id), 0);

  const loadSessionStudents = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      setSessionStudents([]);
      return;
    }
    setLoading(true);
    const data = await fetchSessionDistribution(sessionId, vehicle.id);
    setSessionStudents(data);
    setLoading(false);
  }, [vehicle.id]);

  const syncDistribution = useCallback(async () => {
    const [next, working] = await Promise.all([
      fetchDailyDistribution(),
      fetchVehicleWorkingToday(vehicle.id),
    ]);
    setWorkingToday(working);
    setDistribution(next);
    if (next == null) {
      setSelectedSessionId("");
      setSessionStudents([]);
      setRouteLink(null);
    } else {
      const sid = selectedSessionRef.current;
      if (sid) void loadSessionStudents(sid);
    }
  }, [vehicle.id, loadSessionStudents]);

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionStudents(selectedSessionId);
      setRouteLink(null);
    } else {
      setSessionStudents([]);
      setRouteLink(null);
    }
  }, [selectedSessionId, loadSessionStudents]);

  useEffect(() => {
    void syncDistribution();
    const distInterval = setInterval(() => {
      if (document.visibilityState === "visible") void syncDistribution();
    }, DISTRIBUTION_POLL_MS);

    function onBecameVisible() {
      if (document.visibilityState !== "visible") return;
      void syncDistribution();
    }

    document.addEventListener("visibilitychange", onBecameVisible);
    window.addEventListener("focus", onBecameVisible);

    return () => {
      clearInterval(distInterval);
      document.removeEventListener("visibilitychange", onBecameVisible);
      window.removeEventListener("focus", onBecameVisible);
    };
  }, [syncDistribution]);

  async function handleGenerateRoute() {
    if (!selectedSessionId) return;
    setRouteLoading(true);
    const link = await getRouteLinkForSession(selectedSessionId, vehicle.id);
    if (link) {
      setRouteLink(link);
      const w = window.open(link, "_blank");
      if (!w) window.location.href = link;
    }
    setRouteLoading(false);
  }

  const hasDistribution = distribution && Object.keys(distribution).length > 0;

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Araç bilgisi */}
      <div className="bg-dark-800 rounded-2xl border border-dark-500 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-white">{vehicle.driverName}</p>
            <p className="text-sm text-gray-500">{vehicle.plate} • Kapasite: {vehicle.capacity}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-accent">{totalStudentsToday}</p>
            <p className="text-[10px] text-gray-500 uppercase">Bugün Toplam</p>
          </div>
        </div>
      </div>

      {!workingToday ? (
        <div className="bg-dark-800 rounded-2xl border border-amber-600/30 p-6 text-center">
          <p className="text-base font-medium text-amber-300 mb-2">Bugün bu araç nöbette değil</p>
          <p className="text-sm text-gray-500">
            Admin panelinde bugünün çalışan şoför listesinde bu araç işaretli değil. Liste güncellenirse sayfa bir süre sonra yenilenir veya sayfayı yenileyin.
          </p>
        </div>
      ) : !hasDistribution ? (
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6 text-center">
          <svg className="mx-auto h-12 w-12 mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-base text-gray-500">Henüz dağıtım yapılmamış.</p>
          <p className="text-xs text-gray-600 mt-1">Admin panelinden &quot;Günü Dağıt&quot; yapıldığında seanslar burada görünecek.</p>
        </div>
      ) : (
        <>
          {/* Seans seçici */}
          <div className="bg-dark-800 rounded-2xl border border-dark-500 p-5">
            <label className="block text-xs font-medium text-gray-500 mb-1">Seans Seçin</label>
            {DEMO_FIXED_TIME_HM ? (
              <p className="text-[11px] text-amber-400/90 mb-2 rounded-lg border border-amber-600/30 bg-amber-500/10 px-2 py-1.5">
                Deneme görünümü: saat <strong className="text-amber-300">{String(DEMO_FIXED_TIME_HM[0]).padStart(2, "0")}:{String(DEMO_FIXED_TIME_HM[1]).padStart(2, "0")}</strong>{" "}
                sabit (gerçek saate dönmek için geliştiricide bu sabiti kapatın).
              </p>
            ) : (
              <p className="text-[11px] text-gray-600 mb-2">Bugünün saatine göre geçmiş seanslar soluk ve &quot;Geçti&quot; etiketiyle gösterilir.</p>
            )}
            <div className="space-y-2">
              {sessions.map((s) => {
                const count = getSessionStudentCount(s.id);
                const isSelected = selectedSessionId === s.id;
                const now = getClockNowForSessionUi(nowTick);
                const timePast = isSessionTimePast(s, now);
                const baseIdle =
                  timePast && !isSelected
                    ? "border-dark-600 bg-dark-800/70 opacity-70 hover:bg-dark-700/80 hover:opacity-90"
                    : "border-dark-400 bg-dark-700 hover:bg-dark-600";
                const selectedIdle =
                  isSelected && timePast
                    ? s.type === "pickup"
                      ? "border-green-500/25 bg-green-500/5 opacity-90"
                      : "border-blue-500/25 bg-blue-500/5 opacity-90"
                    : isSelected
                      ? s.type === "pickup"
                        ? "border-green-500/40 bg-green-500/10"
                        : "border-blue-500/40 bg-blue-500/10"
                      : baseIdle;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSessionId(isSelected ? "" : s.id)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition ${selectedIdle}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          timePast
                            ? "bg-gray-600"
                            : s.type === "pickup"
                              ? "bg-green-400"
                              : "bg-blue-400"
                        }`}
                      />
                      <div className="text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium truncate ${
                            isSelected ? "text-white" : timePast ? "text-gray-500" : "text-gray-300"
                          }`}>
                            {s.label}
                          </p>
                          {timePast && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 bg-dark-600 px-1.5 py-0.5 rounded">
                              Geçti
                            </span>
                          )}
                        </div>
                        <p className={`text-xs ${timePast ? "text-gray-600" : "text-gray-500"}`}>
                          {s.time} · {s.type === "pickup" ? "Evlerden Okula" : "Okuldan Evlere"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-semibold px-2.5 py-1 rounded-lg ${
                        count > 0
                          ? timePast && !isSelected
                            ? "text-gray-500 bg-dark-600/80"
                            : "text-accent bg-accent/10"
                          : "text-gray-600 bg-dark-600"
                      }`}>
                        {count} kişi
                      </span>
                      {isSelected && (
                        <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seçilen seans detayı */}
          {selectedSession && (
            <>
              {/* Rota Oluştur */}
              <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white">Rota Oluşturma</h2>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    selectedSession.type === "pickup"
                      ? "bg-green-500/15 text-green-400"
                      : "bg-blue-500/15 text-blue-400"
                  }`}>
                    {selectedSession.type === "pickup" ? "Evlerden Okula" : "Okuldan Evlere"}
                  </span>
                </div>

                <div className={`rounded-xl p-3 text-center text-sm font-medium mb-4 ${
                  selectedSession.type === "pickup"
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                }`}>
                  {selectedSession.type === "pickup"
                    ? "Mevcut konumunuzdan öğrencileri toplayıp okula bırakır"
                    : "Okuldan öğrencileri alıp evlerine bırakır"}
                </div>

                <button
                  onClick={handleGenerateRoute}
                  disabled={routeLoading || sessionStudents.length === 0}
                  className="w-full bg-accent hover:bg-accent-hover disabled:bg-dark-600 disabled:text-gray-500 disabled:cursor-not-allowed text-dark-900 font-semibold py-4 px-6 rounded-xl text-base transition flex items-center justify-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  {routeLoading ? "Oluşturuluyor..." : "Rota Oluştur"}
                </button>

                {routeLink && (
                  <a
                    href={routeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center mt-3 px-4 py-3 text-sm font-medium text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-xl transition"
                  >
                    Haritayı Aç
                  </a>
                )}

                {sessionStudents.length === 0 && !loading && (
                  <p className="text-xs text-gray-600 text-center mt-3">
                    Bu seansta size atanmış öğrenci yok.
                  </p>
                )}
              </div>

              {/* Öğrenci listesi */}
              <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
                <h2 className="text-base font-semibold text-white mb-4">
                  {selectedSession.label} - Öğrenci Listesi
                </h2>

                {loading ? (
                  <div className="text-center py-10 text-gray-500">
                    <p className="text-sm">Yükleniyor...</p>
                  </div>
                ) : sessionStudents.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <p className="text-sm">Bu seansta size atanmış öğrenci yok.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-dark-500">
                    {sessionStudents.map((student, index) => (
                      <li key={student.id} className="flex items-center gap-3 py-3.5">
                        <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent text-sm font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium text-white">{student.name}</p>
                          <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {student.label}
                          </p>
                        </div>
                        <a
                          href={student.mapsUrl}
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
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
