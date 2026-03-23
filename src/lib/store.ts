import { Student, Vehicle, Session, SchoolInfo, RouteMode } from "./types";
import { distributeStudents } from "./optimizer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_FILE = process.env.VERCEL
  ? path.join("/tmp", "students.json")
  : path.join(process.cwd(), "data", "students.json");

// day keys: 1=Pazartesi, 2=Sali, 3=Carsamba, 4=Persembe, 5=Cuma
type WeeklySchedule = {
  [day: string]: {
    [sessionId: string]: string[];
  };
};

type DailyDistribution = {
  [sessionId: string]: {
    studentAssignments: { studentId: string; vehicleId: string; order: number }[];
  };
};

interface StoreData {
  school: SchoolInfo;
  students: Student[];
  vehicles: Vehicle[];
  sessions: Session[];
  weeklySchedule: WeeklySchedule;
  dailyDistribution: DailyDistribution | null;
  currentSessionId: string | null;
  nextId: number;
  nextVehicleId: number;
  nextSessionId: number;
}

const DEFAULT_DATA: StoreData = {
  school: {
    label: "Ereğli, Konya",
    lat: 37.5126,
    lng: 34.0489,
    mapsUrl: "https://www.google.com/maps/@37.5126,34.0489,15z",
  },
  students: [
    {
      id: "1",
      name: "Ahmet Yılmaz",
      label: "Barbaros Mah.",
      lat: 37.5185,
      lng: 34.0512,
      mapsUrl: "https://www.google.com/maps/@37.5185,34.0512,17z",
      isActive: false,
      vehicleId: null,
      sessionIds: ["1", "2"],
      contact1Name: "Baba Süleyman",
      contact1Phone: "505 226 91 88",
      contact2Name: "Anne Gülsüm",
      contact2Phone: "505 717 09 28",
    },
    {
      id: "2",
      name: "Elif Demir",
      label: "Cırgalan Mah.",
      lat: 37.5098,
      lng: 34.0378,
      mapsUrl: "https://www.google.com/maps/@37.5098,34.0378,17z",
      isActive: false,
      vehicleId: null,
      sessionIds: ["1", "2"],
      contact1Name: "Baba Osman",
      contact1Phone: "541 369 29 89",
      contact2Name: "Anne Hacer",
      contact2Phone: "505 724 66 20",
    },
    {
      id: "3",
      name: "Can Özkan",
      label: "Zengen Mah.",
      lat: 37.5211,
      lng: 34.0601,
      mapsUrl: "https://www.google.com/maps/@37.5211,34.0601,17z",
      isActive: false,
      vehicleId: null,
      sessionIds: ["3", "4"],
      contact1Name: "",
      contact1Phone: "",
      contact2Name: "",
      contact2Phone: "",
    },
    {
      id: "4",
      name: "Zeynep Kaya",
      label: "Orta Mah.",
      lat: 37.515,
      lng: 34.045,
      mapsUrl: "https://www.google.com/maps/@37.5150,34.0450,17z",
      isActive: false,
      vehicleId: null,
      sessionIds: ["3", "4"],
      contact1Name: "",
      contact1Phone: "",
      contact2Name: "",
      contact2Phone: "",
    },
    {
      id: "5",
      name: "Mehmet Çelik",
      label: "Selçuklu Mah.",
      lat: 37.523,
      lng: 34.055,
      mapsUrl: "https://www.google.com/maps/@37.5230,34.0550,17z",
      isActive: false,
      vehicleId: null,
      sessionIds: ["1", "2", "3", "4"],
      contact1Name: "",
      contact1Phone: "",
      contact2Name: "",
      contact2Phone: "",
    },
    {
      id: "6",
      name: "Ayşe Yıldız",
      label: "Atatürk Mah.",
      lat: 37.507,
      lng: 34.042,
      mapsUrl: "https://www.google.com/maps/@37.5070,34.0420,17z",
      isActive: false,
      vehicleId: null,
      sessionIds: ["1", "2"],
      contact1Name: "",
      contact1Phone: "",
      contact2Name: "",
      contact2Phone: "",
    },
  ],
  vehicles: [
    {
      id: "1",
      slug: "servis-a",
      driverName: "Ali Usta",
      plate: "42 ABC 001",
      capacity: 8,
    },
    {
      id: "2",
      slug: "servis-b",
      driverName: "Veli Usta",
      plate: "42 ABC 002",
      capacity: 8,
    },
  ],
  sessions: [
    { id: "1", label: "09:00 Giriş", time: "09:00", type: "pickup", studentIds: ["1", "2", "5", "6"] },
    { id: "2", label: "09:40 Çıkış", time: "09:40", type: "dropoff", studentIds: ["1", "2", "5", "6"] },
    { id: "3", label: "10:00 Giriş", time: "10:00", type: "pickup", studentIds: ["3", "4", "5"] },
    { id: "4", label: "10:40 Çıkış", time: "10:40", type: "dropoff", studentIds: ["3", "4", "5"] },
  ],
  weeklySchedule: {
    "1": { "1": ["1", "2", "5", "6"], "2": ["1", "2", "5", "6"], "3": ["3", "4", "5"], "4": ["3", "4", "5"] },
    "2": { "1": ["1", "2", "5", "6"], "2": ["1", "2", "5", "6"], "3": ["3", "4", "5"], "4": ["3", "4", "5"] },
    "3": { "1": ["1", "2", "5", "6"], "2": ["1", "2", "5", "6"], "3": ["3", "4", "5"], "4": ["3", "4", "5"] },
    "4": { "1": ["1", "2", "5", "6"], "2": ["1", "2", "5", "6"], "3": ["3", "4", "5"], "4": ["3", "4", "5"] },
    "5": { "1": ["1", "2", "5", "6"], "2": ["1", "2", "5", "6"], "3": ["3", "4", "5"], "4": ["3", "4", "5"] },
  },
  dailyDistribution: null,
  currentSessionId: null,
  nextId: 7,
  nextVehicleId: 3,
  nextSessionId: 5,
};

