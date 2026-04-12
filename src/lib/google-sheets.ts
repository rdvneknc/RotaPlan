import { google } from "googleapis";
import type { WeeklyProgramRowKind } from "./weekly-program-grid";

/** Program sekmesi adı (Excel’deki sayfa adı ile aynı). */
export const GOOGLE_SHEET_TAB = "Haftalık Program";

// Excel export (ProgramEditor) ile aynı palet
const SESSION_BG = "D97706";
const TABLE_HEADER_BG = "1E293B";
const ROW_DATA_BG = "F8FAFC";
const BORDER_GRAY = "D1D5DB";
const TEXT_WHITE = "FFFFFF";
const TEXT_HEADER_TIME = "E2E8F0";
const TEXT_DATA = "1E293B";
const TEXT_COL_A = "64748B";
const TAB_HEX = "D97706";

export function parseSpreadsheetIdFromInput(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return null;
}

function getCredentials(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!j.client_email || !j.private_key) return null;
    return { client_email: j.client_email, private_key: j.private_key };
  } catch {
    return null;
  }
}

export function isGoogleSheetsConfigured(): boolean {
  return getCredentials() !== null;
}

/** Paylaşım talimatında göstermek için (gizli anahtar dışında). */
export function getServiceAccountEmailFromEnv(): string | null {
  return getCredentials()?.client_email ?? null;
}

async function getSheetsClient() {
  const creds = getCredentials();
  if (!creds) {
    throw new Error("Google Sheets yapılandırılmadı. Sunucuda GOOGLE_SERVICE_ACCOUNT_JSON ortam değişkenini ayarlayın.");
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

function hexToColor(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace(/^#/, "");
  return {
    red: parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function thinGrayBorders() {
  const c = hexToColor(BORDER_GRAY);
  const side = { style: "SOLID" as const, color: c, width: 1 };
  return { top: side, bottom: side, left: side, right: side };
}

/** Excel export ile aynı yazı tipi (ProgramEditor: Calibri). */
const FONT_FAMILY = "Calibri";

/** Sheets arayüzünde hedeflenen sütun genişliği (piksel). */
const COL_A_PIXELS = 209;
const COL_OTHER_PIXELS = 199;

/** Gün + saat başlık satırı; diğer satırlar (veri, ayırıcı) aşağıdaki değerde. */
const ROW_HEADER_PIXELS = 34;
const ROW_DEFAULT_PIXELS = 29;

function headerDayFormat() {
  return {
    backgroundColor: hexToColor(SESSION_BG),
    horizontalAlignment: "CENTER" as const,
    verticalAlignment: "MIDDLE" as const,
    wrapStrategy: "CLIP" as const,
    textFormat: {
      foregroundColor: hexToColor(TEXT_WHITE),
      bold: true,
      fontSize: 11,
      fontFamily: FONT_FAMILY,
    },
    borders: thinGrayBorders(),
  };
}

function headerTimeFormat() {
  return {
    backgroundColor: hexToColor(TABLE_HEADER_BG),
    horizontalAlignment: "CENTER" as const,
    verticalAlignment: "MIDDLE" as const,
    wrapStrategy: "CLIP" as const,
    textFormat: {
      foregroundColor: hexToColor(TEXT_HEADER_TIME),
      bold: true,
      fontSize: 10,
      fontFamily: FONT_FAMILY,
    },
    borders: thinGrayBorders(),
  };
}

function dataColAFormat() {
  return {
    backgroundColor: hexToColor(ROW_DATA_BG),
    horizontalAlignment: "CENTER" as const,
    verticalAlignment: "MIDDLE" as const,
    wrapStrategy: "WRAP" as const,
    textFormat: {
      foregroundColor: hexToColor(TEXT_COL_A),
      bold: false,
      fontSize: 10,
      fontFamily: FONT_FAMILY,
    },
    borders: thinGrayBorders(),
  };
}

function dataRestFormat() {
  return {
    backgroundColor: hexToColor(ROW_DATA_BG),
    horizontalAlignment: "CENTER" as const,
    verticalAlignment: "MIDDLE" as const,
    wrapStrategy: "WRAP" as const,
    textFormat: {
      foregroundColor: hexToColor(TEXT_DATA),
      bold: false,
      fontSize: 10,
      fontFamily: FONT_FAMILY,
    },
    borders: thinGrayBorders(),
  };
}

function separatorFormat() {
  return {
    backgroundColor: hexToColor("FFFFFF"),
    horizontalAlignment: "CENTER" as const,
    verticalAlignment: "MIDDLE" as const,
    textFormat: {
      fontSize: 10,
      fontFamily: FONT_FAMILY,
    },
    borders: thinGrayBorders(),
  };
}

function gridRange(
  sheetId: number,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
) {
  return {
    sheetId,
    startRowIndex: startRow,
    endRowIndex: endRow,
    startColumnIndex: startCol,
    endColumnIndex: endCol,
  };
}

function buildStyleRequests(
  sheetId: number,
  rowKinds: WeeklyProgramRowKind[],
  colCount: number,
  totalRows: number,
): object[] {
  const requests: object[] = [];

  for (let c = 0; c < colCount; c++) {
    const wide = c === 0 ? COL_A_PIXELS : COL_OTHER_PIXELS;
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: c,
          endIndex: c + 1,
        },
        properties: { pixelSize: wide },
        fields: "pixelSize",
      },
    });
  }

  let ri = 0;
  while (ri < rowKinds.length) {
    const rk = rowKinds[ri];
    if (rk === "header") {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: "ROWS", startIndex: ri, endIndex: ri + 1 },
          properties: { pixelSize: ROW_HEADER_PIXELS },
          fields: "pixelSize",
        },
      });
      ri++;
    } else if (rk === "data") {
      const rs = ri;
      while (ri < rowKinds.length && rowKinds[ri] === "data") ri++;
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: "ROWS", startIndex: rs, endIndex: ri },
          properties: { pixelSize: ROW_DEFAULT_PIXELS },
          fields: "pixelSize",
        },
      });
    } else {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: "ROWS", startIndex: ri, endIndex: ri + 1 },
          properties: { pixelSize: ROW_DEFAULT_PIXELS },
          fields: "pixelSize",
        },
      });
      ri++;
    }
  }

  let i = 0;
  while (i < rowKinds.length) {
    const kind = rowKinds[i];
    if (kind === "header") {
      requests.push({
        repeatCell: {
          range: gridRange(sheetId, i, i + 1, 0, 1),
          cell: { userEnteredFormat: headerDayFormat() },
          fields: "userEnteredFormat",
        },
      });
      requests.push({
        repeatCell: {
          range: gridRange(sheetId, i, i + 1, 1, colCount),
          cell: { userEnteredFormat: headerTimeFormat() },
          fields: "userEnteredFormat",
        },
      });
      i++;
    } else if (kind === "data") {
      const start = i;
      while (i < rowKinds.length && rowKinds[i] === "data") i++;
      const end = i;
      requests.push({
        repeatCell: {
          range: gridRange(sheetId, start, end, 0, 1),
          cell: { userEnteredFormat: dataColAFormat() },
          fields: "userEnteredFormat",
        },
      });
      requests.push({
        repeatCell: {
          range: gridRange(sheetId, start, end, 1, colCount),
          cell: { userEnteredFormat: dataRestFormat() },
          fields: "userEnteredFormat",
        },
      });
    } else {
      requests.push({
        repeatCell: {
          range: gridRange(sheetId, i, i + 1, 0, colCount),
          cell: { userEnteredFormat: separatorFormat() },
          fields: "userEnteredFormat",
        },
      });
      i++;
    }
  }

  const black = hexToColor("000000");
  const outer = { style: "SOLID" as const, color: black, width: 1 };
  requests.push({
    updateBorders: {
      range: gridRange(sheetId, 0, totalRows, 0, colCount),
      top: outer,
      bottom: outer,
      left: outer,
      right: outer,
    },
  });

  return requests;
}

