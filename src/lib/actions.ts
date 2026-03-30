"use server";

import {
  getStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  toggleStudentActive,
  setAllStudentsActive,
  setAllStudentsActiveByVehicle,
  assignStudentToVehicle,
  reorderStudent,
  generateRouteLink,
  getSchool,
  updateSchool,
  getVehicles,
  getVehicleBySlug,
  addVehicle,
  updateVehicle,
  deleteVehicle,
  getStudentsByVehicle,
  autoDistributeStudents,
  getSessions,
  addSession as storeAddSession,
  updateSession as storeUpdateSession,
  deleteSession as storeDeleteSession,
  loadSession as storeLoadSession,
  getCurrentSession,
  getWeeklySchedule,
  setWeeklyScheduleDay,
  getWeeklyScheduleForDay,
  getWorkingVehicleIdsForDay,
  setWorkingVehicleIdsForDay as storeSetWorkingVehicleIdsForDay,
  isVehicleWorkingToday,
  distributeDailyAll as storeDistributeDailyAll,
  getDailyDistribution,
  clearDailyDistribution as storeClearDailyDistribution,
  updateDailyDistributionSession,
  getSessionDistribution,
  generateRouteLinkForSession,
  type SessionDistributionAssignment,
} from "./store";
import { parseMapsUrl } from "./parse-maps-url";
import { RouteMode } from "./types";
import { revalidatePath } from "next/cache";

// --- Students ---

export async function fetchStudents() {
  return getStudents();
}

export async function fetchStudentsByVehicle(vehicleId: string) {
  return getStudentsByVehicle(vehicleId);
}

export async function createStudent(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const label = (formData.get("label") as string)?.trim();
  const mapsUrl = (formData.get("mapsUrl") as string)?.trim();
  const vehicleId = (formData.get("vehicleId") as string)?.trim() || null;
  const sessionIds = formData.getAll("sessionIds") as string[];

  if (!name || !label || !mapsUrl) {
    return { error: "Tüm alanlar zorunludur." };
  }

  const parsed = await parseMapsUrl(mapsUrl);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const contact1Name = (formData.get("contact1Name") as string)?.trim() || "";
  const contact1Phone = (formData.get("contact1Phone") as string)?.trim() || "";
  const contact2Name = (formData.get("contact2Name") as string)?.trim() || "";
  const contact2Phone = (formData.get("contact2Phone") as string)?.trim() || "";

  addStudent({
    name,
    label,
    lat: parsed.coords.lat,
    lng: parsed.coords.lng,
    mapsUrl: parsed.resolvedUrl,
    vehicleId,
    sessionIds,
    contact1Name,
    contact1Phone,
    contact2Name,
    contact2Phone,
  });

  revalidatePath("/");
  return { success: true };
}

export async function editStudent(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const label = (formData.get("label") as string)?.trim();
  const mapsUrl = (formData.get("mapsUrl") as string)?.trim();
  const vehicleId = (formData.get("vehicleId") as string)?.trim() || null;
  const sessionIds = formData.getAll("sessionIds") as string[];

  if (!name || !label || !mapsUrl) {
    return { error: "Tüm alanlar zorunludur." };
  }

  const parsed = await parseMapsUrl(mapsUrl);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const contact1Name = (formData.get("contact1Name") as string)?.trim() || "";
  const contact1Phone = (formData.get("contact1Phone") as string)?.trim() || "";
  const contact2Name = (formData.get("contact2Name") as string)?.trim() || "";
  const contact2Phone = (formData.get("contact2Phone") as string)?.trim() || "";

  const result = updateStudent(id, {
    name,
    label,
    lat: parsed.coords.lat,
    lng: parsed.coords.lng,
    mapsUrl: parsed.resolvedUrl,
    vehicleId,
    sessionIds,
    contact1Name,
    contact1Phone,
    contact2Name,
    contact2Phone,
  });

  if (!result) return { error: "Öğrenci bulunamadı." };

  revalidatePath("/");
  return { success: true };
}

export async function removeStudent(formData: FormData) {
  const id = formData.get("id") as string;
  deleteStudent(id);
  revalidatePath("/");
  return { success: true };
}

export async function toggleActive(formData: FormData) {
  const id = formData.get("id") as string;
  toggleStudentActive(id);
  revalidatePath("/");
  return { success: true };
}

export async function setAllActive(active: boolean, vehicleId?: string) {
  if (vehicleId) {
    setAllStudentsActiveByVehicle(vehicleId, active);
  } else {
    setAllStudentsActive(active);
  }
  revalidatePath("/");
  return { success: true };
}

export async function assignVehicle(studentId: string, vehicleId: string | null) {
  assignStudentToVehicle(studentId, vehicleId);
  revalidatePath("/");
  return { success: true };
}

export async function moveStudent(formData: FormData) {
  const id = formData.get("id") as string;
  const direction = formData.get("direction") as "up" | "down";
  reorderStudent(id, direction);
  revalidatePath("/");
  return { success: true };
}

// --- School ---

export async function fetchSchool() {
  return getSchool();
}

