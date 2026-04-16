/** Şifre sıfırlama token kaydı — dosya veya Firestore’da saklanır. */
export interface PasswordResetTokenRecord {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: number;
}
