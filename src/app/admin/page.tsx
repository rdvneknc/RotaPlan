import { getStudents, getSchool, getVehicles, getSessions } from "@/lib/store";
import { ADMIN_PAGE_CONTAINER } from "@/lib/admin-layout";
import Header from "@/components/Header";
import AdminDashboard from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const students = getStudents();
  const school = getSchool();
  const vehicles = getVehicles();
  const sessions = getSessions();

  return (
    <div className="min-h-screen bg-dark-900">
      <Header schoolLabel={school.label} role="admin" />
      <AdminDashboard initialStudents={students} initialSchool={school} initialVehicles={vehicles} initialSessions={sessions} />
      <footer className={`${ADMIN_PAGE_CONTAINER} py-6 text-center`}>
        <p className="text-xs text-gray-700">RotaPlan v0.2</p>
      </footer>
    </div>
  );
}
