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
  getVehicleById,
  resolveDriverByUsername,
  isDriverLoginUsernameTaken,
  normalizeDriverUsername,
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
  getDistributionDayKeysWithData,
  clearDailyDistributionToday as storeClearDailyDistributionToday,
  clearAllDistributions as storeClearAllDistributions,
  updateDailyDistributionGroup,
  getGroupDistribution,
  generateRouteLinkForGroup,
  getClassDuration,
  setClassDuration as storeSetClassDuration,
  type SessionDistributionAssignment,
  getVehicleCountSuggestionForDay,
  // Registry (super-admin)
  getSchools,
  getSchoolById,
  addSchool as storeAddSchool,
  updateSchoolRegistry as storeUpdateSchoolRegistry,
  deleteSchool as storeDeleteSchool,
  getSchoolStats,
  // Users
  getUsers,
  getUsersBySchool,
  getUserByEmail,
  getUserById as storeGetUserById,
  createUser as storeCreateUser,
  validateUser,
  changeUserPassword,
  setUserPassword as storeSetUserPassword,
  deleteUser as storeDeleteUser,
} from "./store";
import { parseMapsUrl } from "./parse-maps-url";
import { parseSpreadsheetIdFromInput, isGoogleSheetsConfigured, writeWeeklyProgramGrid, readWeeklyProgramGrid } from "./google-sheets";
import { buildWeeklyProgramGridWithMeta } from "./weekly-program-grid";
import { parseGridSheetRows, DAYS } from "./weekly-program-shared";
import { RouteMode } from "./types";
import { revalidatePath } from "next/cache";
import { createSession as createAuthSession, destroySession, getSession, updateSession } from "./session";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  initiatePasswordResetForEmail,
  completePasswordResetWithToken,
  validatePasswordResetToken,
} from "./password-reset";

// ---------------------------------------------------------------------------
// Super-admin: School management
// ---------------------------------------------------------------------------

export async function fetchSchools() {
  return getSchools();
}

export async function fetchSchoolById(id: string) {
  return getSchoolById(id);
}

export async function createSchool(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const label = (formData.get("label") as string)?.trim();
  const mapsUrl = (formData.get("mapsUrl") as string)?.trim();
  const adminEmail = (formData.get("adminEmail") as string)?.trim() || "";

  if (!name || !label || !mapsUrl) {
    return { error: "Okul adı, etiket ve harita linki zorunludur." };
  }

  const parsed = await parseMapsUrl(mapsUrl);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const sheetRaw = (formData.get("googleSheetUrl") as string)?.trim() || "";
  let googleSheetId: string | undefined;
  if (sheetRaw) {
    const sid = parseSpreadsheetIdFromInput(sheetRaw);
    if (!sid) return { error: "Google Sheets linki veya dosya ID’si geçersiz." };
    googleSheetId = sid;
  }

  const school = storeAddSchool({
    name,
    label,
    lat: parsed.coords.lat,
    lng: parsed.coords.lng,
    mapsUrl: parsed.resolvedUrl,
    adminEmail: adminEmail || undefined,
    googleSheetId,
  });

  const panelLoginEmail = (formData.get("panelLoginEmail") as string)?.trim() || "";
  const panelLoginPassword = (formData.get("panelLoginPassword") as string)?.trim() || "";
  if (panelLoginEmail || panelLoginPassword) {
    if (!panelLoginEmail || !panelLoginPassword) {
      return {
        error:
          "Panel admini eklemek için hem «Panel giriş e-postası» hem «Panel şifresi» girin; ikisini de boş bırakırsanız sadece okul oluşturulur.",
      };
    }
    if (panelLoginPassword.length < 4) {
      return { error: "Panel şifresi en az 4 karakter olmalıdır." };
    }
    const u = storeCreateUser({
      email: panelLoginEmail,
      password: panelLoginPassword,
      schoolId: school.id,
      role: "admin",
    });
    if ("error" in u) {
      return {
        error: `Okul oluşturuldu (id: ${school.id}) ancak panel kullanıcısı eklenemedi: ${u.error}. Süper admin panelinden «Admin Ekle» ile kullanıcıyı ekleyin.`,
      };
    }
  }

  revalidatePath("/super-admin");
  return { success: true, school };
}

