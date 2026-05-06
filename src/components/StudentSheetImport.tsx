"use client";

import { useState } from "react";
import { importStudentsFromGoogleSheet } from "@/lib/actions";
import { STUDENT_IMPORT_DEFAULT_TAB, type ImportStudentsFromSheetResult } from "@/lib/student-sheet-import";

interface Props {
  schoolId: string;
  googleSheetsConfigured: boolean;
  hasGoogleSheetId: boolean;
  onImportDone: () => void;
}

export default function StudentSheetImport({
  schoolId,
  googleSheetsConfigured,
  hasGoogleSheetId,
  onImportDone,
}: Props) {
  const [sheetTab, setSheetTab] = useState(STUDENT_IMPORT_DEFAULT_TAB);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportStudentsFromSheetResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    const r = await importStudentsFromGoogleSheet(schoolId, fd);
    setResult(r);
    setLoading(false);
    if ("success" in r && r.success) {
      onImportDone();
    }
  }

  const disabled = !googleSheetsConfigured || !hasGoogleSheetId || loading;

  return (
    <div className="rounded-xl border border-dark-500 bg-dark-700/40 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white">Google Sheets’ten toplu içe aktar</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Okula bağlı dosyada ayrı bir sekmede tablo kullanın:{" "}
          <span className="text-gray-400">A</span> ad soyad,{" "}
          <span className="text-gray-400">B</span> Maps linki,{" "}
          <span className="text-gray-400">C–D</span> irtibat 1,{" "}
          <span className="text-gray-400">E–F</span> irtibat 2. İlk satır başlık; veri 2. satırdan. Enlem/boylam
          sütunları okunmaz.
        </p>
      </div>

      {!googleSheetsConfigured && (
        <p className="text-xs text-amber-400/90">Sunucuda Google servis hesabı tanımlı değil; içe aktarma kullanılamaz.</p>
      )}
      {googleSheetsConfigured && !hasGoogleSheetId && (
        <p className="text-xs text-amber-400/90">
          Bu okula henüz Google Sheets dosyası bağlanmadı. Önce <strong>Okul</strong> sekmesinde dosyayı kaydedin.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="sheetTab" className="block text-xs font-medium text-gray-400 mb-1">
            Sekme adı
          </label>
          <input
            id="sheetTab"
            name="sheetTab"
            type="text"
            value={sheetTab}
            onChange={(e) => setSheetTab(e.target.value)}
            placeholder={STUDENT_IMPORT_DEFAULT_TAB}
            disabled={disabled}
            className="w-full rounded-lg border border-dark-400 bg-dark-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-accent outline-none disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={disabled}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-dark-900 transition"
        >
          {loading ? "Okunuyor…" : "Sheet’ten içe aktar"}
        </button>
      </form>

      {result && "error" in result && (
        <p className="text-sm text-red-400 whitespace-pre-wrap">{result.error}</p>
      )}

      {result && "success" in result && result.success && (
        <div className="rounded-lg border border-dark-500 bg-dark-800/80 p-3 text-xs space-y-2">
          <p className="text-gray-300">
            Sekme: <span className="text-white font-medium">{result.sheetTab}</span>
          </p>
          <p className="text-green-400 font-medium">
            Eklenen: {result.imported} · Boş atlanan satır: {result.skipped}
            {result.failed.length > 0 ? ` · Hata: ${result.failed.length}` : ""}
          </p>
          {result.failed.length > 0 && (
            <ul className="max-h-40 overflow-y-auto space-y-1 text-amber-200/90 list-disc pl-4">
              {result.failed.map((f) => (
                <li key={`${f.sheetRow}-${f.name}`}>
                  Satır {f.sheetRow} ({f.name}): {f.reason}
                </li>
              ))}
            </ul>
          )}
          <p className="text-gray-600">
            Aynı sheet’i tekrar çalıştırmak çift kayıt oluşturur; gerekirse önce listeden silin.
          </p>
        </div>
      )}
    </div>
  );
}
