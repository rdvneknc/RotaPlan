/** Sunucu ve istemci aynı NEXT_PUBLIC_* değişkenlerini kullanır (Next.js bunları build/runtime’da enjekte eder). */
export function isFirebaseEmailAuthEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  );
}
