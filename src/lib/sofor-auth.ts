import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import type { SessionData } from "@/lib/session";

/** Okul şoför listesi: yalnızca admin/süper admin; şoför doğrudan kendi rotasına yönlendirilir. */
export async function guardSoforSchoolList(schoolId: string): Promise<SessionData> {
  const session = await getSession();
  if (!session) redirect("/login?tip=sofor");
  if (session.role === "driver") {
    if (!session.schoolId || !session.vehicleSlug) redirect("/login?tip=sofor");
    if (session.schoolId !== schoolId) {
      redirect(`/sofor/${session.schoolId}/${session.vehicleSlug}`);
    }
    redirect(`/sofor/${session.schoolId}/${session.vehicleSlug}`);
  }
  if (session.role === "superadmin") return session;
  if (session.role === "admin" && session.schoolId === schoolId) return session;
  redirect("/login");
}

/** Tek araç şoför ekranı: şoför yalnızca kendi slug’ı; admin aynı okuldan önizleyebilir. */
export async function guardSoforVehiclePage(schoolId: string, slug: string): Promise<SessionData> {
  const session = await getSession();
  if (!session) redirect("/login?tip=sofor");
  if (session.role === "driver") {
    if (!session.schoolId || !session.vehicleSlug) redirect("/login?tip=sofor");
    if (session.schoolId !== schoolId || session.vehicleSlug !== slug) {
      redirect(`/sofor/${session.schoolId}/${session.vehicleSlug}`);
    }
    return session;
  }
  if (session.role === "superadmin") return session;
  if (session.role === "admin" && session.schoolId === schoolId) return session;
  redirect("/login");
}
