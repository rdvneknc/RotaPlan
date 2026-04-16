import type { AppUser, School } from "../types";
import type { PasswordResetTokenRecord } from "./password-reset-tokens";

/** `file-store` içi registry yapısı — dosya ve Firestore aynı JSON şemasını kullanır. */
export interface RegistryData {
  schools: School[];
  users: AppUser[];
  nextSchoolId: number;
  nextUserId: number;
}

/**
 * Ham okul JSON’u (file-store iç `StoreData` ile aynı içerik).
 * Okul belgesi olarak string saklanır; parse `file-store` içinde kalır.
 */
export interface DataPersistence {
  readRegistry(): Promise<RegistryData>;
  writeRegistry(data: RegistryData): Promise<void>;
  /** Okul dosyası yoksa `null`. */
  readSchoolJson(schoolId: string): Promise<string | null>;
  writeSchoolJson(schoolId: string, json: string): Promise<void>;
  deleteSchoolData(schoolId: string): Promise<void>;
  readPasswordResetsJson(): Promise<string | null>;
  writePasswordResetsJson(json: string): Promise<void>;
}

export type { PasswordResetTokenRecord };
