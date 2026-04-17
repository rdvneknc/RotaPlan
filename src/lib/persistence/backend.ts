import type { AppStore } from "./app-store";
import { fileAppStore } from "./file-store-adapter";
import { setDataPersistence } from "./data-persistence-singleton";
import { fileDataPersistence } from "./file-data-persistence";
import { firestoreDataPersistence } from "./firestore-data-persistence";

let cached: AppStore | null = null;
let configuredMode: string | null = null;

/**
 * `ROTA_DATA_BACKEND`: `file` (varsayılan) | `firestore`
 * Firestore için `FIREBASE_SERVICE_ACCOUNT_JSON` ve konsolda Firestore veritabanı gerekir.
 */
export function getAppStore(): AppStore {
  const mode = (process.env["ROTA_DATA_BACKEND"] || "file").toLowerCase().trim();
  if (!cached || configuredMode !== mode) {
    setDataPersistence(mode === "firestore" ? firestoreDataPersistence : fileDataPersistence);
    cached = fileAppStore;
    configuredMode = mode;
  }
  return cached;
}
