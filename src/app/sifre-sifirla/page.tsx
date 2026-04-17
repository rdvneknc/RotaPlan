"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  checkAdminPasswordResetTokenAction,
  completeAdminPasswordResetAction,
} from "@/lib/actions";
import {
  isFirebaseClientConfigured,
  firebaseVerifyPasswordResetCode,
  firebaseConfirmPasswordReset,
  firebaseAuthErrorToTr,
} from "@/lib/firebase/client-app";
import PasswordInput from "@/components/PasswordInput";

function PasswordFormShared(props: {
  onSubmit: (newPassword: string, confirmPassword: string) => Promise<void>;
  minLength: number;
  loading: boolean;
  error: string;
}) {
  const { onSubmit, minLength, loading, error } = props;
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const a = ((fd.get("newPassword") as string) || "").trim();
    const b = ((fd.get("confirmPassword") as string) || "").trim();
    await onSubmit(a, b);
  }

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-4">
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-400 mb-1.5">
          Yeni şifre
        </label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          required
          minLength={minLength}
          disabled={loading}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400 mb-1.5">
          Yeni şifre (tekrar)
        </label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          minLength={minLength}
          disabled={loading}
          autoComplete="new-password"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-sm text-red-400 whitespace-pre-line">{error}</p>
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

function FirebaseOobResetInner({ oobCode }: { oobCode: string }) {
  const router = useRouter();
  const [valid, setValid] = useState<boolean | null>(null);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isFirebaseClientConfigured()) {
      setValid(false);
      return;
    }
    firebaseVerifyPasswordResetCode(oobCode)
      .then((email) => {
        setEmailHint(email);
        setValid(true);
      })
      .catch(() => setValid(false));
  }, [oobCode]);

  async function onSubmit(newPassword: string, confirmPassword: string) {
    setLoading(true);
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      setLoading(false);
      return;
    }
    if (newPassword.length < 6) {
      setError("Firebase şifresi en az 6 karakter olmalıdır.");
      setLoading(false);
      return;
    }
    try {
      await firebaseConfirmPasswordReset(oobCode, newPassword);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (e) {
      setError(firebaseAuthErrorToTr(e));
    } finally {
      setLoading(false);
    }
  }

  if (valid === null) {
    return <p className="text-center text-sm text-gray-500 py-8">Kontrol ediliyor…</p>;
  }

  if (!valid) {
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
    <div className="space-y-4">
      {emailHint && (
        <p className="text-xs text-gray-500 text-center">
          Hesap: <span className="text-gray-400">{emailHint}</span>
        </p>
      )}
      <PasswordFormShared onSubmit={onSubmit} minLength={6} loading={loading} error={error} />
    </div>
  );
}

function TokenResetInner() {
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

  async function onSubmit(newPassword: string, confirmPassword: string) {
    setLoading(true);
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      setLoading(false);
      return;
    }
    const formData = new FormData();
    formData.set("token", token);
    formData.set("newPassword", newPassword);
    formData.set("confirmPassword", confirmPassword);
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
    return <p className="text-center text-sm text-gray-500 py-8">Kontrol ediliyor…</p>;
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

  return <PasswordFormShared onSubmit={onSubmit} minLength={4} loading={loading} error={error} />;
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "";
  const oobCode = searchParams.get("oobCode") || "";

  if (mode === "resetPassword" && oobCode && isFirebaseClientConfigured()) {
    return <FirebaseOobResetInner oobCode={oobCode} />;
  }

  return <TokenResetInner />;
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-dvh bg-dark-900 flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Yeni şifre</h1>
          <p className="text-sm text-gray-500 mt-1">
            E-postadaki bağlantı ile yeni şifrenizi belirleyin (Firebase veya panel sıfırlama).
          </p>
        </div>

        <Suspense fallback={<p className="text-center text-sm text-gray-500 py-8">Yükleniyor…</p>}>
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
