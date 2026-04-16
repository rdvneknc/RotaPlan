import admin from "firebase-admin";
import type { ServiceAccount } from "firebase-admin/app";

let app: admin.app.App | null = null;

function parseServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON tanımlı değil (Firestore / Admin SDK).");
  }
  const parsed = JSON.parse(raw) as ServiceAccount & { private_key?: string };
  if (typeof parsed.private_key === "string" && parsed.private_key.includes("\\n")) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed as ServiceAccount;
}

export function getFirebaseAdminApp(): admin.app.App {
  if (!app) {
    if (admin.apps.length > 0) {
      app = admin.app();
    } else {
      app = admin.initializeApp({
        credential: admin.credential.cert(parseServiceAccount()),
      });
    }
  }
  return app;
}

export function getAdminAuth(): admin.auth.Auth {
  return getFirebaseAdminApp().auth();
}

export function getAdminFirestore(): admin.firestore.Firestore {
  return getFirebaseAdminApp().firestore();
}
