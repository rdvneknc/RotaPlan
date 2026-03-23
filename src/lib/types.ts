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
  time: string;
  type: "pickup" | "dropoff";
  studentIds: string[];
}

export interface Vehicle {
  id: string;
  slug: string;
  driverName: string;
  plate: string;
  capacity: number;
}

export interface SchoolInfo {
  label: string;
  lat: number;
  lng: number;
  mapsUrl: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export type RouteMode = "pickup" | "dropoff";
