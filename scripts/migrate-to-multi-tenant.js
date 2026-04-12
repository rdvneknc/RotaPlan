/**
 * Migration: single-tenant students.json → multi-tenant school-scoped files.
 *
 * Moves data/students.json → data/schools/default.json
 * Creates data/registry.json with one "default" school entry.
 *
 * Safe to run multiple times — skips if already migrated.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const OLD_FILE = path.join(DATA_DIR, "students.json");
const SCHOOLS_DIR = path.join(DATA_DIR, "schools");
const NEW_FILE = path.join(SCHOOLS_DIR, "default.json");
const REGISTRY_FILE = path.join(DATA_DIR, "registry.json");

function run() {
  if (!fs.existsSync(OLD_FILE)) {
    console.log("students.json bulunamadı — zaten taşınmış veya boş proje.");

    if (!fs.existsSync(REGISTRY_FILE)) {
      const emptyRegistry = { schools: [], nextSchoolId: 1 };
      fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(emptyRegistry, null, 2), "utf-8");
      console.log("Boş registry.json oluşturuldu.");
    }
    return;
  }

  if (!fs.existsSync(SCHOOLS_DIR)) {
    fs.mkdirSync(SCHOOLS_DIR, { recursive: true });
  }

  const raw = fs.readFileSync(OLD_FILE, "utf-8");
  const data = JSON.parse(raw);

  fs.writeFileSync(NEW_FILE, JSON.stringify(data, null, 2), "utf-8");
  console.log(`students.json → schools/default.json taşındı.`);

  const schoolInfo = data.school || { label: "Varsayılan Okul", lat: 0, lng: 0, mapsUrl: "" };

  const registry = {
    schools: [
      {
        id: "default",
        name: schoolInfo.label || "Varsayılan Okul",
        label: schoolInfo.label || "",
        lat: schoolInfo.lat || 0,
        lng: schoolInfo.lng || 0,
        mapsUrl: schoolInfo.mapsUrl || "",
        createdAt: new Date().toISOString(),
      },
    ],
    nextSchoolId: 2,
  };

  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), "utf-8");
  console.log("registry.json oluşturuldu (default okul ile).");

  const backupFile = path.join(DATA_DIR, "students.json.bak");
  fs.renameSync(OLD_FILE, backupFile);
  console.log(`Eski dosya yedeklendi: students.json → students.json.bak`);

  console.log("\nMigrasyon tamamlandı!");
  console.log(`Admin paneli: /admin/default`);
  console.log(`Şoför paneli: /sofor/default`);
}

run();
