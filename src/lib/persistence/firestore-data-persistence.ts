import type { DataPersistence, RegistryData } from "./data-persistence";
import { getAdminFirestore } from "../firebase/admin-app";

const COLLECTION = (process.env.ROTA_FIRESTORE_COLLECTION || "rotaplan_data").trim() || "rotaplan_data";

const REGISTRY_ID = "_registry";
const PASSWORD_RESETS_ID = "_password_resets";
const schoolDocId = (schoolId: string) => `school_${schoolId}`;

function db() {
  return getAdminFirestore();
}

export const firestoreDataPersistence: DataPersistence = {
  async readRegistry(): Promise<RegistryData> {
    const snap = await db().collection(COLLECTION).doc(REGISTRY_ID).get();
    if (!snap.exists) {
      const empty: RegistryData = { schools: [], users: [], nextSchoolId: 1, nextUserId: 1 };
      await firestoreDataPersistence.writeRegistry(empty);
      return empty;
    }
    const raw = snap.get("json");
    if (raw == null) {
      const empty: RegistryData = { schools: [], users: [], nextSchoolId: 1, nextUserId: 1 };
      await firestoreDataPersistence.writeRegistry(empty);
      return empty;
    }
    let data: RegistryData;
    if (typeof raw === "string") {
      data = JSON.parse(raw) as RegistryData;
    } else if (typeof raw === "object") {
      data = raw as RegistryData;
    } else {
      const empty: RegistryData = { schools: [], users: [], nextSchoolId: 1, nextUserId: 1 };
      await firestoreDataPersistence.writeRegistry(empty);
      return empty;
    }
    if (!data.schools) data.schools = [];
    if (!data.users) data.users = [];
    if (!data.nextSchoolId) data.nextSchoolId = 1;
    if (!data.nextUserId) data.nextUserId = 1;
    return data;
  },

  async writeRegistry(data: RegistryData): Promise<void> {
    await db().collection(COLLECTION).doc(REGISTRY_ID).set({
      json: JSON.stringify(data, null, 2),
    });
  },

  async readSchoolJson(schoolId: string): Promise<string | null> {
    const snap = await db().collection(COLLECTION).doc(schoolDocId(schoolId)).get();
    if (!snap.exists) return null;
    const json = snap.get("json") as string | undefined;
    return json ?? null;
  },

  async writeSchoolJson(schoolId: string, json: string): Promise<void> {
    await db().collection(COLLECTION).doc(schoolDocId(schoolId)).set({ json });
  },

  async deleteSchoolData(schoolId: string): Promise<void> {
    await db().collection(COLLECTION).doc(schoolDocId(schoolId)).delete();
  },

  async readPasswordResetsJson(): Promise<string | null> {
    const snap = await db().collection(COLLECTION).doc(PASSWORD_RESETS_ID).get();
    if (!snap.exists) return null;
    const json = snap.get("json") as string | undefined;
    return json ?? null;
  },

  async writePasswordResetsJson(json: string): Promise<void> {
    await db().collection(COLLECTION).doc(PASSWORD_RESETS_ID).set({ json });
  },
};
