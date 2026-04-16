/**
 * Admin (e-posta) şifre sıfırlama — token saklama `AppStore` üzerinden (dosya veya Firestore).
 *
 * - Teslimat: `PASSWORD_RESET_DELIVERY=console` | `noop`
 * - E-posta: `deliverResetLink` içinde SMTP / Firebase Extension vb. bağlanır.
 */

import crypto from "crypto";
import {
  getUserByEmail,
  setUserPassword,
  readPasswordResetTokens,
  writePasswordResetTokens,
} from "./store";
import { updateFirebaseUserPasswordIfExists } from "./firebase/server-auth";

const TTL_MS = 60 * 60 * 1000; // 1 saat

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf-8").digest("hex");
}

/** E-posta / push bildirimi — Firestore geçişinde burayı değiştirin. */
export type PasswordResetDeliveryMode = "console" | "noop";

export function getPasswordResetDeliveryMode(): PasswordResetDeliveryMode {
  const v = (process.env.PASSWORD_RESET_DELIVERY || "console").toLowerCase();
  if (v === "noop") return "noop";
  return "console";
}

async function deliverResetLink(params: {
  email: string;
  resetUrl: string;
  userId: string;
}): Promise<void> {
  const mode = getPasswordResetDeliveryMode();
  if (mode === "noop") return;
  // eslint-disable-next-line no-console
  console.info(`[RotaPlan şifre sıfırlama] ${params.email} → ${params.resetUrl}`);
}

/**
 * Kayıtlı admin/süper admin kullanıcı için sıfırlama başlatır.
 * E-posta yoksa sessizce çıkar (enumeration önlemi — UI her zaman aynı mesajı gösterir).
 */
export async function initiatePasswordResetForEmail(email: string, publicBaseUrl: string): Promise<void> {
  const user = await getUserByEmail(email);
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const now = Date.now();
  const expiresAt = now + TTL_MS;
  const userId = user.id;

  const tokens = (await readPasswordResetTokens()).filter((t) => t.expiresAt > now && t.userId !== userId);
  tokens.push({ tokenHash, userId, email: user.email, expiresAt });
  await writePasswordResetTokens(tokens);

  const base = publicBaseUrl.replace(/\/$/, "");
  const resetUrl = `${base}/sifre-sifirla?token=${encodeURIComponent(rawToken)}`;
  await deliverResetLink({ email: user.email, resetUrl, userId });
}

async function findValidUserIdByRawToken(rawToken: string): Promise<string | null> {
  const h = hashToken(rawToken.trim());
  const now = Date.now();
  const tokens = await readPasswordResetTokens();
  const idx = tokens.findIndex((t) => t.tokenHash === h && t.expiresAt > now);
  if (idx === -1) return null;
  return tokens[idx].userId;
}

export async function consumePasswordResetToken(rawToken: string): Promise<{ userId: string } | null> {
  const h = hashToken(rawToken.trim());
  const now = Date.now();
  const tokens = await readPasswordResetTokens();
  const idx = tokens.findIndex((t) => t.tokenHash === h && t.expiresAt > now);
  if (idx === -1) return null;
  const userId = tokens[idx].userId;
  tokens.splice(idx, 1);
  await writePasswordResetTokens(tokens);
  return { userId };
}

export async function validatePasswordResetToken(rawToken: string): Promise<boolean> {
  return (await findValidUserIdByRawToken(rawToken.trim())) !== null;
}

export async function completePasswordResetWithToken(
  rawToken: string,
  newPassword: string,
): Promise<{ ok: true } | { error: string }> {
  if (!newPassword || newPassword.length < 4) {
    return { error: "Yeni şifre en az 4 karakter olmalıdır." };
  }
  const consumed = await consumePasswordResetToken(rawToken);
  if (!consumed) {
    return { error: "Bağlantı geçersiz veya süresi dolmuş. Yeni bir şifre sıfırlama isteyin." };
  }
  const ok = await setUserPassword(consumed.userId, newPassword, false);
  if (!ok) return { error: "Şifre güncellenemedi." };
  await updateFirebaseUserPasswordIfExists(consumed.userId, newPassword);
  return { ok: true };
}
