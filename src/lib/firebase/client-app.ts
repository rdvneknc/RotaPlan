import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";

function webConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!apiKey || !authDomain || !projectId) return null;
  return { apiKey, authDomain, projectId };
}

export function isFirebaseClientConfigured(): boolean {
  return webConfig() != null;
}

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  const cfg = webConfig();
  if (!cfg) {
    throw new Error("Firebase web yapılandırması eksik (NEXT_PUBLIC_FIREBASE_*).");
  }
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(cfg);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/** Şifre sıfırlama e-postası (Firebase Authentication şablonu). `continueUrl` yetkili alan adları listesinde olmalı. */
export async function sendFirebasePasswordResetEmail(email: string, continueUrl: string): Promise<void> {
  const auth = getFirebaseAuth();
  await sendPasswordResetEmail(auth, email.trim(), {
    url: continueUrl.replace(/\/$/, ""),
    handleCodeInApp: false,
  });
}

export async function firebaseVerifyPasswordResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(getFirebaseAuth(), oobCode.trim());
}

export async function firebaseConfirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(getFirebaseAuth(), oobCode.trim(), newPassword);
}

export function firebaseAuthErrorToTr(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
  switch (code) {
    case "auth/invalid-email":
      return "E-posta adresi geçersiz.";
    case "auth/missing-email":
      return "E-posta adresi gerekli.";
    case "auth/too-many-requests":
      return "Çok sık istek gönderildi. Bir süre sonra tekrar deneyin.";
    case "auth/expired-action-code":
      return "Bağlantının süresi dolmuş. Yeni bir şifre sıfırlama isteyin.";
    case "auth/invalid-action-code":
      return "Bağlantı geçersiz veya zaten kullanılmış. Yeni bir şifre sıfırlama isteyin.";
    case "auth/weak-password":
      return "Şifre çok zayıf. Daha uzun veya daha karmaşık bir şifre seçin.";
    default:
      return "İşlem başarısız. Bağlantınızı veya Firebase yapılandırmasını kontrol edin.";
  }
}
