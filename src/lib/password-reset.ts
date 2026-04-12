/**
 * Admin (e-posta) şifre sıfırlama — altyapı Firestore + e-posta için hazır.
 *
 * Davranış:
 * - Token'lar dosyada saklanır (`data/password-resets.json`, VERCEL'de /tmp — üretimde Firestore'a taşıyın).
 * - Teslimat: `PASSWORD_RESET_DELIVERY=console` (geliştirme: URL konsola) | `noop` (sessiz).
 * - İleride: aynı public API ile `FirestorePasswordResetStore` + `SmtpPasswordResetDelivery` eklenebilir.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getUserByEmail, setUserPassword } from "./store";

const BASE_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const TTL_MS = 60 * 60 * 1000; // 1 saat

function resetsFile(): string {
  return path.join(BASE_DIR, "password-resets.json");
}

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

interface TokenRecord {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: number;
}

interface ResetFileShape {
  tokens: TokenRecord[];
}

function readTokens(): TokenRecord[] {
  try {
    const f = resetsFile();
    if (!fs.existsSync(f)) return [];
    const raw = JSON.parse(fs.readFileSync(f, "utf-8")) as ResetFileShape;
    return Array.isArray(raw.tokens) ? raw.tokens : [];
  } catch {
    return [];
  }
}

function writeTokens(tokens: TokenRecord[]) {
  const f = resetsFile();
  ensureDirForFile(f);
  fs.writeFileSync(f, JSON.stringify({ tokens }, null, 2), "utf-8");
}

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
  // E-posta entegrasyonu öncesi: bağlantıyı logla. Firestore/SMTP eklenince bu fonksiyon mail gönderecek.
  // eslint-disable-next-line no-console
  console.info(`[RotaPlan şifre sıfırlama] ${params.email} → ${params.resetUrl}`);
}

/**
 * Kayıtlı admin/süper admin kullanıcı için sıfırlama başlatır.
 * E-posta yoksa sessizce çıkar (enumeration önlemi — UI her zaman aynı mesajı gösterir).
 */
export async function initiatePasswordResetForEmail(email: string, publicBaseUrl: string): Promise<void> {
  const user = getUserByEmail(email);
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const now = Date.now();
  const expiresAt = now + TTL_MS;
  const userId = user.id;

  const tokens = readTokens().filter((t) => t.expiresAt > now && t.userId !== userId);
  tokens.push({ tokenHash, userId, email: user.email, expiresAt });
  writeTokens(tokens);

  const base = publicBaseUrl.replace(/\/$/, "");
  const resetUrl = `${base}/sifre-sifirla?token=${encodeURIComponent(rawToken)}`;
  await deliverResetLink({ email: user.email, resetUrl, userId });
}

function findValidUserIdByRawToken(rawToken: string): string | null {
  const h = hashToken(rawToken.trim());
  const now = Date.now();
  const tokens = readTokens();
  const idx = tokens.findIndex((t) => t.tokenHash === h && t.expiresAt > now);
  if (idx === -1) return null;
  return tokens[idx].userId;
}

export function consumePasswordResetToken(rawToken: string): { userId: string } | null {
  const h = hashToken(rawToken.trim());
  const now = Date.now();
  const tokens = readTokens();
  const idx = tokens.findIndex((t) => t.tokenHash === h && t.expiresAt > now);
  if (idx === -1) return null;
  const userId = tokens[idx].userId;
  tokens.splice(idx, 1);
  writeTokens(tokens);
  return { userId };
}

export function validatePasswordResetToken(rawToken: string): boolean {
  return findValidUserIdByRawToken(rawToken.trim()) !== null;
}

export function completePasswordResetWithToken(
  rawToken: string,
  newPassword: string,
): { ok: true } | { error: string } {
  if (!newPassword || newPassword.length < 4) {
    return { error: "Yeni şifre en az 4 karakter olmalıdır." };
  }
  const consumed = consumePasswordResetToken(rawToken);
  if (!consumed) {
    return { error: "Bağlantı geçersiz veya süresi dolmuş. Yeni bir şifre sıfırlama isteyin." };
  }
  const ok = setUserPassword(consumed.userId, newPassword, false);
  if (!ok) return { error: "Şifre güncellenemedi." };
  return { ok: true };
}
