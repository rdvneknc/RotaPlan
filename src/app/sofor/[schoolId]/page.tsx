import { getVehicles, getSchool, getSchoolById } from "@/lib/store";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Link from "next/link";
import { guardSoforSchoolList } from "@/lib/sofor-auth";

export const dynamic = "force-dynamic";

export default async function DriverIndexPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const schoolReg = getSchoolById(schoolId);
  if (!schoolReg) notFound();

  const session = await guardSoforSchoolList(schoolId);

  const vehicles = getVehicles(schoolId);
  const school = getSchool(schoolId);

  return (
    <div className="min-h-screen bg-dark-900">
      <Header
        schoolLabel={schoolReg.name || school.label}
        role="driver"
        userEmail={session.email}
        showPasswordLink={session.role !== "driver"}
      />
      <main className="max-w-2xl mx-auto px-4 py-6">
        {vehicles.length === 0 ? (
          <div className="bg-dark-800 rounded-2xl border border-dark-500 p-6 text-center">
            <svg className="mx-auto h-12 w-12 mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            <p className="text-base text-gray-400 mb-1">Henüz araç tanımlanmamış.</p>
            <p className="text-sm text-gray-600">Admin panelinden araç eklendiğinde burada görünecek.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white mb-2">Araç seçin (önizleme)</h2>
            <p className="text-xs text-gray-600 mb-2">Şoförler giriş yaptıktan sonra doğrudan kendi ekranına yönlendirilir.</p>
            {vehicles.map((v) => (
              <Link
                key={v.id}
                href={`/sofor/${schoolId}/${v.slug}`}
                className="flex items-center gap-4 bg-dark-800 border border-dark-500 rounded-2xl p-5 hover:border-accent/50 hover:bg-dark-700 transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{v.driverName}</p>
                  <p className="text-sm text-gray-500">{v.plate} • Kapasite: {v.capacity}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
