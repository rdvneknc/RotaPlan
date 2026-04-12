"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  checkAdminPasswordResetTokenAction,
  completeAdminPasswordResetAction,
} from "@/lib/actions";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [valid, setValid] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setValid(false);
      return;
    }
    checkAdminPasswordResetTokenAction(token).then(setValid);
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("token", token);

    const result = await completeAdminPasswordResetAction(formData);
    setLoading(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (valid === null) {
    return (
      <p className="text-center text-sm text-gray-500 py-8">Kontrol ediliyor…</p>
    );
  }

  if (!token || !valid) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center space-y-3">
        <p className="text-sm text-amber-200">
          Bu bağlantı geçersiz veya süresi dolmuş. Yeni bir şifre sıfırlama isteği oluşturun.
        </p>
        <Link href="/sifremi-unuttum" className="inline-block text-sm font-medium text-accent hover:text-accent-hover">
          Şifremi unuttum
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center space-y-2">
        <p className="text-sm text-green-200">Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz…</p>
        <Link href="/login" className="inline-block text-sm text-accent hover:text-accent-hover">
          Hemen giriş yap
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-400 mb-1.5">
          Yeni şifre
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={4}
          autoComplete="new-password"
          className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400 mb-1.5">
          Yeni şifre (tekrar)
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={4}
          autoComplete="new-password"
          className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
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
        {loading ? "Kaydediliyor..." : "Şifreyi kaydet"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Yeni şifre</h1>
          <p className="text-sm text-gray-500 mt-1">Bağlantıdaki tek kullanımlık anahtar ile şifrenizi belirleyin.</p>
        </div>

        <Suspense
          fallback={<p className="text-center text-sm text-gray-500 py-8">Yükleniyor…</p>}
        >
          <ResetPasswordInner />
        </Suspense>

        <p className="text-center">
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-300">
            ← Giriş
          </Link>
        </p>
      </div>
    </div>
  );
}
