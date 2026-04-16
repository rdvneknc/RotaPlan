"use client";

import { useState, useEffect } from "react";
import { saveSchoolGoogleSheetLink } from "@/lib/actions";

interface Props {
  schoolId: string;
  initialSheetId?: string;
  shareEmail: string | null;
  sheetsConfigured: boolean;
}

export default function GoogleSheetSettings({ schoolId, initialSheetId, shareEmail, sheetsConfigured }: Props) {
  const [url, setUrl] = useState(
    initialSheetId ? `https://docs.google.com/spreadsheets/d/${initialSheetId}/edit` : "",
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUrl(initialSheetId ? `https://docs.google.com/spreadsheets/d/${initialSheetId}/edit` : "");
  }, [initialSheetId]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("googleSheetUrl", url.trim());
    const res = await saveSchoolGoogleSheetLink(schoolId, fd);
    if (res.error) setMsg({ type: "err", text: res.error });
    else setMsg({ type: "ok", text: "Kaydedildi." });
    setLoading(false);
  }

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-500 p-4 sm:p-6 space-y-4">
      <h2 className="text-base font-semibold text-white">Google Sheets</h2>
      <p className="text-sm text-gray-500">
        Bu okulun haftalık programı tek bir Google Sheets dosyasıyla eşlenir. Linki kaydettikten sonra Program sayfasından &quot;Sheets&apos;e gönder&quot; / &quot;Sheets&apos;ten al&quot; kullanın.
      </p>

      {!sheetsConfigured && (
        <p className="text-sm text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          Sunucuda Google servis hesabı yok (GOOGLE_SERVICE_ACCOUNT_JSON). Sheets senkronu çalışmaz; yine de linki kaydedebilirsiniz.
        </p>
      )}

      {shareEmail && (
        <p className="text-xs text-gray-400 leading-relaxed">
          <span className="text-gray-500">Dosyayı bu e-postayla paylaşın (Düzenleyici):</span>{" "}
          <span className="font-mono text-accent break-all">{shareEmail}</span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="gs-url" className="block text-sm font-medium text-gray-400 mb-1.5">
            Sheets linki veya dosya ID
          </label>
          <input
            id="gs-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
          />
        </div>
        {msg && (
          <p className={`text-sm ${msg.type === "ok" ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover rounded-xl transition disabled:opacity-50"
        >
          {loading ? "Kaydediliyor..." : "Bağlantıyı kaydet"}
        </button>
      </form>
    </div>
  );
}
