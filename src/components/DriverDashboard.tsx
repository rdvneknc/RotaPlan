"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Student, Vehicle, DailyDistribution, DistributionGroup } from "@/lib/types";
import { fetchDailyDistribution, fetchGroupDistribution, fetchVehicleWorkingToday, fetchDriverRouteDirections } from "@/lib/actions";
import { buildGoogleMapsDrivingDirectionsUrl } from "@/lib/google-maps-directions-url";
import { studentMapOpenUrl } from "@/lib/parse-maps-url";

const DISTRIBUTION_POLL_MS = 60_000;

function groupTimeToMinutes(timeStr: string): number | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function isGroupTimePast(group: DistributionGroup, now: Date): boolean {
  const t = groupTimeToMinutes(group.time);
  if (t === null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur > t;
}

function getSortedGroups(dist: DailyDistribution): { groupId: string; group: DistributionGroup }[] {
  return Object.entries(dist)
    .map(([groupId, group]) => ({ groupId, group }))
    .sort((a, b) => {
      const ta = a.group.time.localeCompare(b.group.time);
      if (ta !== 0) return ta;
      return a.group.type === "pickup" ? -1 : 1;
    });
}

/** Tamamlanan (bırakılan/toplanan) öğrenci id’leri — aynı cihazda bugün için hatırlanır. */
function driverCompletedStudentsKey(schoolId: string, vehicleId: string, groupId: string): string {
  const d = new Date();
  const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `rp:driverDoneStudents:v1:${schoolId}:${vehicleId}:${groupId}:${ds}`;
}

interface Props {
  schoolId: string;
  vehicle: Vehicle;
  initialDistribution: DailyDistribution | null;
  initialWorkingToday: boolean;
}

export default function DriverDashboard({ schoolId, vehicle, initialDistribution, initialWorkingToday }: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [groupStudents, setGroupStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeLink, setRouteLink] = useState<string | null>(null);
  const [routeGeoHint, setRouteGeoHint] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  /** Manuel işaret: bu grupta rota dışı bırakılan öğrenciler */
  const [completedStudentIds, setCompletedStudentIds] = useState<Set<string>>(() => new Set());
  const [distribution, setDistribution] = useState<DailyDistribution | null>(initialDistribution);
  const [workingToday, setWorkingToday] = useState(initialWorkingToday);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const selectedGroupRef = useRef(selectedGroupId);
  selectedGroupRef.current = selectedGroupId;

  const selectedGroup = distribution?.[selectedGroupId] ?? null;

  useEffect(() => {
    function tick() { setNowTick(Date.now()); }
    const id = setInterval(tick, 60_000);
    function onVisible() {
      if (document.visibilityState === "visible") tick();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  function getGroupStudentCount(groupId: string): number {
    if (!distribution || !distribution[groupId]) return 0;
    return distribution[groupId].studentAssignments
      .filter((a) => a.vehicleId === vehicle.id).length;
  }

  const totalStudentsToday = distribution
    ? Object.keys(distribution).reduce((sum, gid) => sum + getGroupStudentCount(gid), 0)
    : 0;

  const loadGroupStudents = useCallback(async (gid: string) => {
    if (!gid) {
      setGroupStudents([]);
      setCompletedStudentIds(new Set());
      return;
    }
    setLoading(true);
    const data = await fetchGroupDistribution(schoolId, gid, vehicle.id);
    setGroupStudents(data);
    try {
      const key = driverCompletedStudentsKey(schoolId, vehicle.id, gid);
      const raw = localStorage.getItem(key);
      const validIds = new Set(data.map((s) => s.id));
      let parsed: string[] = [];
      if (raw) {
        try {
          parsed = JSON.parse(raw) as string[];
          if (!Array.isArray(parsed)) parsed = [];
        } catch {
          parsed = [];
        }
      }
      const kept = parsed.filter((id) => validIds.has(id));
      if (kept.length !== parsed.length) {
        if (kept.length) localStorage.setItem(key, JSON.stringify(kept));
        else localStorage.removeItem(key);
      }
      setCompletedStudentIds(new Set(kept));
    } catch {
      setCompletedStudentIds(new Set());
    }
    setLoading(false);
  }, [schoolId, vehicle.id]);

  const syncDistribution = useCallback(async () => {
    const [next, working] = await Promise.all([
      fetchDailyDistribution(schoolId, vehicle.id),
      fetchVehicleWorkingToday(schoolId, vehicle.id),
    ]);
    setWorkingToday(working);
    setDistribution(next);
    if (next == null) {
      setSelectedGroupId("");
      setGroupStudents([]);
      setCompletedStudentIds(new Set());
      setRouteLink(null);
      setRouteGeoHint(null);
    } else {
      const gid = selectedGroupRef.current;
      if (gid) void loadGroupStudents(gid);
    }
  }, [schoolId, vehicle.id, loadGroupStudents]);

  useEffect(() => {
    if (selectedGroupId) {
      loadGroupStudents(selectedGroupId);
      setRouteLink(null);
      setRouteGeoHint(null);
    } else {
      setGroupStudents([]);
      setCompletedStudentIds(new Set());
      setRouteLink(null);
      setRouteGeoHint(null);
    }
  }, [selectedGroupId, loadGroupStudents]);

  function persistCompleted(gid: string, ids: Set<string>) {
    try {
      const key = driverCompletedStudentsKey(schoolId, vehicle.id, gid);
      const arr = Array.from(ids);
      if (arr.length) localStorage.setItem(key, JSON.stringify(arr));
      else localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  function toggleStudentCompleted(studentId: string) {
    setCompletedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      if (selectedGroupId) persistCompleted(selectedGroupId, next);
      return next;
    });
  }

  function clearAllCompleted() {
    setCompletedStudentIds(new Set());
    if (selectedGroupId) persistCompleted(selectedGroupId, new Set());
  }

  const remainingStopsCount = useMemo(() => {
    if (groupStudents.length === 0) return 0;
    return groupStudents.filter((s) => !completedStudentIds.has(s.id)).length;
  }, [groupStudents, completedStudentIds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileStudent(null);
    }
    if (profileStudent) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [profileStudent]);

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

  function openRouteInMaps(href: string) {
    setRouteLink(href);
    const w = window.open(href, "_blank");
    if (!w) window.location.href = href;
  }

  async function handleGenerateRoute() {
    if (!selectedGroupId) return;
    setRouteLoading(true);
    setRouteGeoHint(null);

    const exclude = groupStudents.filter((s) => completedStudentIds.has(s.id)).map((s) => s.id);
    const res = await fetchDriverRouteDirections(
      schoolId,
      selectedGroupId,
      vehicle.id,
      exclude.length > 0 ? exclude : undefined,
    );

    if (!res.ok) {
      setRouteLoading(false);
      return;
    }

    const pickupFallback = (
      destination: string,
      waypointPipe: string,
      hint?: string | null,
    ) => {
      openRouteInMaps(
        buildGoogleMapsDrivingDirectionsUrl("My+Location", destination, waypointPipe || undefined),
      );
      if (hint) setRouteGeoHint(hint);
      setRouteLoading(false);
    };

    if (res.data.mode === "dropoff") {
      openRouteInMaps(res.data.url);
      setRouteLoading(false);
      return;
    }

    const { destination, waypointPipe } = res.data;

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      pickupFallback(
        destination,
        waypointPipe,
        "Bu ortam GPS kullanmayı desteklemiyor; başlangıç yaklaşık olabilir.",
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
        openRouteInMaps(buildGoogleMapsDrivingDirectionsUrl(origin, destination, waypointPipe || undefined));
        setRouteLoading(false);
      },
      () => {
        pickupFallback(
          destination,
          waypointPipe,
          "Konum alınamadı veya izin reddedildi; yaklaşık başlangıç kullanılıyor. İzin verirseniz tam konum kullanılır.",
        );
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  const hasDistribution = distribution && Object.keys(distribution).length > 0;

  return (
    <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
            Admin panelinde bugünün çalışan şoför listesinde bu araç işaretli değil.
          </p>
        </div>
      ) : !hasDistribution ? (
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6 text-center">
          <svg className="mx-auto h-12 w-12 mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-base text-gray-500">Henüz dağıtım yapılmamış.</p>
          <p className="text-xs text-gray-600 mt-1">Admin panelinden &quot;Günü Dağıt&quot; yapıldığında gruplar burada görünecek.</p>
        </div>
      ) : (
        <>
          {/* Grup seçici */}
          <div className="bg-dark-800 rounded-2xl border border-dark-500 p-5">
            <label className="block text-xs font-medium text-gray-500 mb-1">Grup Seçin</label>
            <p className="text-[11px] text-gray-600 mb-2">Saati geçen gruplar soluk ve &quot;Geçti&quot; etiketiyle gösterilir.</p>
            <div className="space-y-2">
              {getSortedGroups(distribution!).map(({ groupId, group }) => {
                const count = getGroupStudentCount(groupId);
                const isSelected = selectedGroupId === groupId;
                const now = new Date(nowTick);
                const timePast = isGroupTimePast(group, now);
                const isPickup = group.type === "pickup";
                const baseIdle =
                  timePast && !isSelected
                    ? "border-dark-600 bg-dark-800/70 opacity-70 hover:bg-dark-700/80 hover:opacity-90"
                    : "border-dark-400 bg-dark-700 hover:bg-dark-600";
                const selectedIdle =
                  isSelected && timePast
                    ? isPickup
                      ? "border-green-500/25 bg-green-500/5 opacity-90"
                      : "border-blue-500/25 bg-blue-500/5 opacity-90"
                    : isSelected
                      ? isPickup
                        ? "border-green-500/40 bg-green-500/10"
                        : "border-blue-500/40 bg-blue-500/10"
                      : baseIdle;
                return (
                  <button
                    key={groupId}
                    onClick={() => setSelectedGroupId(isSelected ? "" : groupId)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition ${selectedIdle}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          timePast
                            ? "bg-gray-600"
                            : isPickup
                              ? "bg-green-400"
                              : "bg-blue-400"
                        }`}
                      />
                      <div className="text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium truncate ${
                            isSelected ? "text-white" : timePast ? "text-gray-500" : "text-gray-300"
                          }`}>
                            {group.label}
                          </p>
                          {timePast && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 bg-dark-600 px-1.5 py-0.5 rounded">
                              Geçti
                            </span>
                          )}
                        </div>
                        <p className={`text-xs ${timePast ? "text-gray-600" : "text-gray-500"}`}>
                          {group.time} · {isPickup ? "Evlerden Okula" : "Okuldan Evlere"}
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

          {/* Seçilen grup detayı */}
          {selectedGroup && (
            <>
              <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white">Rota Oluşturma</h2>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    selectedGroup.type === "pickup"
                      ? "bg-green-500/15 text-green-400"
                      : "bg-blue-500/15 text-blue-400"
                  }`}>
                    {selectedGroup.type === "pickup" ? "Evlerden Okula" : "Okuldan Evlere"}
                  </span>
                </div>

                <div className={`rounded-xl p-3 text-center text-sm font-medium mb-4 ${
                  selectedGroup.type === "pickup"
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                }`}>
                  {selectedGroup.type === "pickup"
                    ? "Öğrenci durakları ve okul rotası. Konum izni verirseniz başlangıç tam olarak bu cihazın GPS’idir."
                    : "Okuldan öğrencileri alıp evlerine bırakır"}
                </div>

                {groupStudents.length > 0 && (
                  <p className="text-[11px] text-gray-600 mb-4 rounded-lg border border-dark-500 bg-dark-700/40 px-3 py-2">
                    Aşağıdaki listede bitirdiğiniz öğrencilere dokunun (tiklenir). Rota yalnızca kalanlar için oluşur.
                    Otomatik algılama yok — aynı cihazda bugün için kayıtlıdır.
                  </p>
                )}

                <button
                  onClick={handleGenerateRoute}
                  disabled={routeLoading || groupStudents.length === 0 || remainingStopsCount === 0}
                  className="w-full bg-accent hover:bg-accent-hover disabled:bg-dark-600 disabled:text-gray-500 disabled:cursor-not-allowed text-dark-900 font-semibold py-4 px-6 rounded-xl text-base transition flex items-center justify-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  {routeLoading ? "Oluşturuluyor..."
                    : remainingStopsCount < groupStudents.length && groupStudents.length > 0
                      ? `Rota Oluştur (${remainingStopsCount} durak)`
                      : "Rota Oluştur"}
                </button>

                {routeGeoHint && (
                  <p className="text-xs text-amber-400/90 text-center mt-3 px-1 leading-snug">{routeGeoHint}</p>
                )}

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

                {groupStudents.length === 0 && !loading && (
                  <p className="text-xs text-gray-600 text-center mt-3">
                    Bu grupta size atanmış öğrenci yok.
                  </p>
                )}
              </div>

              <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      {selectedGroup.label} - Öğrenci Listesi
                    </h2>
                    <p className="text-[11px] text-gray-600 mt-1">
                      {selectedGroup.type === "dropoff"
                        ? "Evine bıraktığınız öğrenciye dokunun — tiklenir."
                        : "Okula topladığınız öğrenciye dokunun — tiklenir."}
                    </p>
                  </div>
                  {groupStudents.length > 0 && completedStudentIds.size > 0 && (
                    <button
                      type="button"
                      onClick={clearAllCompleted}
                      className="text-[11px] font-medium text-amber-400/90 hover:text-amber-300 shrink-0 pt-0.5"
                    >
                      İşaretleri temizle
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="text-center py-10 text-gray-500">
                    <p className="text-sm">Yükleniyor...</p>
                  </div>
                ) : groupStudents.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <p className="text-sm">Bu grupta size atanmış öğrenci yok.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {groupStudents.map((student, index) => {
                      const done = completedStudentIds.has(student.id);
                      const pinHref = studentMapOpenUrl(student);
                      return (
                        <li key={student.id} className="flex items-stretch gap-2">
                          <div
                            role="button"
                            tabIndex={0}
                            aria-pressed={done}
                            onClick={() => toggleStudentCompleted(student.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleStudentCompleted(student.id);
                              }
                            }}
                            className={`min-w-0 flex-1 flex items-center gap-3 py-3 px-3 rounded-xl border text-left cursor-pointer transition ${
                              done
                                ? "bg-emerald-500/[0.12] border-emerald-500/35 hover:bg-emerald-500/[0.16]"
                                : "bg-dark-700/40 border-dark-500 hover:bg-dark-600/50"
                            }`}
                          >
                            <span
                              className={`w-9 h-9 rounded-lg text-sm font-bold flex items-center justify-center shrink-0 ${
                                done
                                  ? "bg-emerald-500/25 text-emerald-400"
                                  : "bg-accent/10 text-accent"
                              }`}
                            >
                              {done ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                index + 1
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-base font-medium ${done ? "text-emerald-100/95" : "text-white"}`}>
                                {student.name}
                              </p>
                              <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {student.label}
                              </p>
                              {done && (
                                <p className="text-[10px] font-medium text-emerald-400/90 mt-1">
                                  {selectedGroup.type === "dropoff" ? "Bırakıldı" : "Tamamlandı"}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center shrink-0 self-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProfileStudent(student);
                              }}
                              className="p-2.5 text-gray-500 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition border border-transparent"
                              title="Öğrenci bilgileri"
                              aria-label={`${student.name} — bilgiler`}
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </button>
                            {pinHref ? (
                              <a
                                href={pinHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2.5 text-gray-500 hover:text-accent hover:bg-accent/10 rounded-lg transition border border-transparent"
                                title="Haritada Göster"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </a>
                            ) : (
                              <span
                                className="p-2.5 text-gray-600 opacity-50 cursor-not-allowed"
                                title="Konum bilgisi yok"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </>
      )}

      {profileStudent && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="driver-profile-title"
          onClick={() => setProfileStudent(null)}
        >
          <div
            className="w-full sm:max-w-md max-h-[min(90dvh,640px)] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-dark-500 bg-dark-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-dark-500 bg-dark-800/95">
              <h2 id="driver-profile-title" className="text-lg font-semibold text-white">
                Öğrenci bilgileri
              </h2>
              <button
                type="button"
                onClick={() => setProfileStudent(null)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-600 transition"
                aria-label="Kapat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">Ad Soyad</p>
                <p className="text-base text-white font-medium">{profileStudent.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">Adres</p>
                <p className="text-sm text-gray-300 leading-relaxed">{profileStudent.label || "—"}</p>
              </div>
              {(profileStudent.contact1Name || profileStudent.contact1Phone) && (
                <div className="rounded-xl border border-dark-500 bg-dark-700/40 p-4 space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">İletişim 1</p>
                  {profileStudent.contact1Name ? (
                    <p className="text-sm text-white">{profileStudent.contact1Name}</p>
                  ) : null}
                  {profileStudent.contact1Phone ? (
                    <a
                      href={`tel:${profileStudent.contact1Phone.replace(/\s/g, "")}`}
                      className="text-sm text-accent hover:underline font-medium inline-block"
                    >
                      {profileStudent.contact1Phone}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-500">Telefon yok</p>
                  )}
                </div>
              )}
              {(profileStudent.contact2Name || profileStudent.contact2Phone) && (
                <div className="rounded-xl border border-dark-500 bg-dark-700/40 p-4 space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">İletişim 2</p>
                  {profileStudent.contact2Name ? (
                    <p className="text-sm text-white">{profileStudent.contact2Name}</p>
                  ) : null}
                  {profileStudent.contact2Phone ? (
                    <a
                      href={`tel:${profileStudent.contact2Phone.replace(/\s/g, "")}`}
                      className="text-sm text-accent hover:underline font-medium inline-block"
                    >
                      {profileStudent.contact2Phone}
                    </a>
                  ) : null}
                </div>
              )}
              {!profileStudent.contact1Phone && !profileStudent.contact2Phone && !profileStudent.contact1Name && !profileStudent.contact2Name && (
                <p className="text-sm text-gray-500">Kayıtlı veli iletişim bilgisi yok.</p>
              )}
              {(() => {
                const h = studentMapOpenUrl(profileStudent);
                return h ? (
                  <a
                    href={h}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Haritada aç
                  </a>
                ) : null;
              })()}
              <button
                type="button"
                onClick={() => setProfileStudent(null)}
                className="w-full py-3 rounded-xl text-sm font-medium text-gray-300 border border-dark-500 hover:bg-dark-700 transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
