export interface Student {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  isActive: boolean;
  vehicleId: string | null;
  sessionIds: string[];
  contact1Name: string;
  contact1Phone: string;
  contact2Name: string;
  contact2Phone: string;
}

export interface Session {
  id: string;
  label: string;
  time: string; // ders başlangıç saati, ör. "09:00"
  studentIds: string[];
}

export interface DistributionGroup {
  type: "pickup" | "dropoff";
  time: string;
  sessionId: string;
  label: string;
  studentAssignments: { studentId: string; vehicleId: string; order: number }[];
}

export type DailyDistribution = {
  [groupId: string]: DistributionGroup;
};

/** Şoför için rota bilgisi: pickup ise başlangıç `navigator.geolocation` ile eklenir. */
export type DriverRouteDirections =
  | { mode: "pickup"; destination: string; waypointPipe: string }
  | { mode: "dropoff"; url: string };

/** Günlük dağıtım grubunda araç–öğrenci sırası (manuel düzenleme / API). */
export interface SessionDistributionAssignment {
  studentId: string;
  vehicleId: string;
  order: number;
}

export interface Vehicle {
  id: string;
  slug: string;
  driverName: string;
  plate: string;
  capacity: number;
  /** Şoför girişi — küçük harf, tüm okullarda benzersiz (şifre yok) */
  loginUsername: string;
}

export interface SchoolInfo {
  label: string;
  lat: number;
  lng: number;
  mapsUrl: string;
}

export interface School {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  adminEmail?: string;
  /** Google Sheets dosya ID’si (URL’den veya düz ID). */
  googleSheetId?: string;
  createdAt: string;
}

export interface AppUser {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  schoolId: string | null;
  role: "superadmin" | "admin";
  mustChangePassword: boolean;
  createdAt: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}