async function runBatchUpdates(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  requests: object[],
) {
  const chunk = 75;
  for (let j = 0; j < requests.length; j += chunk) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: requests.slice(j, j + chunk) as never[] },
    });
  }
}

export interface WeeklyProgramSheetLayout {
  rowKinds: WeeklyProgramRowKind[];
  colCount: number;
}

/** Sekme yoksa oluşturur; değerleri yazar; Excel’e yakın renk/çerçeve uygular. */
export async function writeWeeklyProgramGrid(
  spreadsheetId: string,
  grid: string[][],
  layout: WeeklyProgramSheetLayout,
): Promise<void> {
  const sheets = await getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  let sheetId = meta.data.sheets?.find((s) => s.properties?.title === GOOGLE_SHEET_TAB)?.properties?.sheetId;

  if (sheetId === undefined || sheetId === null) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: GOOGLE_SHEET_TAB,
                tabColor: hexToColor(TAB_HEX),
              },
            },
          },
        ],
      },
    });
    const newId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (newId === undefined || newId === null) {
      throw new Error("Haftalık Program sekmesi oluşturulamadı.");
    }
    sheetId = newId;
  }

  const lastRow = Math.max(grid.length, 1);
  const lastCol = Math.max(layout.colCount, 1, ...grid.map((r) => r.length));
  const colLetter = columnIndexToA1Letter(lastCol - 1);
  const safeTitle = GOOGLE_SHEET_TAB.replace(/'/g, "''");
  const range = `'${safeTitle}'!A1:${colLetter}${lastRow}`;

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${safeTitle}'!A:ZZ`,
  });

  const padded = grid.map((row) => {
    const copy = [...row];
    while (copy.length < lastCol) copy.push("");
    return copy;
  });

  // RAW: "09:00" metin kalır; USER_ENTERED saati sayıya çevirip ondalık gösteriyordu.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: padded },
  });

  const styleRequests = buildStyleRequests(sheetId, layout.rowKinds, layout.colCount, grid.length);
  await runBatchUpdates(sheets, spreadsheetId, styleRequests);
}

/** 0 = A, 25 = Z, 26 = AA */
function columnIndexToA1Letter(zeroBasedIndex: number): string {
  let n = zeroBasedIndex + 1;
  let s = "";
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s || "A";
}

export async function readWeeklyProgramGrid(spreadsheetId: string): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${GOOGLE_SHEET_TAB.replace(/'/g, "''")}'!A1:ZZ2000`,
  });
  const values = res.data.values;
  if (!values || values.length === 0) return [];
  return values.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}
