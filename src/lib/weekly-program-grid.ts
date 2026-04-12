import { getWeeklySchedule, getSessions, getStudents } from "./store";
import { DAY_LABELS, DAYS } from "./weekly-program-shared";

export type WeeklyProgramRowKind = "header" | "data" | "separator";

/** Haftalık program ızgarası + satır türleri (Sheets biçimlendirme için). */
export function buildWeeklyProgramGridWithMeta(schoolId: string): {
  rows: string[][];
  rowKinds: WeeklyProgramRowKind[];
  colCount: number;
} {
  const sessions = [...getSessions(schoolId)].sort((a, b) => a.time.localeCompare(b.time));
  const students = getStudents(schoolId);
  const schedule = getWeeklySchedule(schoolId);
  const getStudentName = (id: string) => students.find((s) => s.id === id)?.name ?? "";

  const rows: string[][] = [];
  const rowKinds: WeeklyProgramRowKind[] = [];
  const colCount = 1 + sessions.length;

  for (const day of DAYS) {
    const headerRow = [DAY_LABELS[day].toLocaleUpperCase("tr-TR"), ...sessions.map((s) => s.time)];
    rows.push(headerRow);
    rowKinds.push("header");

    const namesPerCol = sessions.map((sess) => {
      const ids = schedule[day]?.[sess.id] ?? [];
      return ids.map((id) => getStudentName(id)).filter((n) => !!n);
    });
    const maxDataRows = Math.max(4, ...namesPerCol.map((arr) => arr.length));

    for (let r = 0; r < maxDataRows; r++) {
      const dataRow = ["", ...sessions.map((_, i) => namesPerCol[i][r] ?? "")];
      rows.push(dataRow);
      rowKinds.push("data");
    }

    rows.push([""]);
    rowKinds.push("separator");
  }

  return { rows, rowKinds, colCount };
}

/** Sadece hücre değerleri. */
export function buildWeeklyProgramGrid(schoolId: string): string[][] {
  return buildWeeklyProgramGridWithMeta(schoolId).rows;
}
