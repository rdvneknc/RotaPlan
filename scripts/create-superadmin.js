/**
 * Creates (or resets) the superadmin user.
 * Usage: node scripts/create-superadmin.js <email> <password>
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const REGISTRY_FILE = path.join(DATA_DIR, "registry.json");

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function run() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log("Kullanım: node scripts/create-superadmin.js <email> <şifre>");
    process.exit(1);
  }

  if (!fs.existsSync(REGISTRY_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify({ schools: [], users: [], nextSchoolId: 1, nextUserId: 1 }, null, 2));
  }

  const reg = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
  if (!reg.users) reg.users = [];
  if (!reg.nextUserId) reg.nextUserId = 1;

  const existing = reg.users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  const salt = crypto.randomBytes(16).toString("hex");

  const user = {
    id: existing >= 0 ? reg.users[existing].id : String(reg.nextUserId),
    email: email.toLowerCase(),
    passwordHash: hashPassword(password, salt),
    salt,
    schoolId: null,
    role: "superadmin",
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    reg.users[existing] = user;
    console.log(`Superadmin güncellendi: ${email}`);
  } else {
    reg.users.push(user);
    reg.nextUserId++;
    console.log(`Superadmin oluşturuldu: ${email}`);
  }

  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2), "utf-8");
  console.log("Giriş: /login sayfasından bu e-posta ve şifre ile giriş yapabilirsiniz.");
}

run();
