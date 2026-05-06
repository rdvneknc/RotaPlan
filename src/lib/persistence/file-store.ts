import {
  Student,
  Vehicle,
  Session,
  SchoolInfo,
  School,
  AppUser,
  DailyDistribution,
  SessionDistributionAssignment,
  DriverRouteDirections,
} from "../types";
import { buildGoogleMapsDrivingDirectionsUrl } from "../google-maps-directions-url";
import {
  distributeStudents,
  optimizeStopOrderFromSchool,
  suggestVehicleCount,
  type VehicleCountSuggestion,
} from "../optimizer";
import type { PasswordResetTokenRecord } from "./password-reset-tokens";
import type { RegistryData } from "./data-persistence";
import { getDataPersistence } from "./data-persistence-singleton";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Registry: School list
// ---------------------------------------------------------------------------

const DEFAULT_REGISTRY: RegistryData = { schools: [], users: [], nextSchoolId: 1, nextUserId: 1 };

async function readRegistry(): Promise<RegistryData> {
  try {
    const data = await getDataPersistence().readRegistry();
    if (!data.schools) data.schools = [];
    if (!data.users) data.users = [];
    if (!data.nextSchoolId) data.nextSchoolId = 1;
    if (!data.nextUserId) data.nextUserId = 1;
    return data;
  } catch {
    await getDataPersistence().writeRegistry({ ...DEFAULT_REGISTRY, schools: [], users: [] });
    return { ...DEFAULT_REGISTRY, schools: [], users: [] };
  }
}

async function saveRegistry(data: RegistryData): Promise<void> {
  await getDataPersistence().writeRegistry(data);
}

export async function getSchools(): Promise<School[]> {
  return [...(await readRegistry()).schools];
}

export async function getSchoolById(id: string): Promise<School | null> {
  return (await readRegistry()).schools.find((s) => s.id === id) ?? null;
}

export async function addSchool(input: Omit<School, "id" | "createdAt">): Promise<School> {
  const reg = await readRegistry();
  const school: School = {
    ...input,
    id: String(reg.nextSchoolId),
    createdAt: new Date().toISOString(),
  };
  reg.schools.push(school);
  reg.nextSchoolId++;
  await saveRegistry(reg);

  const defaultData = makeDefaultSchoolData({
    label: school.label,
    lat: school.lat,
    lng: school.lng,
    mapsUrl: school.mapsUrl,
  });
  await saveSchoolData(school.id, defaultData);
  return school;
}

export async function updateSchoolRegistry(
  id: string,
  updates: Partial<Omit<School, "id" | "createdAt">>,
): Promise<School | null> {
  const reg = await readRegistry();
  const idx = reg.schools.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  reg.schools[idx] = { ...reg.schools[idx], ...updates };
  await saveRegistry(reg);
  return reg.schools[idx];
}

export async function deleteSchool(id: string): Promise<boolean> {
  const reg = await readRegistry();
  const len = reg.schools.length;
  reg.schools = reg.schools.filter((s) => s.id !== id);
  if (reg.schools.length < len) {
    await saveRegistry(reg);
    await getDataPersistence().deleteSchoolData(id);
    return true;
  }
  return false;
}

export async function getSchoolStats(
  schoolId: string,
): Promise<{ studentCount: number; vehicleCount: number; sessionCount: number }> {
  const data = await readSchoolData(schoolId);
  return {
    studentCount: data.students.length,
    vehicleCount: data.vehicles.length,
    sessionCount: data.sessions.length,
  };
}

// ---------------------------------------------------------------------------
// Users: authentication
// ---------------------------------------------------------------------------

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function makeSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function getUsers(): Promise<AppUser[]> {
  return [...(await readRegistry()).users];
}

export async function getUsersBySchool(schoolId: string): Promise<AppUser[]> {
  return (await readRegistry()).users.filter((u) => u.schoolId === schoolId);
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const lower = email.toLowerCase().trim();
  return (await readRegistry()).users.find((u) => u.email.toLowerCase() === lower) ?? null;
}

export async function getUserById(id: string): Promise<AppUser | null> {
  return (await readRegistry()).users.find((u) => u.id === id) ?? null;
}

export async function createUser(input: {
  email: string;
  password: string;
  schoolId: string | null;
  role: "superadmin" | "admin";
}): Promise<AppUser | { error: string }> {
  const reg = await readRegistry();
  const lower = input.email.toLowerCase().trim();

  if (reg.users.some((u) => u.email.toLowerCase() === lower)) {
    return { error: "Bu e-posta zaten kullanılıyor." };
  }

  const salt = makeSalt();
  const user: AppUser = {
    id: String(reg.nextUserId),
    email: lower,
    passwordHash: hashPassword(input.password, salt),
    salt,
    schoolId: input.schoolId,
    role: input.role,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  };
  reg.users.push(user);
  reg.nextUserId++;
  await saveRegistry(reg);
  return user;
}

/**
 * Firebase Authentication ile oluşturulan hesap — şifre yalnızca Firebase’de tutulur.
 * Kayıttaki `id`, Firebase `uid` ile aynı olmalıdır.
 */
export async function registerUserFromFirebaseAuth(input: {
  uid: string;
  email: string;
  schoolId: string | null;
  role: "superadmin" | "admin";
}): Promise<AppUser | { error: string }> {
  const reg = await readRegistry();
  const lower = input.email.toLowerCase().trim();
  if (reg.users.some((u) => u.email.toLowerCase() === lower)) {
    return { error: "Bu e-posta zaten kullanılıyor." };
  }
  if (reg.users.some((u) => u.id === input.uid)) {
    return { error: "Bu kullanıcı kimliği zaten kayıtlı." };
  }
  const user: AppUser = {
    id: input.uid,
    email: lower,
    passwordHash: "",
    salt: "",
    schoolId: input.schoolId,
    role: input.role,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  };
  reg.users.push(user);
  await saveRegistry(reg);
  return user;
}

