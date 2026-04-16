import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import type { DataPersistence, RegistryData } from "./data-persistence";

const BASE_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");

function registryFile(): string {
  return path.join(BASE_DIR, "registry.json");
}

function schoolDataFile(schoolId: string): string {
  return path.join(BASE_DIR, "schools", `${schoolId}.json`);
}

function passwordResetsFilePath(): string {
  return path.join(BASE_DIR, "password-resets.json");
}

async function ensureDirForFile(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

const DEFAULT_REGISTRY: RegistryData = { schools: [], users: [], nextSchoolId: 1, nextUserId: 1 };

export const fileDataPersistence: DataPersistence = {
  async readRegistry(): Promise<RegistryData> {
    try {
      const f = registryFile();
      if (fsSync.existsSync(f)) {
        const raw = await fs.readFile(f, "utf-8");
        const data = JSON.parse(raw) as RegistryData;
        if (!data.schools) data.schools = [];
        if (!data.users) data.users = [];
        if (!data.nextSchoolId) data.nextSchoolId = 1;
        if (!data.nextUserId) data.nextUserId = 1;
        return data;
      }
    } catch {
      /* corrupted */
    }
    await fileDataPersistence.writeRegistry(DEFAULT_REGISTRY);
    return { ...DEFAULT_REGISTRY, schools: [], users: [] };
  },

  async writeRegistry(data: RegistryData): Promise<void> {
    const f = registryFile();
    await ensureDirForFile(f);
    await fs.writeFile(f, JSON.stringify(data, null, 2), "utf-8");
  },

  async readSchoolJson(schoolId: string): Promise<string | null> {
    const f = schoolDataFile(schoolId);
    if (!fsSync.existsSync(f)) return null;
    return fs.readFile(f, "utf-8");
  },

  async writeSchoolJson(schoolId: string, json: string): Promise<void> {
    const f = schoolDataFile(schoolId);
    await ensureDirForFile(f);
    await fs.writeFile(f, json, "utf-8");
  },

  async deleteSchoolData(schoolId: string): Promise<void> {
    const f = schoolDataFile(schoolId);
    if (fsSync.existsSync(f)) await fs.unlink(f);
  },

  async readPasswordResetsJson(): Promise<string | null> {
    const f = passwordResetsFilePath();
    if (!fsSync.existsSync(f)) return null;
    return fs.readFile(f, "utf-8");
  },

  async writePasswordResetsJson(json: string): Promise<void> {
    const f = passwordResetsFilePath();
    await ensureDirForFile(f);
    await fs.writeFile(f, json, "utf-8");
  },
};
