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

  if (!name || !label || !mapsUrl) {
    return { error: "Tüm alanlar zorunludur." };
  }

  const parsed = await parseMapsUrl(mapsUrl);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  addStudent({
    name,
    label,
    lat: parsed.coords.lat,
    lng: parsed.coords.lng,
    mapsUrl: parsed.resolvedUrl,
    vehicleId,
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

  if (!name || !label || !mapsUrl) {
    return { error: "Tüm alanlar zorunludur." };
  }

  const parsed = await parseMapsUrl(mapsUrl);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const result = updateStudent(id, {
    name,
    label,
    lat: parsed.coords.lat,
    lng: parsed.coords.lng,
    mapsUrl: parsed.resolvedUrl,
    vehicleId,
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

// --- Auto Distribution ---

export async function autoDistribute() {
  const result = autoDistributeStudents();
  revalidatePath("/");
  return result;
}

// --- Route ---

export async function getRouteLink(mode: RouteMode, vehicleId?: string) {
  return generateRouteLink(mode, vehicleId);
}
