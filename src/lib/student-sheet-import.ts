/** Google Sheets “Öğrenci” şablonu: A–F, 1. satır başlık, veri 2. satırdan. */

export const STUDENT_IMPORT_DEFAULT_TAB = "Öğrenci Listesi";

export function normalizeSheetCell(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (lower === "yok" || lower === "-" || lower === "—") return "";
  return t;
}

export function addressLabelFromCoords(lat: number, lng: number): string {
  return `Konum (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
}

export type ParsedSheetStudentRow = {
  sheetRow: number;
  name: string;
  mapsUrl: string;
  contact1Name: string;
  contact1Phone: string;
  contact2Name: string;
  contact2Phone: string;
};

export type ParseStudentRowOutcome =
  | { kind: "skip" }
  | { kind: "ok"; data: ParsedSheetStudentRow }
  | { kind: "error"; sheetRow: number; name: string; reason: string };

/**
 * Tek veri satırı (0 tabanlı indeks, A2 = 0). sheetRow = dataIndex + 2 (başlık 1. satır).
 */
export function parseStudentSheetRow(row: string[], dataIndex: number): ParseStudentRowOutcome {
  const a = (row[0] ?? "").trim();
  const b = (row[1] ?? "").trim();
  const sheetRow = dataIndex + 2;

  if (!a && !b) return { kind: "skip" };

  if (!a || !b) {
    return {
      kind: "error",
      sheetRow,
      name: a || "?",
      reason: !a ? "Ad soyad boş." : "Konum (Maps linki) boş.",
    };
  }

  return {
    kind: "ok",
    data: {
      sheetRow,
      name: a,
      mapsUrl: b,
      contact1Name: normalizeSheetCell(row[2] ?? ""),
      contact1Phone: normalizeSheetCell(row[3] ?? ""),
      contact2Name: normalizeSheetCell(row[4] ?? ""),
      contact2Phone: normalizeSheetCell(row[5] ?? ""),
    },
  };
}

export type ImportStudentsFromSheetResult =
  | { error: string }
  | {
      success: true;
      imported: number;
      skipped: number;
      failed: { sheetRow: number; name: string; reason: string }[];
      sheetTab: string;
    };
