import { getStudents, getSchool, getVehicles, getSessions, getSchoolById } from "@/lib/store";
import { notFound, redirect } from "next/navigation";
import { ADMIN_PAGE_CONTAINER } from "@/lib/admin-layout";
import Header from "@/components/Header";
import AdminDashboard from "@/components/AdminDashboard";
import { getSession } from "@/lib/session";
import { getServiceAccountEmailFromEnv, isGoogleSheetsConfigured } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/sifre-degistir");
  if (session.role === "driver" && session.schoolId && session.vehicleSlug) {
    redirect(`/sofor/${session.schoolId}/${session.vehicleSlug}`);
  }

  const { schoolId } = await params;
  if (session.role !== "superadmin" && session.schoolId !== schoolId) redirect("/login");

  const schoolReg = await getSchoolById(schoolId);
  if (!schoolReg) notFound();

  const students = await getStudents(schoolId);
  const school = await getSchool(schoolId);
  const vehicles = await getVehicles(schoolId);
  const sessions = await getSessions(schoolId);

  return (
    <div className="min-h-screen bg-dark-900">
      <Header schoolLabel={schoolReg.name || school.label} role="admin" userEmail={session.email} />
      <AdminDashboard
        schoolId={schoolId}
        initialStudents={students}
        initialSchool={school}
        initialVehicles={vehicles}
        initialSessions={sessions}
        initialGoogleSheetId={schoolReg.googleSheetId}
        googleSheetsShareEmail={getServiceAccountEmailFromEnv()}
        googleSheetsConfigured={isGoogleSheetsConfigured()}
      />
      <footer className={`${ADMIN_PAGE_CONTAINER} py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center`}>
        <p className="text-xs text-gray-700">RotaPlan v0.2</p>
      </footer>
    </div>
  );
}
