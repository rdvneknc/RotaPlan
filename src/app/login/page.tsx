"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { loginAction, finalizeFirebaseAdminLoginAction } from "@/lib/actions";
import DriverLoginForm from "@/components/DriverLoginForm";
import { isFirebaseClientConfigured, getFirebaseAuth } from "@/lib/firebase/client-app";
import { signInWithEmailAndPassword } from "firebase/auth";

type LoginMode = "admin" | "driver";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("tip") === "sofor") setMode("driver");
    } catch {
      /* ignore */
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    try {
      if (isFirebaseClientConfigured()) {
        const email = (formData.get("email") as string)?.trim() || "";
        const password = (formData.get("password") as string) || "";
        if (!email || !password) {
          setError("E-posta ve şifre zorunludur.");
          return;
        }
        try {
          const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
          const idToken = await cred.user.getIdToken();
          const fin = await finalizeFirebaseAdminLoginAction(idToken);
          if (fin && "error" in fin && fin.error) setError(fin.error);
        } catch (err: unknown) {
          const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
          if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
            setError("E-posta veya şifre hatalı.");
          } else {
            setError("Giriş başarısız. Bağlantınızı ve Firebase yapılandırmasını kontrol edin.");
          }
        }
      } else {
        const result = await loginAction(formData);
        if (result?.error) setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-dark-900 flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-dark-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">RotaPlan</h1>
          <p className="text-sm text-gray-500 mt-1">Giriş</p>
        </div>

        <div
          className="flex rounded-xl border border-dark-500 bg-dark-800 p-1 gap-1"
          role="tablist"
          aria-label="Giriş türü"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "admin"}
            onClick={() => { setMode("admin"); setError(""); }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
              mode === "admin"
                ? "bg-dark-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Admin
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "driver"}
            onClick={() => { setMode("driver"); setError(""); }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
              mode === "driver"
                ? "bg-dark-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Şoför
          </button>
        </div>

        {mode === "admin" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-gray-600 text-center -mt-1">
              E-posta ve şifre ile admin paneline giriş
            </p>
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
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1.5">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••"
                className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>

            <p className="text-right -mt-1">
              <Link
                href="/sifremi-unuttum"
                className="text-xs font-medium text-accent hover:text-accent-hover"
              >
                Şifremi unuttum
              </Link>
            </p>

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
              {loading ? "Giriş yapılıyor..." : "Panele giriş yap"}
            </button>
          </form>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 text-center">
              Adminin araca atadığı kullanıcı adı yeterlidir (şifre yok).
            </p>
            <DriverLoginForm />
          </div>
        )}

        <p className="text-center text-xs text-gray-600">RotaPlan v0.2</p>
      </div>
    </div>
  );
}
