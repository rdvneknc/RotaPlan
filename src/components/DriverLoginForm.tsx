"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { driverLoginAction } from "@/lib/actions";

const STORAGE_KEY = "rp_sofor_username";

interface Props {
  className?: string;
}

export default function DriverLoginForm({ className = "" }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)?.trim();
      if (saved) setUsername(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData();
    formData.set("username", username.trim());
    const result = await driverLoginAction(formData);
    setLoading(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("redirectTo" in result && result.redirectTo) {
      try {
        localStorage.setItem(STORAGE_KEY, username.trim().toLowerCase());
      } catch {
        /* ignore */
      }
      router.push(result.redirectTo);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className={`space-y-4 ${className}`}>
      <div>
        <label htmlFor="sofor-username" className="block text-sm font-medium text-gray-400 mb-1.5">
          Kullanıcı adı
        </label>
        <input
          id="sofor-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          placeholder="örn. mehmet.sofor"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
        />
        <p className="text-xs text-gray-600 mt-1.5">Admin panelinde araca atanan ad; şifre yoktur.</p>
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
        {loading ? "Giriş yapılıyor..." : "Şoför paneline gir"}
      </button>
    </form>
  );
}