export async function editSchoolAction(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const label = (formData.get("label") as string)?.trim();
  const mapsUrl = (formData.get("mapsUrl") as string)?.trim();
  const adminEmail = (formData.get("adminEmail") as string)?.trim() || "";

  if (!name || !label || !mapsUrl) {
    return { error: "Tüm alanlar zorunludur." };
  }

  const parsed = await parseMapsUrl(mapsUrl);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const sheetRaw = formData.get("googleSheetUrl");
  const sheetUpdates: { googleSheetId?: string } = {};
  if (sheetRaw !== null) {
    const t = String(sheetRaw).trim();
    if (!t) sheetUpdates.googleSheetId = undefined;
    else {
      const sid = parseSpreadsheetIdFromInput(t);
      if (!sid) return { error: "Google Sheets linki veya dosya ID’si geçersiz." };
      sheetUpdates.googleSheetId = sid;
    }
  }

  const result = storeUpdateSchoolRegistry(id, {
    name,
    label,
    lat: parsed.coords.lat,
    lng: parsed.coords.lng,
    mapsUrl: parsed.resolvedUrl,
    adminEmail: adminEmail || undefined,
    ...sheetUpdates,
  });

  if (!result) return { error: "Okul bulunamadı." };
  revalidatePath("/super-admin");
  revalidatePath(`/admin/${id}`);
  revalidatePath(`/admin/${id}/program`);
  return { success: true };
}

export async function removeSchool(formData: FormData) {
  const id = formData.get("id") as string;
  storeDeleteSchool(id);
  revalidatePath("/super-admin");
  return { success: true };
}