/** Kalıcı DB yokken (ör. Vercel /tmp boş) tek süper admin girişi. Vercel’de env ile tanımlayın; Firestore sonrası kaldırılabilir. */
function matchBootstrapSuperadmin(email: string, password: string): AppUser | null {
  const envEmail = process.env.ROTA_BOOTSTRAP_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const envPassword = process.env.ROTA_BOOTSTRAP_SUPERADMIN_PASSWORD;
  if (!envEmail || !envPassword || envPassword.length < 4) return null;
  if (email.toLowerCase().trim() !== envEmail) return null;
  if (password !== envPassword) return null;
  return {
    id: "bootstrap-superadmin",
    email: envEmail,
    passwordHash: "",
    salt: "",
    schoolId: null,
    role: "superadmin",
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
  };
}

export async function validateUser(email: string, password: string): Promise<AppUser | null> {
  const user = await getUserByEmail(email);
  if (user) {
    if (!user.passwordHash) return null;
    const hash = hashPassword(password, user.salt);
    if (hash !== user.passwordHash) return null;
    return user;
  }
  return matchBootstrapSuperadmin(email, password);
}

export async function changeUserPassword(userId: string, newPassword: string): Promise<boolean> {
  return await setUserPassword(userId, newPassword, false);
}

/** Süper admin şifre sıfırlama veya ilk atama; `mustChangePassword` genelde true (geçici şifre). */
export async function setUserPassword(
  userId: string,
  newPassword: string,
  mustChangePassword: boolean,
): Promise<boolean> {
  const reg = await readRegistry();
  const idx = reg.users.findIndex((u) => u.id === userId);
  if (idx === -1) return false;
  const salt = makeSalt();
  reg.users[idx].salt = salt;
  reg.users[idx].passwordHash = hashPassword(newPassword, salt);
  reg.users[idx].mustChangePassword = mustChangePassword;
  await saveRegistry(reg);
  return true;
}

