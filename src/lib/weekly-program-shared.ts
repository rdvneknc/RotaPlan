import type { Session, Student } from "./types";

export const DAY_LABELS: { [key: string]: string } = {
  "1": "Pazartesi",
  "2": "Salı",
  "3": "Çarşamba",
  "4": "Perşembe",
  "5": "Cuma",
  "6": "Cumartesi",
  "0": "Pazar",
};

export const DAYS = ["1", "2", "3", "4", "5", "6", "0"] as const;

export function normalizeText(t: string): string {
  return t
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTimeKey(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (typeof val === "number" && !Number.isNaN(val)) {
    const frac = val % 1;
    if (frac < 1e-10) return null;
    const totalMinutes = Math.round(frac * 24 * 60) % (24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`;
}

function findStudentByName(students: Student[], name: string): Student | undefined {
  const q = normalizeText(name);
  return students.find((s) => normalizeText(s.name) === q);
}

function findSessionByTimeKey(sessions: Session[], timeKey: string): Session | undefined {
  return sessions.find((s) => s.time === timeKey);
}

/** Google Sheets (Haftalık Program) ızgara satırlarını haftalık programa çevirir. */
export function parseGridSheetRows(
  rows: string[][],
  sessions: Session[],
  students: Student[],
): { parsed: { [day: string]: { [sessionId: string]: string[] } }; warnings: string[] } {
  const warnings: string[] = [];
  const out: { [day: string]: { [sessionId: string]: Set<string> } } = {};
  const dayNameToKey: { [name: string]: string } = {};
  for (const [key, label] of Object.entries(DAY_LABELS)) {
    dayNameToKey[normalizeText(label)] = key;
  }

  let currentDayKey: string | null = null;
  let colToSessionId = new Map<number, string>();

  const ensureSets = (day: string, sessionId: string) => {
    if (!out[day]) out[day] = {};
    if (!out[day][sessionId]) out[day][sessionId] = new Set();
    return out[day][sessionId];
  };

  for (const row of rows) {
    const a = String(row[0] ?? "").trim();
    const dayFromA = dayNameToKey[normalizeText(a)];
    let hasTimeInRow = false;
    for (let c = 1; c < Math.min(row.length, 24); c++) {
      if (normalizeTimeKey(row[c])) {
        hasTimeInRow = true;
        break;
      }
    }

    if (dayFromA && hasTimeInRow) {
      currentDayKey = dayFromA;
      colToSessionId = new Map();
      for (let colIdx = 1; colIdx < row.length; colIdx++) {
        const tk = normalizeTimeKey(row[colIdx]);
        if (!tk) continue;
        const sess = findSessionByTimeKey(sessions, tk);
        if (sess) colToSessionId.set(colIdx, sess.id);
      }
      // Gün başlığı geldi: veri satırı yoksa bile bu gün için boş setler oluştur (çekince sıfırlansın).
      if (!out[currentDayKey]) out[currentDayKey] = {};
      for (const sessionId of colToSessionId.values()) {
        if (!out[currentDayKey][sessionId]) out[currentDayKey][sessionId] = new Set();
      }
      continue;
    }

    if (!currentDayKey || colToSessionId.size === 0) continue;

    for (const [colIdx, sessionId] of colToSessionId) {
      const raw = row[colIdx];
      if (raw == null || raw === "") continue;
      const text = String(raw).trim();
      if (!text) continue;
      const parts = text
        .split(/[/|]/)
        .map((x) => x.trim())
        .filter(Boolean);
      const set = ensureSets(currentDayKey, sessionId);
      const sess = sessions.find((s) => s.id === sessionId);
      for (const part of parts) {
        const student = findStudentByName(students, part);
        if (student) set.add(student.id);
        else {
          warnings.push(`${DAY_LABELS[currentDayKey]} / ${sess?.time ?? "?"}: "${part}" eşleştirilmedi.`);
        }
      }
    }
  }

  const parsed: { [day: string]: { [sessionId: string]: string[] } } = {};
  for (const [d, sessMap] of Object.entries(out)) {
    parsed[d] = {};
    for (const [sid, idSet] of Object.entries(sessMap)) {
      parsed[d][sid] = [...idSet];
    }
  }
  return { parsed, warnings };
}