export async function fetchAllSchoolStats() {
  const schools = getSchools();
  return schools.map((s) => ({
    school: s,
    stats: getSchoolStats(s.id),
  }));
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function fetchStudents(schoolId: string) {
  return getStudents(schoolId);
}

export async function fetchStudentsByVehicle(schoolId: string, vehicleId: string) {
  return getStudentsByVehicle(schoolId, vehicleId);
}

export async function createStudent(schoolId: string, formData: FormData) {
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

  addStudent(schoolId, {
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

export async function editStudent(schoolId: string, formData: FormData) {
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

  const result = updateStudent(schoolId, id, {
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

export async function removeStudent(schoolId: string, formData: FormData) {
  const id = formData.get("id") as string;
  deleteStudent(schoolId, id);
  revalidatePath("/");
  return { success: true };
}

export async function toggleActive(schoolId: string, formData: FormData) {
  const id = formData.get("id") as string;
  toggleStudentActive(schoolId, id);
  revalidatePath("/");
  return { success: true };
}

export async function setAllActive(schoolId: string, active: boolean, vehicleId?: string) {
  if (vehicleId) {
    setAllStudentsActiveByVehicle(schoolId, vehicleId, active);
  } else {
    setAllStudentsActive(schoolId, active);
  }
  revalidatePath("/");
  return { success: true };
}

export async function assignVehicle(schoolId: string, studentId: string, vehicleId: string | null) {
  assignStudentToVehicle(schoolId, studentId, vehicleId);
  revalidatePath("/");
  return { success: true };
}

export async function moveStudent(schoolId: string, formData: FormData) {
  const id = formData.get("id") as string;
  const direction = formData.get("direction") as "up" | "down";
  reorderStudent(schoolId, id, direction);
  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// School info (per-school)
// ---------------------------------------------------------------------------

export async function fetchSchool(schoolId: string) {
  return getSchool(schoolId);
}

export async function saveSchool(schoolId: string, formData: FormData) {
  const label = (formData.get("label") as string)?.trim();
  const mapsUrl = (formData.get("mapsUrl") as string)?.trim();

  if (!label || !mapsUrl) {
    return { error: "Tüm alanlar zorunludur." };
  }

  const parsed = await parseMapsUrl(mapsUrl);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  updateSchool(schoolId, {
    label,
    lat: parsed.coords.lat,
    lng: parsed.coords.lng,
    mapsUrl: parsed.resolvedUrl,
  });

  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export async function fetchVehicles(schoolId: string) {
  return getVehicles(schoolId);
}

export async function fetchVehicleBySlug(schoolId: string, slug: string) {
  return getVehicleBySlug(schoolId, slug);
}

export async function createVehicle(schoolId: string, formData: FormData) {
  const gate = await requireSchoolEditor(schoolId);
  if (gate.error) return { error: gate.error };

  const driverName = (formData.get("driverName") as string)?.trim();
  const plate = (formData.get("plate") as string)?.trim();
  const capacityStr = (formData.get("capacity") as string)?.trim();
  const loginUsername = (formData.get("loginUsername") as string)?.trim() || "";

  if (!driverName || !plate) {
    return { error: "Şoför adı ve plaka zorunludur." };
  }

  const capacity = parseInt(capacityStr || "15", 10);
  if (isNaN(capacity) || capacity < 1) {
    return { error: "Kapasite geçerli bir sayı olmalıdır." };
  }

  const userNorm = normalizeDriverUsername(loginUsername);
  if (!DRIVER_USERNAME_RE.test(userNorm)) {
    return {
      error: "Şoför kullanıcı adı 3–40 karakter olmalı; yalnızca küçük harf, rakam, . _ -",
    };
  }
  if (isDriverLoginUsernameTaken(loginUsername)) {
    return { error: "Bu kullanıcı adı başka bir araçta kullanılıyor." };
  }

  const vehicle = addVehicle(schoolId, { driverName, plate, capacity, loginUsername });
  revalidatePath("/");
  return { success: true, vehicle };
}

export async function editVehicle(schoolId: string, formData: FormData) {
  const gate = await requireSchoolEditor(schoolId);
  if (gate.error) return { error: gate.error };

  const id = formData.get("id") as string;
  const driverName = (formData.get("driverName") as string)?.trim();
  const plate = (formData.get("plate") as string)?.trim();
  const capacityStr = (formData.get("capacity") as string)?.trim();
  const loginUsername = (formData.get("loginUsername") as string)?.trim() || "";

  if (!driverName || !plate) {
    return { error: "Şoför adı ve plaka zorunludur." };
  }

  const capacity = parseInt(capacityStr || "15", 10);
  if (isNaN(capacity) || capacity < 1) {
    return { error: "Kapasite geçerli bir sayı olmalıdır." };
  }

  const existing = getVehicleById(schoolId, id);
  if (!existing) return { error: "Araç bulunamadı." };

  const userNorm = normalizeDriverUsername(loginUsername);
  if (!DRIVER_USERNAME_RE.test(userNorm)) {
    return {
      error: "Şoför kullanıcı adı 3–40 karakter olmalı; yalnızca küçük harf, rakam, . _ -",
    };
  }
  if (isDriverLoginUsernameTaken(loginUsername, { schoolId, vehicleId: id })) {
    return { error: "Bu kullanıcı adı başka bir araçta kullanılıyor." };
  }

  const result = updateVehicle(schoolId, id, {
    driverName,
    plate,
    capacity,
    loginUsername: userNorm,
  });
  if (!result) return { error: "Araç bulunamadı." };

  revalidatePath("/");
  return { success: true };
}

export async function removeVehicle(schoolId: string, formData: FormData) {
  const gate = await requireSchoolEditor(schoolId);
  if (gate.error) return { error: gate.error };
  const id = formData.get("id") as string;
  deleteVehicle(schoolId, id);
  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function fetchSessions(schoolId: string) {
  return getSessions(schoolId);
}

export async function fetchCurrentSession(schoolId: string) {
  return getCurrentSession(schoolId);
}

export async function createSession(schoolId: string, input: { label: string; time: string; studentIds: string[] }) {
  const session = storeAddSession(schoolId, input);
  revalidatePath("/");
  return { success: true, session };
}

export async function editSession(schoolId: string, id: string, updates: { label?: string; time?: string; studentIds?: string[] }) {
  const result = storeUpdateSession(schoolId, id, updates);
  if (!result) return { error: "Seans bulunamadı." };
  revalidatePath("/");
  return { success: true };
}

export async function removeSession(schoolId: string, id: string) {
  storeDeleteSession(schoolId, id);
  revalidatePath("/");
  return { success: true };
}

export async function activateSession(schoolId: string, sessionId: string) {
  const result = storeLoadSession(schoolId, sessionId);
  revalidatePath("/");
  return result;
}

// ---------------------------------------------------------------------------
// Weekly Schedule
// ---------------------------------------------------------------------------

export async function fetchWeeklySchedule(schoolId: string) {
  return getWeeklySchedule(schoolId);
}

export async function fetchWeeklyScheduleForDay(schoolId: string, day: string) {
  return getWeeklyScheduleForDay(schoolId, day);
}

export async function updateWeeklyScheduleDay(schoolId: string, day: string, sessionId: string, studentIds: string[]) {
  setWeeklyScheduleDay(schoolId, day, sessionId, studentIds);
  revalidatePath("/");
  return { success: true };
}

async function requireSchoolEditor(schoolId: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Oturum gerekli." };
  if (session.mustChangePassword) return { error: "Önce şifrenizi değiştirin." };
  if (session.role === "superadmin") return {};
  if (session.role === "driver") return { error: "Bu işlem için admin yetkisi gerekir." };
  if (session.schoolId !== schoolId) return { error: "Bu okul için yetkiniz yok." };
  return {};
}

/** Şoför yalnızca kendi aracının verisini; admin/süper admin okul verisini görebilir. */
async function assertDriverOrAdminVehicle(schoolId: string, vehicleId: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Oturum gerekli." };
  if (session.role === "driver") {
    if (session.schoolId !== schoolId || session.vehicleId !== vehicleId) return { error: "Yetkisiz." };
    return {};
  }
  if (session.role === "superadmin") return {};
  if (session.role === "admin" && session.schoolId === schoolId) return {};
  return { error: "Yetkisiz." };
}

const DRIVER_USERNAME_RE = /^[a-z0-9._-]{3,40}$/;

export async function saveSchoolGoogleSheetLink(schoolId: string, formData: FormData) {
  const gate = await requireSchoolEditor(schoolId);
  if (gate.error) return { error: gate.error };

  const raw = (formData.get("googleSheetUrl") as string)?.trim() ?? "";
  let googleSheetId: string | undefined;
  if (raw) {
    const id = parseSpreadsheetIdFromInput(raw);
    if (!id) return { error: "Geçerli bir Google Sheets linki veya dosya ID’si girin." };
    googleSheetId = id;
  } else {
    googleSheetId = undefined;
  }

  const school = storeUpdateSchoolRegistry(schoolId, { googleSheetId });
  if (!school) return { error: "Okul bulunamadı." };
  revalidatePath("/super-admin");
  revalidatePath(`/admin/${schoolId}`);
  revalidatePath(`/admin/${schoolId}/program`);
  return { success: true };
}

export async function pushWeeklyProgramToGoogleSheets(schoolId: string) {
  const gate = await requireSchoolEditor(schoolId);
  if (gate.error) return { error: gate.error };
  if (!isGoogleSheetsConfigured()) {
    return { error: "Sunucuda GOOGLE_SERVICE_ACCOUNT_JSON tanımlı değil." };
  }

  const reg = getSchoolById(schoolId);
  if (!reg?.googleSheetId) {
    return { error: "Önce bu okul için Google Sheets bağlantısını kaydedin." };
  }

  try {
    const layout = buildWeeklyProgramGridWithMeta(schoolId);
    await writeWeeklyProgramGrid(reg.googleSheetId, layout.rows, {
      rowKinds: layout.rowKinds,
      colCount: layout.colCount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Google Sheets’e yazılamadı.";
    return { error: msg };
  }

  revalidatePath(`/admin/${schoolId}/program`);
  return { success: true };
}

export async function pullWeeklyProgramFromGoogleSheets(schoolId: string) {
  const gate = await requireSchoolEditor(schoolId);
  if (gate.error) return { error: gate.error };
  if (!isGoogleSheetsConfigured()) {
    return { error: "Sunucuda GOOGLE_SERVICE_ACCOUNT_JSON tanımlı değil." };
  }

  const reg = getSchoolById(schoolId);
  if (!reg?.googleSheetId) {
    return { error: "Önce bu okul için Google Sheets bağlantısını kaydedin." };
  }

  let rows: string[][];
  try {
    rows = await readWeeklyProgramGrid(reg.googleSheetId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Google Sheets okunamadı.";
    return { error: msg };
  }

  const sessions = getSessions(schoolId);
  const students = getStudents(schoolId);
  const { parsed, warnings } = parseGridSheetRows(rows, sessions, students);

  if (Object.keys(parsed).length === 0) {
    return {
      error:
        "Tabloda tanınan program yok. “Haftalık Program” sekmesinde gün satırları ve saat başlıkları beklenen düzende olmalı.",
      warnings,
    };
  }

  for (const day of DAYS) {
    const dayData = parsed[day] ?? {};
    for (const session of sessions) {
      const ids = dayData[session.id] ?? [];
      setWeeklyScheduleDay(schoolId, day, session.id, ids);
    }
  }

  revalidatePath("/");
  revalidatePath(`/admin/${schoolId}/program`);
  return { success: true as const, warnings };
}

// ---------------------------------------------------------------------------
// Working vehicles per day
// ---------------------------------------------------------------------------

export async function fetchWorkingVehicleIdsForDay(schoolId: string, dayKey: string) {
  return getWorkingVehicleIdsForDay(schoolId, dayKey);
}

export async function setWorkingVehicleIdsForDayAction(schoolId: string, dayKey: string, vehicleIds: string[]) {
  const result = storeSetWorkingVehicleIdsForDay(schoolId, dayKey, vehicleIds);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/sofor", "layout");
  return result;
}

export async function fetchVehicleWorkingToday(schoolId: string, vehicleId: string) {
  const g = await assertDriverOrAdminVehicle(schoolId, vehicleId);
  if (g.error) return false;
  return isVehicleWorkingToday(schoolId, vehicleId);
}

// ---------------------------------------------------------------------------
// Daily Full Distribution
// ---------------------------------------------------------------------------

export async function distributeDailyAllAction(schoolId: string, scope: "day" | "week") {
  const result = storeDistributeDailyAll(schoolId, scope);
  revalidatePath("/");
  return result;
}

export async function fetchVehicleCountSuggestion(schoolId: string, dayKey: string) {
  return getVehicleCountSuggestionForDay(schoolId, dayKey);
}

export async function fetchDailyDistribution(schoolId: string, forVehicleId?: string) {
  if (forVehicleId) {
    const g = await assertDriverOrAdminVehicle(schoolId, forVehicleId);
    if (g.error) return null;
  } else {
    const gate = await requireSchoolEditor(schoolId);
    if (gate.error) return null;
  }
  return getDailyDistribution(schoolId);
}

export async function fetchDistributionDayKeysWithData(schoolId: string) {
  return getDistributionDayKeysWithData(schoolId);
}

export async function clearDailyDistributionAction(schoolId: string, scope: "today" | "all" = "today") {
  if (scope === "all") storeClearAllDistributions(schoolId);
  else storeClearDailyDistributionToday(schoolId);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/sofor", "layout");
  return { success: true as const };
}

export async function updateDailyDistributionGroupAction(
  schoolId: string,
  groupId: string,
  assignments: SessionDistributionAssignment[]
) {
  const result = updateDailyDistributionGroup(schoolId, groupId, assignments);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/sofor", "layout");
  return result;
}

export async function fetchGroupDistribution(schoolId: string, groupId: string, vehicleId: string) {
  const g = await assertDriverOrAdminVehicle(schoolId, vehicleId);
  if (g.error) return [];
  return getGroupDistribution(schoolId, groupId, vehicleId);
}

export async function getRouteLinkForGroup(
  schoolId: string,
  groupId: string,
  vehicleId: string,
  excludeStudentIds?: string[],
) {
  const g = await assertDriverOrAdminVehicle(schoolId, vehicleId);
  if (g.error) return "";
  return generateRouteLinkForGroup(schoolId, groupId, vehicleId, excludeStudentIds) ?? "";
}

export async function fetchClassDuration(schoolId: string) {
  return getClassDuration(schoolId);
}

export async function updateClassDuration(schoolId: string, minutes: number) {
  storeSetClassDuration(schoolId, minutes);
  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Auto Distribution (legacy)
// ---------------------------------------------------------------------------

export async function autoDistribute(schoolId: string) {
  const result = autoDistributeStudents(schoolId);
  revalidatePath("/");
  return result;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function getRouteLink(schoolId: string, mode: RouteMode, vehicleId?: string) {
  return generateRouteLink(schoolId, mode, vehicleId);
}

// ---------------------------------------------------------------------------
// Auth: login / logout / session
// ---------------------------------------------------------------------------

export async function loginAction(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string) || "";

  if (!email || !password) {
    return { error: "E-posta ve şifre zorunludur." };
  }

  const user = validateUser(email, password);
  if (!user) {
    return { error: "E-posta veya şifre hatalı." };
  }

  await createAuthSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    schoolId: user.schoolId,
    mustChangePassword: user.mustChangePassword,
  });

  // Sunucu yönlendirmesi: Set-Cookie ile aynı yanıtta gider (Vercel / istemci yarışı azalır).
  if (user.mustChangePassword) redirect("/sifre-degistir");
  if (user.role === "superadmin") redirect("/super-admin");
  if (user.schoolId) redirect(`/admin/${user.schoolId}`);
  redirect("/");
}

export async function driverLoginAction(formData: FormData) {
  const username = (formData.get("username") as string)?.trim() || "";

  if (!username) {
    return { error: "Kullanıcı adı zorunludur." };
  }

  const found = resolveDriverByUsername(username);
  if (!found) {
    return { error: "Bu kullanıcı adı ile kayıtlı araç yok veya giriş henüz tanımlanmamış." };
  }

  const { schoolId, vehicle } = found;

  await createAuthSession({
    userId: `drv:${schoolId}:${vehicle.id}`,
    email: normalizeDriverUsername(username),
    role: "driver",
    schoolId,
    mustChangePassword: false,
    vehicleId: vehicle.id,
    vehicleSlug: vehicle.slug,
  });

  return {
    success: true as const,
    redirectTo: `/sofor/${schoolId}/${vehicle.slug}` as const,
  };
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function fetchSession() {
  return getSession();
}

// ---------------------------------------------------------------------------
// Auth: user management (super-admin)
// ---------------------------------------------------------------------------

export async function createUserAction(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();
  const schoolId = (formData.get("schoolId") as string)?.trim() || null;
  const role = (formData.get("role") as string)?.trim() as "admin" | "superadmin" || "admin";

  if (!email || !password) {
    return { error: "E-posta ve şifre zorunludur." };
  }

  if (password.length < 4) {
    return { error: "Şifre en az 4 karakter olmalıdır." };
  }

  const result = storeCreateUser({ email, password, schoolId, role });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/super-admin");
  return { success: true };
}

export async function deleteUserAction(formData: FormData) {
  const id = formData.get("id") as string;
  storeDeleteUser(id);
  revalidatePath("/super-admin");
  return { success: true };
}

export async function superAdminResetPasswordAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return { error: "Bu işlem için süper admin olmalısınız." };
  }

  const userId = (formData.get("userId") as string)?.trim();
  const newPassword = (formData.get("newPassword") as string)?.trim() || "";
  const confirmPassword = (formData.get("confirmPassword") as string)?.trim() || "";

  if (!userId) return { error: "Kullanıcı seçilmedi." };
  if (!newPassword || newPassword.length < 4) {
    return { error: "Yeni şifre en az 4 karakter olmalıdır." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Şifreler eşleşmiyor." };
  }

  const target = storeGetUserById(userId);
  if (!target) return { error: "Kullanıcı bulunamadı." };
  if (target.id === session.userId) {
    return { error: "Kendi şifrenizi buradan değiştiremezsiniz; /sifre-degistir sayfasını kullanın." };
  }

  storeSetUserPassword(userId, newPassword, true);
  revalidatePath("/super-admin");
  return { success: true };
}

export async function fetchUsersBySchool(schoolId: string) {
  return getUsersBySchool(schoolId);
}

export async function fetchAllUsers() {
  return getUsers().map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    schoolId: u.schoolId,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt,
  }));
}

export async function changePasswordAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Oturum bulunamadı." };

  const currentPassword = (formData.get("currentPassword") as string) || "";
  const newPassword = (formData.get("newPassword") as string)?.trim() || "";

  if (!newPassword || newPassword.length < 4) {
    return { error: "Yeni şifre en az 4 karakter olmalıdır." };
  }

  if (!session.mustChangePassword) {
    const user = validateUser(session.email, currentPassword);
    if (!user) {
      return { error: "Mevcut şifre hatalı." };
    }
  }

  if (session.userId === "bootstrap-superadmin") {
    return {
      error:
        "Bu hesap yalnızca Vercel ortam değişkenleriyle (ROTA_BOOTSTRAP_SUPERADMIN_*) tanımlıdır. Şifreyi panelden değil, Vercel env üzerinden güncelleyip yeniden deploy edin.",
    };
  }

  const ok = changeUserPassword(session.userId, newPassword);
  if (!ok) return { error: "Kullanıcı bulunamadı." };

  await updateSession({ mustChangePassword: false });
  return { success: true };
}

/** Admin (e-posta) şifre sıfırlama isteği — Firestore/e-posta ile teslimat için `password-reset` modülü genişletilir. */
export async function requestAdminPasswordResetAction(formData: FormData) {
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  if (!email) return { error: "E-posta adresi gerekli." };

  let publicBase = ((formData.get("publicOrigin") as string) || "").trim().replace(/\/$/, "");
  if (!publicBase) {
    const envOrigin = (process.env.NEXT_PUBLIC_APP_ORIGIN || "").trim().replace(/\/$/, "");
    if (envOrigin) publicBase = envOrigin;
  }
  if (!publicBase) {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    const proto = h.get("x-forwarded-proto") || "http";
    if (host) publicBase = `${proto}://${host}`;
  }
  if (!publicBase) {
    return {
      error:
        "Uygulama adresi alınamadı. `.env` içine `NEXT_PUBLIC_APP_ORIGIN=https://alanadiniz.com` ekleyin veya formu tarayıcıdan gönderin.",
    };
  }

  await initiatePasswordResetForEmail(email, publicBase);
  return { success: true as const };
}

export async function completeAdminPasswordResetAction(formData: FormData) {
  const token = ((formData.get("token") as string) || "").trim();
  const newPassword = ((formData.get("newPassword") as string) || "").trim();
  const confirmPassword = ((formData.get("confirmPassword") as string) || "").trim();
  if (!token) return { error: "Geçersiz sıfırlama bağlantısı." };
  if (newPassword !== confirmPassword) return { error: "Şifreler eşleşmiyor." };
  return completePasswordResetWithToken(token, newPassword);
}

export async function checkAdminPasswordResetTokenAction(token: string) {
  return validatePasswordResetToken((token || "").trim());
}
