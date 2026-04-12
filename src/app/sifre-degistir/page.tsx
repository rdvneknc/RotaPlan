"use client";

import { useState, useEffect } from "react";
import { changePasswordAction, fetchSession } from "@/lib/actions";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const [mustChange, setMustChange] = useState(false);
  const [role, setRole] = useState<string>("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchSession().then((s) => {
      if (!s) {
        router.push("/login");
        return;
      }
      if (s.role === "driver" && s.schoolId && s.vehicleSlug) {
        router.replace(`/sofor/${s.schoolId}/${s.vehicleSlug}`);
        return;
      }
      setMustChange(s.mustChangePassword);
      setRole(s.role);
      setSchoolId(s.schoolId);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const newPw = formData.get("newPassword") as string;
    const confirmPw = formData.get("confirmPassword") as string;

    if (newPw !== confirmPw) {
      setError("Şifreler eşleşmiyor.");
      setLoading(false);
      return;
    }

    const result = await changePasswordAction(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    setTimeout(async () => {
      const s = await fetchSession();
      if (s?.role === "driver" && s.schoolId && s.vehicleSlug) {
        router.push(`/sofor/${s.schoolId}/${s.vehicleSlug}`);
      } else if (s?.role === "superadmin") {
        router.push("/super-admin");
      } else if (s?.schoolId) {
        router.push(`/admin/${s.schoolId}`);
      } else {
        router.push("/");
      }
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Şifre Değiştir</h1>
          {mustChange && (
            <p className="text-sm text-amber-400 mt-2">İlk girişiniz — lütfen yeni şifrenizi belirleyin.</p>
          )}
        </div>

        {success ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
            <p className="text-sm text-green-400">Şifreniz başarıyla değiştirildi. Yönlendiriliyorsunuz...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!mustChange && (
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-400 mb-1.5">
                  Mevcut Şifre
                </label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  required
                  className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
                />
              </div>
            )}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-400 mb-1.5">
                Yeni Şifre
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={4}
                className="w-full rounded-xl border border-dark-400 bg-dark-700 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400 mb-1.5">
                Yeni Şifre (Tekrar)
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={4}
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
              {loading ? "Kaydediliyor..." : "Şifreyi Değiştir"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