function generateSlug(): string {
  return crypto.randomBytes(4).toString("hex");
}

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readData(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (!data.school) data.school = DEFAULT_DATA.school;
      if (!data.vehicles) data.vehicles = [];
      if (!data.nextVehicleId) data.nextVehicleId = 1;
      if (!data.sessions) data.sessions = [];
      if (!data.nextSessionId) data.nextSessionId = 1;
      if (data.currentSessionId === undefined) data.currentSessionId = null;
      if (!data.weeklySchedule) data.weeklySchedule = {};
      if (data.dailyDistribution === undefined) data.dailyDistribution = null;
      data.students = (data.students || []).map((s: Student) => ({
        ...s,
        vehicleId: s.vehicleId ?? null,
        sessionIds: s.sessionIds ?? [],
        contact1Name: s.contact1Name ?? "",
        contact1Phone: s.contact1Phone ?? "",
        contact2Name: s.contact2Name ?? "",
        contact2Phone: s.contact2Phone ?? "",
      }));
      return data;
    }
  } catch {
    // corrupted — reset
  }
  saveData(DEFAULT_DATA);
  return DEFAULT_DATA;
}

function saveData(data: StoreData) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// --- School ---

export function getSchool(): SchoolInfo {
  return { ...readData().school };
}

export function updateSchool(school: SchoolInfo) {
  const data = readData();
  data.school = school;
  saveData(data);
}

// --- Sessions ---

export function getSessions(): Session[] {
  return [...readData().sessions];
}

export function getSessionById(id: string): Session | null {
  const data = readData();
  return data.sessions.find((s) => s.id === id) || null;
}

export function getCurrentSession(): Session | null {
  const data = readData();
  if (!data.currentSessionId) return null;
  return data.sessions.find((s) => s.id === data.currentSessionId) || null;
}

export function addSession(input: { label: string; time: string; type: "pickup" | "dropoff"; studentIds: string[] }): Session {
  const data = readData();
  const session: Session = {
    id: String(data.nextSessionId),
    label: input.label,
    time: input.time,
    type: input.type,
    studentIds: input.studentIds,
  };
  data.sessions.push(session);
  data.nextSessionId++;

  // Sync sessionIds on students
  for (const student of data.students) {
    if (input.studentIds.includes(student.id) && !student.sessionIds.includes(session.id)) {
      student.sessionIds.push(session.id);
    }
  }

  saveData(data);
  return session;
}

export function updateSession(id: string, updates: { label?: string; time?: string; type?: "pickup" | "dropoff"; studentIds?: string[] }): Session | null {
  const data = readData();
  const index = data.sessions.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const old = data.sessions[index];
  data.sessions[index] = { ...old, ...updates };
  const updated = data.sessions[index];

  // Sync sessionIds on students if studentIds changed
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

  saveData(data);
  return updated;
}

export function deleteSession(id: string): boolean {
  const data = readData();
  const length = data.sessions.length;
  data.sessions = data.sessions.filter((s) => s.id !== id);

  // Remove session from students
  for (const student of data.students) {
    student.sessionIds = student.sessionIds.filter((sid) => sid !== id);
  }

  if (data.currentSessionId === id) {
    data.currentSessionId = null;
  }

  if (data.sessions.length < length) {
    saveData(data);
    return true;
  }
  return false;
}

