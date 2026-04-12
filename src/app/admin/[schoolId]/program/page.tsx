import { getStudents, getSchool, getSessions, getSchoolById } from "@/lib/store";
import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import ProgramEditor from "@/components/ProgramEditor";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { isGoogleSheetsConfigured } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export default async function ProgramPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/sifre-degistir");
  if (session.role === "driver" && session.schoolId && session.vehicleSlug) {
    redirect(`/sofor/${session.schoolId}/${session.vehicleSlug}`);
  }

  const { schoolId } = await params;
  if (session.role !== "superadmin" && session.schoolId !== schoolId) redirect("/login");

  const schoolReg = getSchoolById(schoolId);
  if (!schoolReg) notFound();

  const students = getStudents(schoolId);
  const school = getSchool(schoolId);
  const sessions = getSessions(schoolId);

  return (
    <div className="min-h-screen bg-dark-900">
      <Header schoolLabel={schoolReg.name || school.label} role="admin" userEmail={session.email} />
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-4">
          <Link
            href={`/admin/${schoolId}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Admin Paneli
          </Link>
        </div>
        <ProgramEditor
          schoolId={schoolId}
          initialSessions={sessions}
          initialStudents={students}
          googleSheetId={schoolReg.googleSheetId ?? null}
          googleSheetsConfigured={isGoogleSheetsConfigured()}
        />
      </main>
      <footer className="max-w-7xl mx-auto px-6 py-6 text-center">
        <p className="text-xs text-gray-700">RotaPlan v0.2</p>
      </footer>
    </div>
  );
}
