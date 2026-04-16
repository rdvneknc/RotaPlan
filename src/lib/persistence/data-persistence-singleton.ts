import type { DataPersistence } from "./data-persistence";

let current: DataPersistence | null = null;

export function setDataPersistence(p: DataPersistence): void {
  current = p;
}

export function getDataPersistence(): DataPersistence {
  if (!current) {
    throw new Error("DataPersistence not configured — call setDataPersistence from backend first.");
  }
  return current;
}