export function loadSession(sessionId: string): { error?: string; loaded?: number } {
  const data = readData();
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return { error: "Seans bulunamadı." };

  // Determine which students to load: check weekly schedule first
  const today = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const dayKey = String(today);
  const daySchedule = data.weeklySchedule[dayKey];
  const studentIds = daySchedule?.[sessionId] ?? session.studentIds;

  // Deactivate all students and clear vehicle assignments
  for (const student of data.students) {
    student.isActive = false;
    student.vehicleId = null;
  }

  // Activate students
  let loaded = 0;
  for (const student of data.students) {
    if (studentIds.includes(student.id)) {
      student.isActive = true;
      loaded++;
    }
  }

  data.currentSessionId = sessionId;
  saveData(data);
  return { loaded };
}

// --- Weekly Schedule ---

export function getWeeklySchedule(): WeeklySchedule {
  return { ...readData().weeklySchedule };
}

export function setWeeklyScheduleDay(day: string, sessionId: string, studentIds: string[]) {
  const data = readData();
  if (!data.weeklySchedule[day]) {
    data.weeklySchedule[day] = {};
  }
  data.weeklySchedule[day][sessionId] = studentIds;
  saveData(data);
}

export function getWeeklyScheduleForDay(day: string): { [sessionId: string]: string[] } {
  const data = readData();
  return data.weeklySchedule[day] || {};
}

// --- Vehicles ---

export function getVehicles(): Vehicle[] {
  return [...readData().vehicles];
}

export function getVehicleBySlug(slug: string): Vehicle | null {
  const data = readData();
  return data.vehicles.find((v) => v.slug === slug) || null;
}

export function getVehicleById(id: string): Vehicle | null {
  const data = readData();
  return data.vehicles.find((v) => v.id === id) || null;
}

export function addVehicle(input: { driverName: string; plate: string; capacity: number }): Vehicle {
  const data = readData();
  const vehicle: Vehicle = {
    id: String(data.nextVehicleId),
    slug: generateSlug(),
    driverName: input.driverName,
    plate: input.plate,
    capacity: input.capacity,
  };
  data.vehicles.push(vehicle);
  data.nextVehicleId++;
  saveData(data);
  return vehicle;
}

export function updateVehicle(id: string, updates: Partial<Omit<Vehicle, "id" | "slug">>): Vehicle | null {
  const data = readData();
  const index = data.vehicles.findIndex((v) => v.id === id);
  if (index === -1) return null;
  data.vehicles[index] = { ...data.vehicles[index], ...updates };
  saveData(data);
  return data.vehicles[index];
}

export function deleteVehicle(id: string): boolean {
  const data = readData();
  const length = data.vehicles.length;
  data.vehicles = data.vehicles.filter((v) => v.id !== id);
  data.students.forEach((s) => {
    if (s.vehicleId === id) s.vehicleId = null;
  });
  if (data.vehicles.length < length) {
    saveData(data);
    return true;
  }
  return false;
}

// --- Students ---

export function getStudents(): Student[] {
  return [...readData().students];
}

export function getStudentsByVehicle(vehicleId: string): Student[] {
  return readData().students.filter((s) => s.vehicleId === vehicleId);
}

export function addStudent(input: Omit<Student, "id" | "isActive">): Student {
  const data = readData();
  const student: Student = {
    ...input,
    id: String(data.nextId),
    isActive: false,
  };
  data.students.push(student);
  data.nextId++;

  // Sync: add student to their sessions' studentIds
  for (const sid of student.sessionIds) {
    const session = data.sessions.find((s) => s.id === sid);
    if (session && !session.studentIds.includes(student.id)) {
      session.studentIds.push(student.id);
    }
  }

  saveData(data);
  return student;
}

export function updateStudent(id: string, updates: Partial<Omit<Student, "id">>): Student | null {
  const data = readData();
  const index = data.students.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const oldSessionIds = data.students[index].sessionIds || [];
  data.students[index] = { ...data.students[index], ...updates };
  const newSessionIds = data.students[index].sessionIds || [];

  // Sync sessions when sessionIds change
  if (updates.sessionIds) {
    // Remove student from old sessions
    for (const sid of oldSessionIds) {
      if (!newSessionIds.includes(sid)) {
        const session = data.sessions.find((s) => s.id === sid);
        if (session) {
          session.studentIds = session.studentIds.filter((sId) => sId !== id);
        }
      }
    }
    // Add student to new sessions
    for (const sid of newSessionIds) {
      if (!oldSessionIds.includes(sid)) {
        const session = data.sessions.find((s) => s.id === sid);
        if (session && !session.studentIds.includes(id)) {
          session.studentIds.push(id);
        }
      }
    }
  }

  saveData(data);
  return data.students[index];
}

