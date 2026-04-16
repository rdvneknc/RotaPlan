import { getSchools, getSchoolStats, getUsers } from "@/lib/store";
import SuperAdminDashboard from "@/components/SuperAdminDashboard";
import SuperAdminHeader from "@/components/SuperAdminHeader";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "superadmin") redirect("/login");

  const schools = await getSchools();
  const schoolsWithStats = await Promise.all(
    schools.map(async (s) => ({
      school: s,
      stats: await getSchoolStats(s.id),
    })),
  );

  const allUsers = (await getUsers()).map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    schoolId: u.schoolId,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt,
  }));

  return (
    <div className="min-h-screen bg-dark-900">
      <SuperAdminHeader email={session.email} />
      <SuperAdminDashboard initialSchools={schoolsWithStats} initialUsers={allUsers} />
      <footer className="max-w-5xl mx-auto px-3 sm:px-6 py-6 text-center">
        <p className="text-xs text-gray-700">RotaPlan v0.2</p>
      </footer>
    </div>
  );
}
