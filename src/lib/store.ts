import { Student, Vehicle, Session, SchoolInfo, School, AppUser, RouteMode, DailyDistribution } from "./types";
import { distributeStudents } from "./optimizer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// File paths — school-scoped
// ---------------------------------------------------------------------------

const BASE_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");

function registryFile(): string {
  return path.join(BASE_DIR, "registry.json");
}

function schoolDataFile(schoolId: string): string {
  return path.join(BASE_DIR, "schools", `${schoolId}.json`);
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Registry: School list
// ---------------------------------------------------------------------------

interface RegistryData {
  schools: School[];
  users: AppUser[];
  nextSchoolId: number;
  nextUserId: number;
}

const DEFAULT_REGISTRY: RegistryData = { schools: [], users: [], nextSchoolId: 1, nextUserId: 1 };

function readRegistry(): RegistryData {
  try {
    const f = registryFile();
    if (fs.existsSync(f)) {
      const data = JSON.parse(fs.readFileSync(f, "utf-8")) as RegistryData;
      if (!data.schools) data.schools = [];
      if (!data.users) data.users = [];
      if (!data.nextSchoolId) data.nextSchoolId = 1;
      if (!data.nextUserId) data.nextUserId = 1;
      return data;
    }
  } catch { /* corrupted — reset */ }
  saveRegistry(DEFAULT_REGISTRY);
  return { ...DEFAULT_REGISTRY, schools: [], users: [] };
}

function saveRegistry(data: RegistryData) {
  const f = registryFile();
  ensureDir(f);
  fs.writeFileSync(f, JSON.stringify(data, null, 2), "utf-8");
}

export function getSchools(): School[] {
  return [...readRegistry().schools];
}

export function getSchoolById(id: string): School | null {
  return readRegistry().schools.find((s) => s.id === id) ?? null;
}

export function addSchool(input: Omit<School, "id" | "createdAt">): School {
  const reg = readRegistry();
  const school: School = {
    ...input,
    id: String(reg.nextSchoolId),
    createdAt: new Date().toISOString(),
  };
  reg.schools.push(school);
  reg.nextSchoolId++;
  saveRegistry(reg);

  const defaultData = makeDefaultSchoolData({
    label: school.label,
    lat: school.lat,
    lng: school.lng,
    mapsUrl: school.mapsUrl,
  });
  saveSchoolData(school.id, defaultData);
  return school;
}

export function updateSchoolRegistry(id: string, updates: Partial<Omit<School, "id" | "createdAt">>): School | null {
  const reg = readRegistry();
  const idx = reg.schools.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  reg.schools[idx] = { ...reg.schools[idx], ...updates };
  saveRegistry(reg);
  return reg.schools[idx];
}

export function deleteSchool(id: string): boolean {
  const reg = readRegistry();
  const len = reg.schools.length;
  reg.schools = reg.schools.filter((s) => s.id !== id);
  if (reg.schools.length < len) {
    saveRegistry(reg);
    const f = schoolDataFile(id);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    return true;
  }
  return false;
}

export function getSchoolStats(schoolId: string): { studentCount: number; vehicleCount: number; sessionCount: number } {
  const data = readSchoolData(schoolId);
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

export function getUsers(): AppUser[] {
  return [...readRegistry().users];
}

export function getUsersBySchool(schoolId: string): AppUser[] {
  return readRegistry().users.filter((u) => u.schoolId === schoolId);
}

export function getUserByEmail(email: string): AppUser | null {
  const lower = email.toLowerCase().trim();
  return readRegistry().users.find((u) => u.email.toLowerCase() === lower) ?? null;
}

export function getUserById(id: string): AppUser | null {
  return readRegistry().users.find((u) => u.id === id) ?? null;
}

export function createUser(input: {
  email: string;
  password: string;
  schoolId: string | null;
  role: "superadmin" | "admin";
}): AppUser | { error: string } {
  const reg = readRegistry();
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
  saveRegistry(reg);
  return user;
}

export function validateUser(email: string, password: string): AppUser | null {
  const user = getUserByEmail(email);
  if (!user) return null;
  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return null;
  return user;
}

export function changeUserPassword(userId: string, newPassword: string): boolean {
  return setUserPassword(userId, newPassword, false);
}

/** Süper admin şifre sıfırlama veya ilk atama; `mustChangePassword` genelde true (geçici şifre). */
export function setUserPassword(userId: string, newPassword: string, mustChangePassword: boolean): boolean {
  const reg = readRegistry();
  const idx = reg.users.findIndex((u) => u.id === userId);
  if (idx === -1) return false;
  const salt = makeSalt();
  reg.users[idx].salt = salt;
  reg.users[idx].passwordHash = hashPassword(newPassword, salt);
  reg.users[idx].mustChangePassword = mustChangePassword;
  saveRegistry(reg);
  return true;
}

export function deleteUser(userId: string): boolean {
  const reg = readRegistry();
  const len = reg.users.length;
  reg.users = reg.users.filter((u) => u.id !== userId);
  if (reg.users.length < len) {
    saveRegistry(reg);
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

const ALL_WEEK_DAY_KEYS = ["1", "2", "3", "4", "5", "6", "0"] as const;

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

function readSchoolData(schoolId: string): StoreData {
  try {
    const f = schoolDataFile(schoolId);
    if (fs.existsSync(f)) {
      const raw = fs.readFileSync(f, "utf-8");
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
  saveSchoolData(schoolId, empty);
  return empty;
}

function saveSchoolData(schoolId: string, data: StoreData) {
  const f = schoolDataFile(schoolId);
  ensureDir(f);
  fs.writeFileSync(f, JSON.stringify(data, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// School info (per-school)
// ---------------------------------------------------------------------------

export function getSchool(schoolId: string): SchoolInfo {
  return { ...readSchoolData(schoolId).school };
}

export function updateSchool(schoolId: string, school: SchoolInfo) {
  const data = readSchoolData(schoolId);
  data.school = school;
  saveSchoolData(schoolId, data);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function getSessions(schoolId: string): Session[] {
  return [...readSchoolData(schoolId).sessions];
}

export function getSessionById(schoolId: string, id: string): Session | null {
  const data = readSchoolData(schoolId);
  return data.sessions.find((s) => s.id === id) || null;
}

export function getCurrentSession(schoolId: string): Session | null {
  const data = readSchoolData(schoolId);
  if (!data.currentSessionId) return null;
  return data.sessions.find((s) => s.id === data.currentSessionId) || null;
}

export function getClassDuration(schoolId: string): number {
  return readSchoolData(schoolId).classDuration;
}

export function setClassDuration(schoolId: string, minutes: number) {
  const data = readSchoolData(schoolId);
  data.classDuration = Math.max(1, Math.min(120, minutes));
  saveSchoolData(schoolId, data);
}

export function addSession(schoolId: string, input: { label: string; time: string; studentIds: string[] }): Session {
  const data = readSchoolData(schoolId);
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

  saveSchoolData(schoolId, data);
  return session;
}

export function updateSession(schoolId: string, id: string, updates: { label?: string; time?: string; studentIds?: string[] }): Session | null {
  const data = readSchoolData(schoolId);
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

  saveSchoolData(schoolId, data);
  return updated;
}

export function deleteSession(schoolId: string, id: string): boolean {
  const data = readSchoolData(schoolId);
  const length = data.sessions.length;
  data.sessions = data.sessions.filter((s) => s.id !== id);

  for (const student of data.students) {
    student.sessionIds = student.sessionIds.filter((sid) => sid !== id);
  }

  if (data.currentSessionId === id) {
    data.currentSessionId = null;
  }

  if (data.sessions.length < length) {
    saveSchoolData(schoolId, data);
    return true;
  }
  return false;
}

export function loadSession(schoolId: string, sessionId: string): { error?: string; loaded?: number } {
  const data = readSchoolData(schoolId);
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
  saveSchoolData(schoolId, data);
  return { loaded };
}

// ---------------------------------------------------------------------------
// Weekly Schedule
// ---------------------------------------------------------------------------

export function getWeeklySchedule(schoolId: string): WeeklySchedule {
  return { ...readSchoolData(schoolId).weeklySchedule };
}

export function setWeeklyScheduleDay(schoolId: string, day: string, sessionId: string, studentIds: string[]) {
  const data = readSchoolData(schoolId);
  if (!data.weeklySchedule[day]) {
    data.weeklySchedule[day] = {};
  }
  data.weeklySchedule[day][sessionId] = studentIds;
  saveSchoolData(schoolId, data);
}

export function getWeeklyScheduleForDay(schoolId: string, day: string): { [sessionId: string]: string[] } {
  const data = readSchoolData(schoolId);
  return data.weeklySchedule[day] || {};
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export function getVehicles(schoolId: string): Vehicle[] {
  return [...readSchoolData(schoolId).vehicles];
}

export function getVehicleBySlug(schoolId: string, slug: string): Vehicle | null {
  const data = readSchoolData(schoolId);
  return data.vehicles.find((v) => v.slug === slug) || null;
}

export function getVehicleById(schoolId: string, id: string): Vehicle | null {
  const data = readSchoolData(schoolId);
  return data.vehicles.find((v) => v.id === id) || null;
}

/** Şoför giriş adı — küçük harf, trim. */
export function normalizeDriverUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isDriverLoginUsernameTaken(
  username: string,
  except?: { schoolId: string; vehicleId: string },
): boolean {
  const u = normalizeDriverUsername(username);
  if (u.length < 3) return true;
  for (const school of getSchools()) {
    const data = readSchoolData(school.id);
    for (const v of data.vehicles) {
      const vu = normalizeDriverUsername(v.loginUsername || "");
      if (!vu || vu !== u) continue;
      if (except && except.schoolId === school.id && except.vehicleId === v.id) continue;
      return true;
    }
  }
  return false;
}

export function findVehicleByLoginUsername(username: string): { schoolId: string; vehicle: Vehicle } | null {
  const u = normalizeDriverUsername(username);
  if (!u) return null;
  for (const school of getSchools()) {
    const data = readSchoolData(school.id);
    for (const v of data.vehicles) {
      const vu = normalizeDriverUsername(v.loginUsername || "");
      if (vu && vu === u) return { schoolId: school.id, vehicle: { ...v } };
    }
  }
  return null;
}

/** Şoför girişi: yalnızca kullanıcı adı (şifre yok). */
export function resolveDriverByUsername(username: string): { schoolId: string; vehicle: Vehicle } | null {
  const found = findVehicleByLoginUsername(username);
  if (!found) return null;
  const u = normalizeDriverUsername(found.vehicle.loginUsername || "");
  if (!u) return null;
  return found;
}

export function addVehicle(
  schoolId: string,
  input: { driverName: string; plate: string; capacity: number; loginUsername: string },
): Vehicle {
  const data = readSchoolData(schoolId);
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
  saveSchoolData(schoolId, data);
  return vehicle;
}

export function updateVehicle(schoolId: string, id: string, updates: Partial<Omit<Vehicle, "id" | "slug">>): Vehicle | null {
  const data = readSchoolData(schoolId);
  const index = data.vehicles.findIndex((v) => v.id === id);
  if (index === -1) return null;
  data.vehicles[index] = { ...data.vehicles[index], ...updates };
  saveSchoolData(schoolId, data);
  return data.vehicles[index];
}

export function deleteVehicle(schoolId: string, id: string): boolean {
  const data = readSchoolData(schoolId);
  const length = data.vehicles.length;
  data.vehicles = data.vehicles.filter((v) => v.id !== id);
  data.students.forEach((s) => {
    if (s.vehicleId === id) s.vehicleId = null;
  });
  if (data.vehicles.length < length) {
    saveSchoolData(schoolId, data);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export function getStudents(schoolId: string): Student[] {
  return [...readSchoolData(schoolId).students];
}

export function getStudentsByVehicle(schoolId: string, vehicleId: string): Student[] {
  return readSchoolData(schoolId).students.filter((s) => s.vehicleId === vehicleId);
}

export function addStudent(schoolId: string, input: Omit<Student, "id" | "isActive">): Student {
  const data = readSchoolData(schoolId);
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

  saveSchoolData(schoolId, data);
  return student;
}

export function updateStudent(schoolId: string, id: string, updates: Partial<Omit<Student, "id">>): Student | null {
  const data = readSchoolData(schoolId);
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

  saveSchoolData(schoolId, data);
  return data.students[index];
}

export function deleteStudent(schoolId: string, id: string): boolean {
  const data = readSchoolData(schoolId);
  const length = data.students.length;
  data.students = data.students.filter((s) => s.id !== id);

  for (const session of data.sessions) {
    session.studentIds = session.studentIds.filter((sId) => sId !== id);
  }

  if (data.students.length < length) {
    saveSchoolData(schoolId, data);
    return true;
  }
  return false;
}

export function toggleStudentActive(schoolId: string, id: string): Student | null {
  const data = readSchoolData(schoolId);
  const student = data.students.find((s) => s.id === id);
  if (!student) return null;
  student.isActive = !student.isActive;
  saveSchoolData(schoolId, data);
  return { ...student };
}

export function setAllStudentsActiveByVehicle(schoolId: string, vehicleId: string, active: boolean) {
  const data = readSchoolData(schoolId);
  data.students.forEach((s) => {
    if (s.vehicleId === vehicleId) s.isActive = active;
  });
  saveSchoolData(schoolId, data);
}

export function setAllStudentsActive(schoolId: string, active: boolean) {
  const data = readSchoolData(schoolId);
  data.students.forEach((s) => (s.isActive = active));
  saveSchoolData(schoolId, data);
}

export function assignStudentToVehicle(schoolId: string, studentId: string, vehicleId: string | null): Student | null {
  const data = readSchoolData(schoolId);
  const student = data.students.find((s) => s.id === studentId);
  if (!student) return null;
  student.vehicleId = vehicleId;
  saveSchoolData(schoolId, data);
  return { ...student };
}

export function reorderStudent(schoolId: string, id: string, direction: "up" | "down"): boolean {
  const data = readSchoolData(schoolId);
  const index = data.students.findIndex((s) => s.id === id);
  if (index === -1) return false;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= data.students.length) return false;

  [data.students[index], data.students[targetIndex]] = [data.students[targetIndex], data.students[index]];
  saveSchoolData(schoolId, data);
  return true;
}

// ---------------------------------------------------------------------------
// Working vehicles per day
// ---------------------------------------------------------------------------

export function getWorkingVehicleIdsForDay(schoolId: string, dayKey: string): string[] {
  const data = readSchoolData(schoolId);
  const allIds = data.vehicles.map((v) => v.id);
  const configured = data.weeklyWorkingVehicles?.[dayKey];
  if (configured === undefined) return [...allIds];
  return configured.filter((id) => allIds.includes(id));
}

export function setWorkingVehicleIdsForDay(schoolId: string, dayKey: string, vehicleIds: string[]): { error?: string } {
  const data = readSchoolData(schoolId);
  if (vehicleIds.length === 0) {
    return { error: "En az bir araç seçmelisiniz." };
  }
  const valid = new Set(data.vehicles.map((v) => v.id));
  for (const id of vehicleIds) {
    if (!valid.has(id)) return { error: "Geçersiz araç." };
  }
  if (!data.weeklyWorkingVehicles) data.weeklyWorkingVehicles = {};
  data.weeklyWorkingVehicles[dayKey] = vehicleIds;
  saveSchoolData(schoolId, data);
  return {};
}

export function isVehicleWorkingToday(schoolId: string, vehicleId: string): boolean {
  const data = readSchoolData(schoolId);
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

  for (const [sessId, sids] of pickupGroups) {
    const session = data.sessions.find((s) => s.id === sessId);
    if (!session) continue;
    const studs = data.students.filter((s) => sids.includes(s.id)).map((s) => ({ ...s, isActive: true }));
    if (studs.length === 0) continue;
    const result = distributeStudents(studs, vehiclesToUse, data.school);
    distribution[`pickup_${sessId}`] = {
      type: "pickup",
      time: session.time,
      sessionId: sessId,
      label: `${session.time} Toplama`,
      studentAssignments: result.assignments,
    };
  }

  for (const [sessId, sids] of dropoffGroups) {
    const session = data.sessions.find((s) => s.id === sessId);
    if (!session) continue;
    const dropoffTime = addMinutesToTime(session.time, data.classDuration);
    const studs = data.students.filter((s) => sids.includes(s.id)).map((s) => ({ ...s, isActive: true }));
    if (studs.length === 0) continue;
    const result = distributeStudents(studs, vehiclesToUse, data.school);
    distribution[`dropoff_${sessId}`] = {
      type: "dropoff",
      time: dropoffTime,
      sessionId: sessId,
      label: `${dropoffTime} Dağıtım`,
      studentAssignments: result.assignments,
    };
  }

  const uniqueStudents = new Set(studentFirstSession.keys()).size;
  return {
    distribution,
    groupCount: Object.keys(distribution).length,
    uniqueStudents,
    vehicleCount: vehiclesToUse.length,
  };
}

export function distributeDailyAll(schoolId: string, scope: "day" | "week"): {
  error?: string;
  groupCount?: number;
  uniqueStudents?: number;
  vehicleCount?: number;
  daysProcessed?: number;
  scope?: "day" | "week";
} {
  const data = readSchoolData(schoolId);
  const map = ensureDistributionByDay(data);

  const dayName: Record<string, string> = {
    "0": "Pazar", "1": "Pazartesi", "2": "Salı", "3": "Çarşamba", "4": "Perşembe", "5": "Cuma", "6": "Cumartesi",
  };

  if (scope === "day") {
    const dayKey = String(new Date().getDay());
    const built = buildDistributionForDay(data, dayKey);
    if (built.error) return { error: built.error };
    if (Object.keys(built.distribution).length === 0) {
      delete map[dayKey];
    } else {
      map[dayKey] = built.distribution;
    }
    saveSchoolData(schoolId, data);
    return {
      scope: "day",
      groupCount: built.groupCount,
      uniqueStudents: built.uniqueStudents,
      vehicleCount: built.vehicleCount,
    };
  }

  let daysWithDistribution = 0;
  let totalGroupCount = 0;
  for (const d of ALL_WEEK_DAY_KEYS) {
    const built = buildDistributionForDay(data, d);
    if (built.error) {
      return { error: `${dayName[d] ?? d}: ${built.error}` };
    }
    if (Object.keys(built.distribution).length === 0) {
      delete map[d];
    } else {
      map[d] = built.distribution;
      daysWithDistribution++;
      totalGroupCount += built.groupCount;
    }
  }

  saveSchoolData(schoolId, data);
  return {
    scope: "week",
    daysProcessed: daysWithDistribution,
    groupCount: totalGroupCount,
  };
}

export function getDailyDistribution(schoolId: string): DailyDistribution | null {
  return getTodayDistribution(readSchoolData(schoolId));
}

export function getDistributionDayKeysWithData(schoolId: string): string[] {
  const data = readSchoolData(schoolId);
  const map = ensureDistributionByDay(data);
  return Object.keys(map).filter((k) => Object.keys(map[k]).length > 0);
}

export function clearDailyDistributionToday(schoolId: string): void {
  const data = readSchoolData(schoolId);
  const map = ensureDistributionByDay(data);
  delete map[String(new Date().getDay())];
  saveSchoolData(schoolId, data);
}

export function clearAllDistributions(schoolId: string): void {
  const data = readSchoolData(schoolId);
  data.distributionByDay = {};
  saveSchoolData(schoolId, data);
}

export type SessionDistributionAssignment = {
  studentId: string;
  vehicleId: string;
  order: number;
};

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

export function updateDailyDistributionGroup(
  schoolId: string,
  groupId: string,
  assignments: SessionDistributionAssignment[]
): { error?: string } {
  const data = readSchoolData(schoolId);
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
  saveSchoolData(schoolId, data);
  return {};
}

export function getGroupDistribution(schoolId: string, groupId: string, vehicleId: string): Student[] {
  const data = readSchoolData(schoolId);
  const dist = getTodayDistribution(data);
  if (!dist || !dist[groupId]) return [];

  const assignments = dist[groupId].studentAssignments
    .filter((a) => a.vehicleId === vehicleId)
    .sort((a, b) => a.order - b.order);

  return assignments
    .map((a) => data.students.find((s) => s.id === a.studentId))
    .filter((s): s is Student => !!s);
}

export function generateRouteLinkForGroup(schoolId: string, groupId: string, vehicleId: string): string | null {
  const data = readSchoolData(schoolId);
  const dist = getTodayDistribution(data);
  if (!dist || !dist[groupId]) return null;

  const group = dist[groupId];
  const assignments = group.studentAssignments
    .filter((a) => a.vehicleId === vehicleId)
    .sort((a, b) => a.order - b.order);

  const students = assignments
    .map((a) => data.students.find((s) => s.id === a.studentId))
    .filter((s): s is Student => !!s);

  if (students.length === 0) return null;

  const schoolCoord = `${data.school.lat},${data.school.lng}`;

  if (group.type === "pickup") {
    const origin = "My+Location";
    const destination = schoolCoord;
    const waypointCoords = students.map((s) => `${s.lat},${s.lng}`).join("|");
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    if (waypointCoords) url += `&waypoints=${waypointCoords}`;
    return url;
  }

  const origin = schoolCoord;
  const last = students[students.length - 1];
  const destination = `${last.lat},${last.lng}`;
  const waypointCoords = students.length > 1
    ? students.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join("|")
    : "";
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypointCoords) url += `&waypoints=${waypointCoords}`;
  return url;
}

// ---------------------------------------------------------------------------
// Auto Distribution (legacy)
// ---------------------------------------------------------------------------

export function autoDistributeStudents(schoolId: string): { error?: string; distributed?: number } {
  const data = readSchoolData(schoolId);
  const active = data.students.filter((s) => s.isActive);
  const vehicles = data.vehicles;

  if (vehicles.length === 0) {
    return { error: "Araç tanımlanmamış. Önce Araçlar sekmesinden araç ekleyin." };
  }
  if (active.length === 0) {
    return { error: "Aktif öğrenci yok. Önce öğrencileri listeye ekleyin." };
  }

  const result = distributeStudents(active, vehicles, data.school);

  const assignmentMap = new Map<string, { vehicleId: string; order: number }>();
  for (const a of result.assignments) {
    assignmentMap.set(a.studentId, { vehicleId: a.vehicleId, order: a.order });
  }

  for (const student of data.students) {
    const assignment = assignmentMap.get(student.id);
    if (assignment) {
      student.vehicleId = assignment.vehicleId;
    }
  }

  data.students.sort((a, b) => {
    const aAssign = assignmentMap.get(a.id);
    const bAssign = assignmentMap.get(b.id);
    if (aAssign && !bAssign) return -1;
    if (!aAssign && bAssign) return 1;
    if (aAssign && bAssign) {
      if (aAssign.vehicleId !== bAssign.vehicleId) {
        return aAssign.vehicleId.localeCompare(bAssign.vehicleId);
      }
      return aAssign.order - bAssign.order;
    }
    return 0;
  });

  saveSchoolData(schoolId, data);
  return { distributed: result.assignments.length };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export function generateRouteLink(schoolId: string, mode: RouteMode, vehicleId?: string): string | null {
  const data = readSchoolData(schoolId);
  let active = data.students.filter((s) => s.isActive);
  if (vehicleId) {
    active = active.filter((s) => s.vehicleId === vehicleId);
  }
  if (active.length === 0) return null;

  const schoolCoord = `${data.school.lat},${data.school.lng}`;

  if (mode === "pickup") {
    const origin = "My+Location";
    const destination = schoolCoord;
    const waypointCoords = active.map((s) => `${s.lat},${s.lng}`).join("|");
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    if (waypointCoords) url += `&waypoints=${waypointCoords}`;
    return url;
  }

  const origin = schoolCoord;
  const last = active[active.length - 1];
  const destination = `${last.lat},${last.lng}`;
  const waypointCoords = active.length > 1
    ? active.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join("|")
    : "";
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypointCoords) url += `&waypoints=${waypointCoords}`;
  return url;
}
