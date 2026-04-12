import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "rp_session";
const SECRET = process.env.SESSION_SECRET || "rotaplan-dev-secret-change-in-production";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionData {
  userId: string;
  email: string;
  role: "superadmin" | "admin" | "driver";
  schoolId: string | null;
  mustChangePassword: boolean;
  /** Şoför oturumu */
  vehicleId?: string | null;
  vehicleSlug?: string | null;
}

function sign(payload: string): string {
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(payload);
  return hmac.digest("hex");
}

function encode(data: SessionData): string {
  const json = JSON.stringify(data);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

function decode(token: string): SessionData | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  if (sign(b64) !== sig) return null;
  try {
    const json = Buffer.from(b64, "base64url").toString("utf-8");
    return JSON.parse(json) as SessionData;
  } catch {
    return null;
  }
}

export async function createSession(data: SessionData): Promise<void> {
  const token = encode(data);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return decode(cookie.value);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function updateSession(updates: Partial<SessionData>): Promise<void> {
  const current = await getSession();
  if (!current) return;
  await createSession({ ...current, ...updates });
}