export function deleteStudent(id: string): boolean {
  const data = readData();
  const length = data.students.length;
  data.students = data.students.filter((s) => s.id !== id);

  // Remove student from all sessions
  for (const session of data.sessions) {
    session.studentIds = session.studentIds.filter((sId) => sId !== id);
  }

  if (data.students.length < length) {
    saveData(data);
    return true;
  }
  return false;
}

export function toggleStudentActive(id: string): Student | null {
  const data = readData();
  const student = data.students.find((s) => s.id === id);
  if (!student) return null;
  student.isActive = !student.isActive;
  saveData(data);
  return { ...student };
}

export function setAllStudentsActiveByVehicle(vehicleId: string, active: boolean) {
  const data = readData();
  data.students.forEach((s) => {
    if (s.vehicleId === vehicleId) s.isActive = active;
  });
  saveData(data);
}

export function setAllStudentsActive(active: boolean) {
  const data = readData();
  data.students.forEach((s) => (s.isActive = active));
  saveData(data);
}

export function assignStudentToVehicle(studentId: string, vehicleId: string | null): Student | null {
  const data = readData();
  const student = data.students.find((s) => s.id === studentId);
  if (!student) return null;
  student.vehicleId = vehicleId;
  saveData(data);
  return { ...student };
}

export function reorderStudent(id: string, direction: "up" | "down"): boolean {
  const data = readData();
  const index = data.students.findIndex((s) => s.id === id);
  if (index === -1) return false;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= data.students.length) return false;

  [data.students[index], data.students[targetIndex]] = [data.students[targetIndex], data.students[index]];
  saveData(data);
  return true;
}

// --- Daily Full Distribution ---

export function distributeDailyAll(): { error?: string; sessionCount?: number; totalStudents?: number } {
  const data = readData();
  const vehicles = data.vehicles;

  if (vehicles.length === 0) {
    return { error: "Araç tanımlanmamış. Önce Araçlar sekmesinden araç ekleyin." };
  }

  const today = new Date().getDay();
  const dayKey = String(today);
  const daySchedule = data.weeklySchedule[dayKey] || {};

  const distribution: DailyDistribution = {};
  let totalStudents = 0;

  for (const session of data.sessions) {
    const studentIds = daySchedule[session.id] ?? session.studentIds;
    const sessionStudents = data.students
      .filter((s) => studentIds.includes(s.id))
      .map((s) => ({ ...s, isActive: true }));

    if (sessionStudents.length === 0) {
      distribution[session.id] = { studentAssignments: [] };
      continue;
    }

    const result = distributeStudents(sessionStudents, vehicles, data.school);
    distribution[session.id] = { studentAssignments: result.assignments };
    totalStudents += result.assignments.length;
  }

  data.dailyDistribution = distribution;
  saveData(data);
  return { sessionCount: data.sessions.length, totalStudents };
}

export function getDailyDistribution(): DailyDistribution | null {
  return readData().dailyDistribution;
}

export function getSessionDistribution(sessionId: string, vehicleId: string): Student[] {
  const data = readData();
  const dist = data.dailyDistribution;
  if (!dist || !dist[sessionId]) return [];

  const assignments = dist[sessionId].studentAssignments
    .filter((a) => a.vehicleId === vehicleId)
    .sort((a, b) => a.order - b.order);

  return assignments
    .map((a) => data.students.find((s) => s.id === a.studentId))
    .filter((s): s is Student => !!s);
}

export function generateRouteLinkForSession(sessionId: string, vehicleId: string): string | null {
  const data = readData();
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  const dist = data.dailyDistribution;
  if (!dist || !dist[sessionId]) return null;

  const assignments = dist[sessionId].studentAssignments
    .filter((a) => a.vehicleId === vehicleId)
    .sort((a, b) => a.order - b.order);

  const students = assignments
    .map((a) => data.students.find((s) => s.id === a.studentId))
    .filter((s): s is Student => !!s);

  if (students.length === 0) return null;

  const schoolCoord = `${data.school.lat},${data.school.lng}`;
  const mode = session.type;

  if (mode === "pickup") {
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

// --- Auto Distribution (legacy) ---

export function autoDistributeStudents(): { error?: string; distributed?: number } {
  const data = readData();
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

  saveData(data);
  return { distributed: result.assignments.length };
}

// --- Route ---

export function generateRouteLink(mode: RouteMode, vehicleId?: string): string | null {
  const data = readData();
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
    if (waypointCoords) {
      url += `&waypoints=${waypointCoords}`;
    }
    return url;
  }

  const origin = schoolCoord;
  const last = active[active.length - 1];
  const destination = `${last.lat},${last.lng}`;

  const waypointCoords = active.length > 1
    ? active.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join("|")
    : "";

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypointCoords) {
    url += `&waypoints=${waypointCoords}`;
  }
  return url;
}