export async function deleteUser(userId: string): Promise<boolean> {
  const reg = await readRegistry();
  const len = reg.users.length;
  reg.users = reg.users.filter((u) => u.id !== userId);
  if (reg.users.length < len) {
    await saveRegistry(reg);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// School data (per-school store — replaces old single-file store)
// ---------------------------------------------------------------------------

type WeeklySchedule = {
  [day: string]: {
    [sessionId: string]: string[];
  };
};

type WeeklyWorkingVehicles = { [day: string]: string[] };

type DistributionByDay = { [dayKey: string]: DailyDistribution };

interface StoreData {
  school: SchoolInfo;
  students: Student[];
  vehicles: Vehicle[];
  sessions: Session[];
  classDuration: number;
  weeklySchedule: WeeklySchedule;
  weeklyWorkingVehicles: WeeklyWorkingVehicles;
  distributionByDay: DistributionByDay;
  /** @deprecated migrate → distributionByDay */
  dailyDistribution?: DailyDistribution | null;
  currentSessionId: string | null;
  nextId: number;
  nextVehicleId: number;
  nextSessionId: number;
}

function ensureDistributionByDay(data: StoreData): DistributionByDay {
  if (!data.distributionByDay) data.distributionByDay = {};
  const legacy = data.dailyDistribution;
  if (legacy && Object.keys(legacy).length > 0) {
    const tk = String(new Date().getDay());
    if (!data.distributionByDay[tk] || Object.keys(data.distributionByDay[tk]).length === 0) {
      data.distributionByDay[tk] = legacy;
    }
    delete data.dailyDistribution;
  }
  return data.distributionByDay;
}

function getTodayDistribution(data: StoreData): DailyDistribution | null {
  const map = ensureDistributionByDay(data);
  const d = map[String(new Date().getDay())];
  if (!d || Object.keys(d).length === 0) return null;
  return d;
}

function addMinutesToTime(time: string, minutes: number): string {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return time;
  let h = parseInt(m[1], 10);
  let min = parseInt(m[2], 10) + minutes;
  h += Math.floor(min / 60);
  min = min % 60;
  h = h % 24;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function makeDefaultSchoolData(school: SchoolInfo): StoreData {
  return {
    school,
    students: [],
    vehicles: [],
    sessions: [],
    classDuration: 40,
    weeklySchedule: {},
    weeklyWorkingVehicles: {},
    distributionByDay: {},
    currentSessionId: null,
    nextId: 1,
    nextVehicleId: 1,
    nextSessionId: 1,
  };
}

function generateSlug(): string {
  return crypto.randomBytes(4).toString("hex");
}

function migrateSessionTypes(data: StoreData) {
  const hasType = data.sessions.some((s: any) => (s as any).type != null);
  if (!hasType) return;

  const dropoffIds = new Set(
    data.sessions.filter((s: any) => (s as any).type === "dropoff").map((s) => s.id)
  );

  data.sessions = data.sessions
    .filter((s: any) => (s as any).type !== "dropoff")
    .map((s: any) => {
      const { type, ...rest } = s;
      rest.label = rest.label
        .replace(/\s*[Gg]iriş$/i, "")
        .replace(/\s*[Gg][İi][Rr][İi][Şş]$/i, "")
        .trim();
      if (!rest.label) rest.label = rest.time;
      return rest as Session;
    });

  for (const day of Object.keys(data.weeklySchedule)) {
    for (const sid of dropoffIds) {
      delete data.weeklySchedule[day]?.[sid];
    }
  }

  for (const student of data.students) {
    student.sessionIds = student.sessionIds.filter((id) => !dropoffIds.has(id));
  }

  data.distributionByDay = {};
  delete data.dailyDistribution;
}

async function readSchoolData(schoolId: string): Promise<StoreData> {
  try {
      const raw = await getDataPersistence().readSchoolJson(schoolId);
      if (raw != null) {
      const data = JSON.parse(raw);
      if (!data.school) data.school = { label: "", lat: 0, lng: 0, mapsUrl: "" };
      if (!data.vehicles) data.vehicles = [];
      if (!data.nextVehicleId) data.nextVehicleId = 1;
      if (!data.sessions) data.sessions = [];
      if (!data.nextSessionId) data.nextSessionId = 1;
      if (data.currentSessionId === undefined) data.currentSessionId = null;
      if (!data.weeklySchedule) data.weeklySchedule = {};
      if (!data.weeklyWorkingVehicles) data.weeklyWorkingVehicles = {};
      if (!data.distributionByDay) data.distributionByDay = {};
      if (data.dailyDistribution === undefined) data.dailyDistribution = null;
      if (!data.classDuration) data.classDuration = 40;
      if (!data.nextId) data.nextId = 1;
      data.students = (data.students || []).map((s: Student) => ({
        ...s,
        vehicleId: s.vehicleId ?? null,
        sessionIds: s.sessionIds ?? [],
        contact1Name: s.contact1Name ?? "",
        contact1Phone: s.contact1Phone ?? "",
        contact2Name: s.contact2Name ?? "",
        contact2Phone: s.contact2Phone ?? "",
      }));
      migrateSessionTypes(data);
      for (const v of data.vehicles as Vehicle[]) {
        if (v.loginUsername === undefined) v.loginUsername = "";
        delete (v as unknown as { passwordHash?: string }).passwordHash;
        delete (v as unknown as { salt?: string }).salt;
      }
      ensureDistributionByDay(data);
      return data;
    }
  } catch {
    // corrupted — return empty
  }
  const empty = makeDefaultSchoolData({ label: "", lat: 0, lng: 0, mapsUrl: "" });
  await saveSchoolData(schoolId, empty);
  return empty;
}

async function saveSchoolData(schoolId: string, data: StoreData): Promise<void> {
  await getDataPersistence().writeSchoolJson(schoolId, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// School info (per-school)
// ---------------------------------------------------------------------------

export async function getSchool(schoolId: string): Promise<SchoolInfo> {
  return { ...(await readSchoolData(schoolId)).school };
}

export async function updateSchool(schoolId: string, school: SchoolInfo): Promise<void> {
  const data = await readSchoolData(schoolId);
  data.school = school;
  await saveSchoolData(schoolId, data);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function getSessions(schoolId: string): Promise<Session[]> {
  return [...(await readSchoolData(schoolId)).sessions];
}

export async function getSessionById(schoolId: string, id: string): Promise<Session | null> {
  const data = await readSchoolData(schoolId);
  return data.sessions.find((s) => s.id === id) || null;
}

export async function getCurrentSession(schoolId: string): Promise<Session | null> {
  const data = await readSchoolData(schoolId);
  if (!data.currentSessionId) return null;
  return data.sessions.find((s) => s.id === data.currentSessionId) || null;
}

export async function getClassDuration(schoolId: string): Promise<number> {
  return (await readSchoolData(schoolId)).classDuration;
}

export async function setClassDuration(schoolId: string, minutes: number): Promise<void> {
  const data = await readSchoolData(schoolId);
  data.classDuration = Math.max(1, Math.min(120, minutes));
  await saveSchoolData(schoolId, data);
}

export async function addSession(schoolId: string, input: { label: string; time: string; studentIds: string[] }): Promise<Session> {
  const data = await readSchoolData(schoolId);
  const session: Session = {
    id: String(data.nextSessionId),
    label: input.label,
    time: input.time,
    studentIds: input.studentIds,
  };
  data.sessions.push(session);
  data.nextSessionId++;

  for (const student of data.students) {
    if (input.studentIds.includes(student.id) && !student.sessionIds.includes(session.id)) {
      student.sessionIds.push(session.id);
    }
  }

  await saveSchoolData(schoolId, data);
  return session;
}

export async function updateSession(schoolId: string, id: string, updates: { label?: string; time?: string; studentIds?: string[] }): Promise<Session | null> {
  const data = await readSchoolData(schoolId);
  const index = data.sessions.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const old = data.sessions[index];
  data.sessions[index] = { ...old, ...updates };
  const updated = data.sessions[index];

  if (updates.studentIds) {
    for (const student of data.students) {
      const wasIn = old.studentIds.includes(student.id);
      const isIn = updates.studentIds.includes(student.id);
      if (isIn && !student.sessionIds.includes(id)) {
        student.sessionIds.push(id);
      } else if (!isIn && wasIn) {
        student.sessionIds = student.sessionIds.filter((sid) => sid !== id);
      }
    }
  }

  await saveSchoolData(schoolId, data);
  return updated;
}

export async function deleteSession(schoolId: string, id: string): Promise<boolean> {
  const data = await readSchoolData(schoolId);
  const length = data.sessions.length;
  data.sessions = data.sessions.filter((s) => s.id !== id);

  for (const student of data.students) {
    student.sessionIds = student.sessionIds.filter((sid) => sid !== id);
  }

  if (data.currentSessionId === id) {
    data.currentSessionId = null;
  }

  if (data.sessions.length < length) {
    await saveSchoolData(schoolId, data);
    return true;
  }
  return false;
}

export async function loadSession(
  schoolId: string,
  sessionId: string,
): Promise<{ error?: string; loaded?: number }> {
  const data = await readSchoolData(schoolId);
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return { error: "Seans bulunamadı." };

  const today = new Date().getDay();
  const dayKey = String(today);
  const daySchedule = data.weeklySchedule[dayKey];
  const studentIds = daySchedule?.[sessionId] ?? session.studentIds;

  for (const student of data.students) {
    student.isActive = false;
    student.vehicleId = null;
  }

  let loaded = 0;
  for (const student of data.students) {
    if (studentIds.includes(student.id)) {
      student.isActive = true;
      loaded++;
    }
  }

  data.currentSessionId = sessionId;
  await saveSchoolData(schoolId, data);
  return { loaded };
}

// ---------------------------------------------------------------------------
// Weekly Schedule
// ---------------------------------------------------------------------------

export async function getWeeklySchedule(schoolId: string): Promise<WeeklySchedule> {
  return { ...(await readSchoolData(schoolId)).weeklySchedule };
}

export async function setWeeklyScheduleDay(
  schoolId: string,
  day: string,
  sessionId: string,
  studentIds: string[],
): Promise<void> {
  const data = await readSchoolData(schoolId);
  if (!data.weeklySchedule[day]) {
    data.weeklySchedule[day] = {};
  }
  data.weeklySchedule[day][sessionId] = studentIds;
  await saveSchoolData(schoolId, data);
}

/** Tek kayıtta tüm haftalık programı yazar (Sheets’ten toplu içe aktarım için; yarış koşullarını önler). */
export async function replaceWeeklySchedule(schoolId: string, schedule: WeeklySchedule): Promise<void> {
  const data = await readSchoolData(schoolId);
  data.weeklySchedule = schedule;
  await saveSchoolData(schoolId, data);
}

export async function getWeeklyScheduleForDay(schoolId: string, day: string): Promise<{ [sessionId: string]: string[] }> {
  const data = await readSchoolData(schoolId);
  return data.weeklySchedule[day] || {};
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export async function getVehicles(schoolId: string): Promise<Vehicle[]> {
  return [...(await readSchoolData(schoolId)).vehicles];
}

export async function getVehicleBySlug(schoolId: string, slug: string): Promise<Vehicle | null> {
  const data = await readSchoolData(schoolId);
  return data.vehicles.find((v) => v.slug === slug) || null;
}

export async function getVehicleById(schoolId: string, id: string): Promise<Vehicle | null> {
  const data = await readSchoolData(schoolId);
  return data.vehicles.find((v) => v.id === id) || null;
}

/** Şoför giriş adı — küçük harf, trim. */
export function normalizeDriverUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function isDriverLoginUsernameTaken(
  username: string,
  except?: { schoolId: string; vehicleId: string },
): Promise<boolean> {
  const u = normalizeDriverUsername(username);
  if (u.length < 3) return true;
  for (const school of await getSchools()) {
    const data = await readSchoolData(school.id);
    for (const v of data.vehicles) {
      const vu = normalizeDriverUsername(v.loginUsername || "");
      if (!vu || vu !== u) continue;
      if (except && except.schoolId === school.id && except.vehicleId === v.id) continue;
      return true;
    }
  }
  return false;
}

export async function findVehicleByLoginUsername(
  username: string,
): Promise<{ schoolId: string; vehicle: Vehicle } | null> {
  const u = normalizeDriverUsername(username);
  if (!u) return null;
  for (const school of await getSchools()) {
    const data = await readSchoolData(school.id);
    for (const v of data.vehicles) {
      const vu = normalizeDriverUsername(v.loginUsername || "");
      if (vu && vu === u) return { schoolId: school.id, vehicle: { ...v } };
    }
  }
  return null;
}

/** Şoför girişi: yalnızca kullanıcı adı (şifre yok). */
export async function resolveDriverByUsername(
  username: string,
): Promise<{ schoolId: string; vehicle: Vehicle } | null> {
  const found = await findVehicleByLoginUsername(username);
  if (!found) return null;
  const u = normalizeDriverUsername(found.vehicle.loginUsername || "");
  if (!u) return null;
  return found;
}

export async function addVehicle(
  schoolId: string,
  input: { driverName: string; plate: string; capacity: number; loginUsername: string },
): Promise<Vehicle> {
  const data = await readSchoolData(schoolId);
  const loginUsername = normalizeDriverUsername(input.loginUsername);
  const vehicle: Vehicle = {
    id: String(data.nextVehicleId),
    slug: generateSlug(),
    driverName: input.driverName,
    plate: input.plate,
    capacity: input.capacity,
    loginUsername,
  };
  data.vehicles.push(vehicle);
  data.nextVehicleId++;
  await saveSchoolData(schoolId, data);
  return vehicle;
}

export async function updateVehicle(schoolId: string, id: string, updates: Partial<Omit<Vehicle, "id" | "slug">>): Promise<Vehicle | null> {
  const data = await readSchoolData(schoolId);
  const index = data.vehicles.findIndex((v) => v.id === id);
  if (index === -1) return null;
  data.vehicles[index] = { ...data.vehicles[index], ...updates };
  await saveSchoolData(schoolId, data);
  return data.vehicles[index];
}

export async function deleteVehicle(schoolId: string, id: string): Promise<boolean> {
  const data = await readSchoolData(schoolId);
  const length = data.vehicles.length;
  data.vehicles = data.vehicles.filter((v) => v.id !== id);
  data.students.forEach((s) => {
    if (s.vehicleId === id) s.vehicleId = null;
  });
  if (data.vehicles.length < length) {
    await saveSchoolData(schoolId, data);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function getStudents(schoolId: string): Promise<Student[]> {
  return [...(await readSchoolData(schoolId)).students];
}

export async function getStudentsByVehicle(schoolId: string, vehicleId: string): Promise<Student[]> {
  return (await readSchoolData(schoolId)).students.filter((s) => s.vehicleId === vehicleId);
}

export async function addStudent(schoolId: string, input: Omit<Student, "id" | "isActive">): Promise<Student> {
  const data = await readSchoolData(schoolId);
  const student: Student = {
    ...input,
    id: String(data.nextId),
    isActive: false,
  };
  data.students.push(student);
  data.nextId++;

  for (const sid of student.sessionIds) {
    const session = data.sessions.find((s) => s.id === sid);
    if (session && !session.studentIds.includes(student.id)) {
      session.studentIds.push(student.id);
    }
  }

  await saveSchoolData(schoolId, data);
  return student;
}

export async function updateStudent(schoolId: string, id: string, updates: Partial<Omit<Student, "id">>): Promise<Student | null> {
  const data = await readSchoolData(schoolId);
  const index = data.students.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const oldSessionIds = data.students[index].sessionIds || [];
  data.students[index] = { ...data.students[index], ...updates };
  const newSessionIds = data.students[index].sessionIds || [];

  if (updates.sessionIds) {
    for (const sid of oldSessionIds) {
      if (!newSessionIds.includes(sid)) {
        const session = data.sessions.find((s) => s.id === sid);
        if (session) {
          session.studentIds = session.studentIds.filter((sId) => sId !== id);
        }
      }
    }
    for (const sid of newSessionIds) {
      if (!oldSessionIds.includes(sid)) {
        const session = data.sessions.find((s) => s.id === sid);
        if (session && !session.studentIds.includes(id)) {
          session.studentIds.push(id);
        }
      }
    }
  }

  await saveSchoolData(schoolId, data);
  return data.students[index];
}

export async function deleteStudent(schoolId: string, id: string): Promise<boolean> {
  const data = await readSchoolData(schoolId);
  const length = data.students.length;
  pruneStudentFromTodayDistributionInMemory(data, id);
  data.students = data.students.filter((s) => s.id !== id);

  for (const session of data.sessions) {
    session.studentIds = session.studentIds.filter((sId) => sId !== id);
  }

  if (data.students.length < length) {
    await saveSchoolData(schoolId, data);
    return true;
  }
  return false;
}

export async function toggleStudentActive(schoolId: string, id: string): Promise<Student | null> {
  const data = await readSchoolData(schoolId);
  const student = data.students.find((s) => s.id === id);
  if (!student) return null;
  const wasActive = student.isActive;
  student.isActive = !student.isActive;
  if (wasActive && !student.isActive) {
    pruneStudentFromTodayDistributionInMemory(data, id);
  }
  await saveSchoolData(schoolId, data);
  return { ...student };
}

export async function setAllStudentsActiveByVehicle(
  schoolId: string,
  vehicleId: string,
  active: boolean,
): Promise<void> {
  const data = await readSchoolData(schoolId);
  data.students.forEach((s) => {
    if (s.vehicleId === vehicleId) s.isActive = active;
  });
  await saveSchoolData(schoolId, data);
}

export async function setAllStudentsActive(schoolId: string, active: boolean): Promise<void> {
  const data = await readSchoolData(schoolId);
  data.students.forEach((s) => (s.isActive = active));
  await saveSchoolData(schoolId, data);
}

export async function assignStudentToVehicle(schoolId: string, studentId: string, vehicleId: string | null): Promise<Student | null> {
  const data = await readSchoolData(schoolId);
  const student = data.students.find((s) => s.id === studentId);
  if (!student) return null;
  student.vehicleId = vehicleId;
  await saveSchoolData(schoolId, data);
  return { ...student };
}

export async function reorderStudent(schoolId: string, id: string, direction: "up" | "down"): Promise<boolean> {
  const data = await readSchoolData(schoolId);
  const index = data.students.findIndex((s) => s.id === id);
  if (index === -1) return false;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= data.students.length) return false;

  [data.students[index], data.students[targetIndex]] = [data.students[targetIndex], data.students[index]];
  await saveSchoolData(schoolId, data);
  return true;
}

// ---------------------------------------------------------------------------
// Working vehicles per day
// ---------------------------------------------------------------------------

export async function getWorkingVehicleIdsForDay(schoolId: string, dayKey: string): Promise<string[]> {
  const data = await readSchoolData(schoolId);
  const allIds = data.vehicles.map((v) => v.id);
  const configured = data.weeklyWorkingVehicles?.[dayKey];
  if (configured === undefined) return [...allIds];
  return configured.filter((id) => allIds.includes(id));
}

export async function setWorkingVehicleIdsForDay(schoolId: string, dayKey: string, vehicleIds: string[]): Promise<{ error?: string }> {
  const data = await readSchoolData(schoolId);
  if (vehicleIds.length === 0) {
    return { error: "En az bir araç seçmelisiniz." };
  }
  const valid = new Set(data.vehicles.map((v) => v.id));
  for (const id of vehicleIds) {
    if (!valid.has(id)) return { error: "Geçersiz araç." };
  }
  if (!data.weeklyWorkingVehicles) data.weeklyWorkingVehicles = {};
  data.weeklyWorkingVehicles[dayKey] = vehicleIds;
  await saveSchoolData(schoolId, data);
  return {};
}

export async function isVehicleWorkingToday(schoolId: string, vehicleId: string): Promise<boolean> {
  const data = await readSchoolData(schoolId);
  const dayKey = String(new Date().getDay());
  const configured = data.weeklyWorkingVehicles?.[dayKey];
  if (configured === undefined) return true;
  return configured.includes(vehicleId);
}

// ---------------------------------------------------------------------------
// Daily Full Distribution
// ---------------------------------------------------------------------------

function countUniqueStudentsOnDay(data: StoreData, dayKey: string): number {
  const daySchedule = data.weeklySchedule[dayKey] || {};
  const u = new Set<string>();
  for (const session of data.sessions) {
    const studentIds = daySchedule[session.id] ?? session.studentIds;
    for (const sid of studentIds) {
      if (data.students.some((s) => s.id === sid)) u.add(sid);
    }
  }
  return u.size;
}

function buildDistributionForDay(data: StoreData, dayKey: string): {
  error?: string;
  distribution: DailyDistribution;
  groupCount: number;
  uniqueStudents: number;
  vehicleCount: number;
  warnings?: string[];
} {
  const uniqueOnDay = countUniqueStudentsOnDay(data, dayKey);
  if (uniqueOnDay === 0) {
    return { distribution: {}, groupCount: 0, uniqueStudents: 0, vehicleCount: 0 };
  }

  if (data.vehicles.length === 0) {
    return { error: "Araç tanımlanmamış. Önce Araçlar sekmesinden araç ekleyin.", distribution: {}, groupCount: 0, uniqueStudents: uniqueOnDay, vehicleCount: 0 };
  }

  const configured = data.weeklyWorkingVehicles?.[dayKey];
  let vehiclesToUse: Vehicle[];
  if (configured === undefined) {
    vehiclesToUse = data.vehicles;
  } else {
    if (configured.length === 0) {
      return {
        error: "Bu gün için çalışan araç seçilmedi. Önce listeden en az bir şoför işaretleyin.",
        distribution: {},
        groupCount: 0,
        uniqueStudents: uniqueOnDay,
        vehicleCount: 0,
      };
    }
    const allowed = new Set(configured);
    vehiclesToUse = data.vehicles.filter((v) => allowed.has(v.id));
    if (vehiclesToUse.length === 0) {
      return { error: "Seçilen araçlar bulunamadı.", distribution: {}, groupCount: 0, uniqueStudents: 0, vehicleCount: 0 };
    }
  }

  const daySchedule = data.weeklySchedule[dayKey] || {};
  const sortedSessions = [...data.sessions].sort((a, b) => a.time.localeCompare(b.time));

  const studentFirstSession = new Map<string, string>();
  const studentLastSession = new Map<string, string>();

  for (const session of sortedSessions) {
    const studentIds = daySchedule[session.id] ?? session.studentIds;
    for (const sid of studentIds) {
      if (!data.students.some((s) => s.id === sid)) continue;
      if (!studentFirstSession.has(sid)) studentFirstSession.set(sid, session.id);
      studentLastSession.set(sid, session.id);
    }
  }

  const pickupGroups = new Map<string, string[]>();
  for (const [sid, sessId] of studentFirstSession) {
    if (!pickupGroups.has(sessId)) pickupGroups.set(sessId, []);
    pickupGroups.get(sessId)!.push(sid);
  }

  const dropoffGroups = new Map<string, string[]>();
  for (const [sid, sessId] of studentLastSession) {
    if (!dropoffGroups.has(sessId)) dropoffGroups.set(sessId, []);
    dropoffGroups.get(sessId)!.push(sid);
  }

  const distribution: DailyDistribution = {};
  const warnAcc: string[] = [];

  for (const [sessId, sids] of pickupGroups) {
    const session = data.sessions.find((s) => s.id === sessId);
    if (!session) continue;
    const studs = data.students.filter((s) => sids.includes(s.id)).map((s) => ({ ...s, isActive: true }));
    if (studs.length === 0) continue;
    const result = distributeStudents(studs, vehiclesToUse, data.school);
    if (result.warnings?.length) warnAcc.push(...result.warnings);
    distribution[`pickup_${sessId}`] = {
      type: "pickup",
      time: session.time,
      sessionId: sessId,
      label: `${session.time} Toplama`,
      studentAssignments: reverseStopOrderPerVehicle(result.assignments),
    };
  }

  for (const [sessId, sids] of dropoffGroups) {
    const session = data.sessions.find((s) => s.id === sessId);
    if (!session) continue;
    const dropoffTime = addMinutesToTime(session.time, data.classDuration);
    const studs = data.students.filter((s) => sids.includes(s.id)).map((s) => ({ ...s, isActive: true }));
    if (studs.length === 0) continue;
    const result = distributeStudents(studs, vehiclesToUse, data.school);
    if (result.warnings?.length) warnAcc.push(...result.warnings);
    distribution[`dropoff_${sessId}`] = {
      type: "dropoff",
      time: dropoffTime,
      sessionId: sessId,
      label: `${dropoffTime} Dağıtım`,
      studentAssignments: result.assignments,
    };
  }

  const uniqueStudents = new Set(studentFirstSession.keys()).size;
  const uniqueWarn = [...new Set(warnAcc)];
  return {
    distribution,
    groupCount: Object.keys(distribution).length,
    uniqueStudents,
    vehicleCount: vehiclesToUse.length,
    warnings: uniqueWarn.length ? uniqueWarn : undefined,
  };
}

/** Yalnızca bugünün programına göre dağıtım üretir ve kaydeder. */
export async function distributeDailyAll(schoolId: string): Promise<{
  error?: string;
  groupCount?: number;
  uniqueStudents?: number;
  vehicleCount?: number;
  warnings?: string[];
}> {
  const data = await readSchoolData(schoolId);
  const map = ensureDistributionByDay(data);
  const dayKey = String(new Date().getDay());
  const built = buildDistributionForDay(data, dayKey);
  if (built.error) return { error: built.error };
  if (Object.keys(built.distribution).length === 0) {
    delete map[dayKey];
  } else {
    map[dayKey] = built.distribution;
  }
  await saveSchoolData(schoolId, data);
  return {
    groupCount: built.groupCount,
    uniqueStudents: built.uniqueStudents,
    vehicleCount: built.vehicleCount,
    warnings: built.warnings,
  };
}

export async function getDailyDistribution(schoolId: string): Promise<DailyDistribution | null> {
  return getTodayDistribution(await readSchoolData(schoolId));
}

export async function getVehicleCountSuggestionForDay(schoolId: string, dayKey: string): Promise<VehicleCountSuggestion | null> {
  const data = await readSchoolData(schoolId);
  if (data.vehicles.length === 0) return null;

  const daySchedule = data.weeklySchedule[dayKey] || {};
  const sortedSessions = [...data.sessions].sort((a, b) => a.time.localeCompare(b.time));

  const allStudentIdsOnDay = new Set<string>();
  for (const session of sortedSessions) {
    const ids = daySchedule[session.id] ?? session.studentIds;
    for (const sid of ids) {
      if (data.students.some((s) => s.id === sid)) allStudentIdsOnDay.add(sid);
    }
  }

  if (allStudentIdsOnDay.size === 0) return null;

  const studs = data.students
    .filter((s) => allStudentIdsOnDay.has(s.id))
    .map((s) => ({ ...s, isActive: true }));

  const configured = data.weeklyWorkingVehicles?.[dayKey];
  let vehiclesToUse = data.vehicles;
  if (configured !== undefined && configured.length > 0) {
    const allowed = new Set(configured);
    vehiclesToUse = data.vehicles.filter((v) => allowed.has(v.id));
  }
  if (vehiclesToUse.length === 0) vehiclesToUse = data.vehicles;

  return suggestVehicleCount(studs, vehiclesToUse, data.school);
}

export async function clearDailyDistributionToday(schoolId: string): Promise<void> {
  const data = await readSchoolData(schoolId);
  const map = ensureDistributionByDay(data);
  delete map[String(new Date().getDay())];
  await saveSchoolData(schoolId, data);
}

/** Araç başına `order` sırasını ters çevirir (toplama: okula yakın duraklar sonda kalır). */
function reverseStopOrderPerVehicle(assignments: SessionDistributionAssignment[]): SessionDistributionAssignment[] {
  const byVehicle = new Map<string, SessionDistributionAssignment[]>();
  for (const a of assignments) {
    if (!byVehicle.has(a.vehicleId)) byVehicle.set(a.vehicleId, []);
    byVehicle.get(a.vehicleId)!.push(a);
  }
  const result: SessionDistributionAssignment[] = [];
  for (const [vehicleId, items] of byVehicle) {
    items.sort((x, y) => x.order - y.order);
    const n = items.length;
    for (let i = 0; i < n; i++) {
      result.push({
        studentId: items[n - 1 - i].studentId,
        vehicleId,
        order: i,
      });
    }
  }
  return result;
}

function normalizeAssignmentsByVehicle(
  assignments: SessionDistributionAssignment[]
): SessionDistributionAssignment[] {
  const byVehicle = new Map<string, { studentId: string; order: number }[]>();
  for (const a of assignments) {
    if (!byVehicle.has(a.vehicleId)) byVehicle.set(a.vehicleId, []);
    byVehicle.get(a.vehicleId)!.push({ studentId: a.studentId, order: a.order });
  }
  const result: SessionDistributionAssignment[] = [];
  for (const [vId, items] of byVehicle) {
    items.sort((x, y) => x.order - y.order);
    items.forEach((item, idx) => {
      result.push({ studentId: item.studentId, vehicleId: vId, order: idx });
    });
  }
  return result;
}

/**
 * Bugünkü kayıtlı dağıtımdan öğrenciyi çıkarır; etkilenen her araçta durak sırasını yeniden optimize eder.
 * Araç–öğrenci ataması değişmez (sadece sıra ve listeden düşme).
 */
function pruneStudentFromTodayDistributionInMemory(data: StoreData, studentId: string): void {
  const map = ensureDistributionByDay(data);
  const dayKey = String(new Date().getDay());
  const today = map[dayKey];
  if (!today) return;

  const school = data.school;

  for (const groupId of Object.keys(today)) {
    const group = today[groupId];
    if (!group.studentAssignments.some((a) => a.studentId === studentId)) continue;

    const vehicleIds = [...new Set(group.studentAssignments.map((a) => a.vehicleId))];
    const nextAssign: SessionDistributionAssignment[] = [];

    for (const vehicleId of vehicleIds) {
      const prev = group.studentAssignments
        .filter((a) => a.vehicleId === vehicleId && a.studentId !== studentId)
        .sort((a, b) => a.order - b.order);
      const studs = prev
        .map((a) => data.students.find((s) => s.id === a.studentId))
        .filter((s): s is Student => !!s);
      if (studs.length === 0) continue;
      const ordered = optimizeStopOrderFromSchool(school, studs);
      ordered.forEach((s, order) => {
        nextAssign.push({ studentId: s.id, vehicleId, order });
      });
    }

    today[groupId] = {
      ...group,
      studentAssignments: normalizeAssignmentsByVehicle(nextAssign),
    };
  }

  map[dayKey] = today;
}

export async function updateDailyDistributionGroup(
  schoolId: string,
  groupId: string,
  assignments: SessionDistributionAssignment[]
): Promise<{ error?: string }> {
  const data = await readSchoolData(schoolId);
  const map = ensureDistributionByDay(data);
  const dayKey = String(new Date().getDay());
  const todayDist = map[dayKey];
  if (!todayDist) return { error: "Önce günü dağıtın." };
  if (!todayDist[groupId]) return { error: "Grup bulunamadı." };

  const vehicleIds = new Set(data.vehicles.map((v) => v.id));
  const seenStudents = new Set<string>();
  for (const a of assignments) {
    if (!vehicleIds.has(a.vehicleId)) return { error: "Geçersiz araç." };
    if (seenStudents.has(a.studentId)) return { error: "Aynı öğrenci iki kez eklenemez." };
    seenStudents.add(a.studentId);
  }

  const group = todayDist[groupId];
  todayDist[groupId] = {
    ...group,
    studentAssignments: normalizeAssignmentsByVehicle(assignments),
  };
  map[dayKey] = todayDist;
  await saveSchoolData(schoolId, data);
  return {};
}

export async function getGroupDistribution(schoolId: string, groupId: string, vehicleId: string): Promise<Student[]> {
  const data = await readSchoolData(schoolId);
  const dist = getTodayDistribution(data);
  if (!dist || !dist[groupId]) return [];

  const assignments = dist[groupId].studentAssignments
    .filter((a) => a.vehicleId === vehicleId)
    .sort((a, b) => a.order - b.order);

  return assignments
    .map((a) => data.students.find((s) => s.id === a.studentId))
    .filter((s): s is Student => !!s);
}

async function computeVehicleRouteDirections(
  schoolId: string,
  groupId: string,
  vehicleId: string,
  excludeStudentIds?: string[] | null,
): Promise<DriverRouteDirections | null> {
  const data = await readSchoolData(schoolId);
  const dist = getTodayDistribution(data);
  if (!dist || !dist[groupId]) return null;

  const group = dist[groupId];
  const assignments = group.studentAssignments
    .filter((a) => a.vehicleId === vehicleId)
    .sort((a, b) => a.order - b.order);

  let students = assignments
    .map((a) => data.students.find((s) => s.id === a.studentId))
    .filter((s): s is Student => !!s);

  if (excludeStudentIds?.length) {
    const skip = new Set(excludeStudentIds);
    students = students.filter((s) => !skip.has(s.id));
  }

  if (students.length === 0) return null;

  const schoolCoord = `${data.school.lat},${data.school.lng}`;

  if (group.type === "pickup") {
    const waypointPipe = students.map((s) => `${s.lat},${s.lng}`).join("|");
    return { mode: "pickup", destination: schoolCoord, waypointPipe };
  }

  const last = students[students.length - 1];
  const destination = `${last.lat},${last.lng}`;
  const waypointPipe = students.length > 1
    ? students.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join("|")
    : "";
  const url = buildGoogleMapsDrivingDirectionsUrl(
    schoolCoord,
    destination,
    waypointPipe || undefined,
  );
  return { mode: "dropoff", url };
}

/** Sunucu tarafı tam URL; pickup için başlangıç Google’ın “My+Location” metni (hassas değil). */
export async function generateRouteLinkForGroup(
  schoolId: string,
  groupId: string,
  vehicleId: string,
  excludeStudentIds?: string[] | null,
): Promise<string | null> {
  const plan = await computeVehicleRouteDirections(schoolId, groupId, vehicleId, excludeStudentIds);
  if (!plan) return null;
  if (plan.mode === "pickup") {
    return buildGoogleMapsDrivingDirectionsUrl("My+Location", plan.destination, plan.waypointPipe || undefined);
  }
  return plan.url;
}

/** Şoför istemcisi pickup için GPS ile `buildGoogleMapsDrivingDirectionsUrl` kullanır. */
export async function generateDriverRouteDirections(
  schoolId: string,
  groupId: string,
  vehicleId: string,
  excludeStudentIds?: string[] | null,
): Promise<DriverRouteDirections | null> {
  return computeVehicleRouteDirections(schoolId, groupId, vehicleId, excludeStudentIds);
}

// ---------------------------------------------------------------------------
// Şifre sıfırlama token dosyası (Firestore geçişinde koleksiyona taşınır)
// ---------------------------------------------------------------------------

export async function readPasswordResetTokens(): Promise<PasswordResetTokenRecord[]> {
  try {
    const raw = await getDataPersistence().readPasswordResetsJson();
    if (raw == null) return [];
    const parsed = JSON.parse(raw) as { tokens?: PasswordResetTokenRecord[] };
    return Array.isArray(parsed.tokens) ? parsed.tokens : [];
  } catch {
    return [];
  }
}

export async function writePasswordResetTokens(tokens: PasswordResetTokenRecord[]): Promise<void> {
  await getDataPersistence().writePasswordResetsJson(JSON.stringify({ tokens }, null, 2));
}
