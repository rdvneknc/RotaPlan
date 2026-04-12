/**
 * Minify GOOGLE_SERVICE_ACCOUNT_JSON in .env.local to one line.
 * Run: node scripts/minify-env-google-json.js
 */
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const raw = fs.readFileSync(envPath, "utf-8");

const key = "GOOGLE_SERVICE_ACCOUNT_JSON=";
const keyIdx = raw.indexOf(key);
if (keyIdx === -1) {
  console.error("Missing GOOGLE_SERVICE_ACCOUNT_JSON=");
  process.exit(1);
}

const before = raw.slice(0, keyIdx).replace(/\s+$/, "");
const afterKey = raw.slice(keyIdx + key.length);
const start = afterKey.indexOf("{");
if (start === -1) {
  console.error("No JSON object after =");
  process.exit(1);
}

const jsonBody = afterKey.slice(start);
let depth = 0;
let end = -1;
for (let i = 0; i < jsonBody.length; i++) {
  const c = jsonBody[i];
  if (c === "{") depth++;
  else if (c === "}") {
    depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}

if (end === -1) {
  console.error("Unclosed JSON");
  process.exit(1);
}

const obj = JSON.parse(jsonBody.slice(0, end));
const rest = jsonBody.slice(end).replace(/^\s*/, "");

const out =
  (before ? before + "\n" : "") + key + JSON.stringify(obj) + (rest ? "\n" + rest : "") + "\n";

fs.writeFileSync(envPath, out, "utf-8");
console.log("OK: GOOGLE_SERVICE_ACCOUNT_JSON tek satır yapıldı.");