export async function saveSchool(formData: FormData) {
  const label = (formData.get("label") as string)?.trim();
  const mapsUrl = (formData.get("mapsUrl") as string)?.trim();

  if (!label || !mapsUrl) {
    return { error: "Tüm alanlar zorunludur." };
  }

  const parsed = await parseMapsUrl(mapsUrl);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  updateSchool({
    label,
    lat: parsed.coords.lat,
    lng: parsed.coords.lng,
    mapsUrl: parsed.resolvedUrl,
  });

  revalidatePath("/");
  return { success: true };
}

// --- Vehicles ---

export async function fetchVehicles() {
  return getVehicles();
}

export async function fetchVehicleBySlug(slug: string) {
  return getVehicleBySlug(slug);
}

export async function createVehicle(formData: FormData) {
  const driverName = (formData.get("driverName") as string)?.trim();
  const plate = (formData.get("plate") as string)?.trim();
  const capacityStr = (formData.get("capacity") as string)?.trim();

  if (!driverName || !plate) {
    return { error: "Şoför adı ve plaka zorunludur." };
  }

  const capacity = parseInt(capacityStr || "15", 10);
  if (isNaN(capacity) || capacity < 1) {
    return { error: "Kapasite geçerli bir sayı olmalıdır." };
  }

  const vehicle = addVehicle({ driverName, plate, capacity });
  revalidatePath("/");
  return { success: true, vehicle };
}

export async function editVehicle(formData: FormData) {
  const id = formData.get("id") as string;
  const driverName = (formData.get("driverName") as string)?.trim();
  const plate = (formData.get("plate") as string)?.trim();
  const capacityStr = (formData.get("capacity") as string)?.trim();

  if (!driverName || !plate) {
    return { error: "Şoför adı ve plaka zorunludur." };
  }

  const capacity = parseInt(capacityStr || "15", 10);
  if (isNaN(capacity) || capacity < 1) {
    return { error: "Kapasite geçerli bir sayı olmalıdır." };
  }

  const result = updateVehicle(id, { driverName, plate, capacity });
  if (!result) return { error: "Araç bulunamadı." };

  revalidatePath("/");
  return { success: true };
}

export async function removeVehicle(formData: FormData) {
  const id = formData.get("id") as string;
  deleteVehicle(id);
  revalidatePath("/");
  return { success: true };
}

// --- Sessions ---

export async function fetchSessions() {
  return getSessions();
}

export async function fetchCurrentSession() {
  return getCurrentSession();
}

export async function createSession(input: { label: string; time: string; type: "pickup" | "dropoff"; studentIds: string[] }) {
  const session = storeAddSession(input);
  revalidatePath("/");
  return { success: true, session };
}

export async function editSession(id: string, updates: { label?: string; time?: string; type?: "pickup" | "dropoff"; studentIds?: string[] }) {
  const result = storeUpdateSession(id, updates);
  if (!result) return { error: "Seans bulunamadı." };
  revalidatePath("/");
  return { success: true };
}

export async function removeSession(id: string) {
  storeDeleteSession(id);
  revalidatePath("/");
  return { success: true };
}

export async function activateSession(sessionId: string) {
  const result = storeLoadSession(sessionId);
  revalidatePath("/");
  return result;
}

// --- Weekly Schedule ---

export async function fetchWeeklySchedule() {
  return getWeeklySchedule();
}

export async function fetchWeeklyScheduleForDay(day: string) {
  return getWeeklyScheduleForDay(day);
}

export async function updateWeeklyScheduleDay(day: string, sessionId: string, studentIds: string[]) {
  setWeeklyScheduleDay(day, sessionId, studentIds);
  revalidatePath("/");
  return { success: true };
}

// --- Bugün çalışan araçlar ---

export async function fetchWorkingVehicleIdsForDay(dayKey: string) {
  return getWorkingVehicleIdsForDay(dayKey);
}

export async function setWorkingVehicleIdsForDayAction(dayKey: string, vehicleIds: string[]) {
  const result = storeSetWorkingVehicleIdsForDay(dayKey, vehicleIds);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/sofor", "layout");
  return result;
}

export async function fetchVehicleWorkingToday(vehicleId: string) {
  return isVehicleWorkingToday(vehicleId);
}

// --- Daily Full Distribution ---

export async function distributeDailyAllAction() {
  const result = storeDistributeDailyAll();
  revalidatePath("/");
  return result;
}

export async function fetchDailyDistribution() {
  return getDailyDistribution();
}

export async function clearDailyDistributionAction() {
  storeClearDailyDistribution();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/sofor", "layout");
  return { success: true as const };
}

export async function updateDailyDistributionSessionAction(
  sessionId: string,
  assignments: SessionDistributionAssignment[]
) {
  const result = updateDailyDistributionSession(sessionId, assignments);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/sofor", "layout");
  return result;
}

export async function fetchSessionDistribution(sessionId: string, vehicleId: string) {
  return getSessionDistribution(sessionId, vehicleId);
}

export async function getRouteLinkForSession(sessionId: string, vehicleId: string) {
  return generateRouteLinkForSession(sessionId, vehicleId);
}

// --- Auto Distribution (legacy) ---

export async function autoDistribute() {
  const result = autoDistributeStudents();
  revalidatePath("/");
  return result;
}

// --- Route ---

export async function getRouteLink(mode: RouteMode, vehicleId?: string) {
  return generateRouteLink(mode, vehicleId);
}
