export interface Student {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  isActive: boolean;
  vehicleId: string | null;
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
