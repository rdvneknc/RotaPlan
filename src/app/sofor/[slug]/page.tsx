import { getVehicleBySlug, getStudentsByVehicle, getSchool } from "@/lib/store";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import DriverDashboard from "@/components/DriverDashboard";

export const dynamic = "force-dynamic";

export default async function DriverVehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = getVehicleBySlug(slug);
  if (!vehicle) notFound();

  const students = getStudentsByVehicle(vehicle.id);
  const school = getSchool();

  return (
    <div className="min-h-screen bg-dark-900">
      <Header schoolLabel={school.label} role="driver" />
      <DriverDashboard initialStudents={students} vehicle={vehicle} />
      <footer className="max-w-2xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-gray-700">RotaPlan v0.1</p>
      </footer>
    </div>
  );
}
