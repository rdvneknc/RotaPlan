import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

// v0.2
export default async function Home() {
  const session = await getSession();
  if (session) {
    if (session.mustChangePassword) redirect("/sifre-degistir");
    if (session.role === "superadmin") redirect("/super-admin");
    if (session.role === "driver" && session.schoolId && session.vehicleSlug) {
      redirect(`/sofor/${session.schoolId}/${session.vehicleSlug}`);
    }
    if (session.schoolId) redirect(`/admin/${session.schoolId}`);
  }
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-dark-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">RotaPlan</h1>
          <p className="text-base text-gray-500 mt-1">Okul Servis Planlayıcı</p>
        </div>

        <div className="space-y-3">
          <Link
            href="/login"
            className="flex items-center gap-4 bg-dark-800 border border-dark-500 rounded-2xl p-5 hover:border-accent/50 hover:bg-dark-700 transition group"
          >
            <div className="w-14 h-14 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-white">Admin</p>
              <p className="text-sm text-gray-500">E-posta ve şifre ile yönetim paneli</p>
            </div>
          </Link>
          <Link
            href="/login?tip=sofor"
            className="flex items-center gap-4 bg-dark-800 border border-dark-500 rounded-2xl p-5 hover:border-sky-500/40 hover:bg-dark-700 transition group"
          >
            <div className="w-14 h-14 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 group-hover:bg-sky-500/20 transition">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-white">Şoför</p>
              <p className="text-sm text-gray-500">Kullanıcı adı ile şoför ekranı (şifre yok)</p>
            </div>
          </Link>
        </div>

        <p className="text-center text-xs text-gray-600">RotaPlan v0.2</p>
      </div>
    </div>
  );
}
