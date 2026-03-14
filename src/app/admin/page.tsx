import { getStudents, getSchool, getVehicles } from "@/lib/store";
import Header from "@/components/Header";
import AdminDashboard from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const students = getStudents();
  const school = getSchool();
  const vehicles = getVehicles();

  return (
    <div className="min-h-screen bg-dark-900">
      <Header schoolLabel={school.label} role="admin" />
      <AdminDashboard initialStudents={students} initialSchool={school} initialVehicles={vehicles} />
      <footer className="max-w-2xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-gray-700">RotaPlan v0.1</p>
      </footer>
    </div>
  );
}
