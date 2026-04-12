"use client";

import { useState } from "react";
import Link from "next/link";
import { requestAdminPasswordResetAction } from "@/lib/actions";

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("publicOrigin", typeof window !== "undefined" ? window.location.origin : "");

    const result = await requestAdminPasswordResetAction(formData);
    setLoading(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Şifremi unuttum</h1>
          <p className="text-sm text-gray-500 mt-2">
            Kayıtlı admin e-postanıza sıfırlama bağlantısı gönderilir (e-posta altyapısı açıldığında).
          </p>
        </div>

        {done ? (
          <div className="rounded-xl border border-dark-500 bg-dark-800 p-4 text-center space-y-3">
            <p className="text-sm text-gray-300">
              İsteğiniz alındı. Bu e-posta sistemde kayıtlıysa, sıfırlama bağlantısı gönderilecektir.
            </p>
            <p className="text-xs text-gray-500">
              Geliştirme ortamında bağlantı sunucu konsoluna yazılır.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-accent hover:text-accent-hover"
            >
              Girişe dön
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1.5">
                E-posta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="admin@okul.com"
                className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-dark-900 font-semibold py-3 px-4 rounded-xl text-base transition"
            >
              {loading ? "Gönderiliyor..." : "Sıfırlama bağlantısı iste"}
            </button>
          </form>
        )}

        <p className="text-center">
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-300">
            ← Giriş
          </Link>
        </p>
      </div>
    </div>
  );
}
