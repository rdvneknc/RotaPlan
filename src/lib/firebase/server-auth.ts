import { getAdminAuth } from "./admin-app";

/** Kayıtlı kullanıcı şifresini Firebase Authentication ile eşitler (varsa). */
export async function updateFirebaseUserPasswordIfExists(uid: string, newPassword: string): Promise<void> {
  try {
    await getAdminAuth().updateUser(uid, { password: newPassword });
  } catch {
    /* kullanıcı yalnızca dosya/legacy modunda olabilir */
  }
}
