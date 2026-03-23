import { getStudents, getSchool, getVehicles, getSessions } from "@/lib/store";
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
      <footer className="max-w-2xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-gray-700">RotaPlan v0.2</p>
      </footer>
    </div>
  );
}
