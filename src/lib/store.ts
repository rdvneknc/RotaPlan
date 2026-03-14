import { Student, Vehicle, SchoolInfo, RouteMode } from "./types";
import { distributeStudents } from "./optimizer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_FILE = process.env.VERCEL
  ? path.join("/tmp", "students.json")
  : path.join(process.cwd(), "data", "students.json");

interface StoreData {
  school: SchoolInfo;
  students: Student[];
  vehicles: Vehicle[];
  nextId: number;
  nextVehicleId: number;
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
      isActive: true,
      vehicleId: null,
    },
    {
      id: "2",
      name: "Elif Demir",
      label: "Cırgalan Mah.",
      lat: 37.5098,
      lng: 34.0378,
      mapsUrl: "https://www.google.com/maps/@37.5098,34.0378,17z",
      isActive: true,
      vehicleId: null,
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
    },
  ],
  vehicles: [],
  nextId: 4,
  nextVehicleId: 1,
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
      data.students = (data.students || []).map((s: Student) => ({
        ...s,
        vehicleId: s.vehicleId ?? null,
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
  // unassign students from deleted vehicle
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
    isActive: true,
  };
  data.students.push(student);
  data.nextId++;
  saveData(data);
  return student;
}

export function updateStudent(id: string, updates: Partial<Omit<Student, "id">>): Student | null {
  const data = readData();
  const index = data.students.findIndex((s) => s.id === id);
  if (index === -1) return null;
  data.students[index] = { ...data.students[index], ...updates };
  saveData(data);
  return data.students[index];
}

export function deleteStudent(id: string): boolean {
  const data = readData();
  const length = data.students.length;
  data.students = data.students.filter((s) => s.id !== id);
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

// --- Auto Distribution ---

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

  // Apply assignments and reorder students
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

  // Sort students: assigned+active first (by vehicle then order), then rest
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

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
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

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  if (waypointCoords) {
    url += `&waypoints=${waypointCoords}`;
  }
  return url;
}
