import { getVehicleBySlug, getSchool, getDailyDistribution, isVehicleWorkingToday, getSchoolById } from "@/lib/store";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import DriverDashboard from "@/components/DriverDashboard";
import { guardSoforVehiclePage } from "@/lib/sofor-auth";

export const dynamic = "force-dynamic";

export default async function DriverVehiclePage({ params }: { params: Promise<{ schoolId: string; slug: string }> }) {
  const { schoolId, slug } = await params;
  const schoolReg = await getSchoolById(schoolId);
  if (!schoolReg) notFound();

  const session = await guardSoforVehiclePage(schoolId, slug);

  const vehicle = await getVehicleBySlug(schoolId, slug);
  if (!vehicle) notFound();

  const school = await getSchool(schoolId);
  const distribution = await getDailyDistribution(schoolId);
  const workingToday = await isVehicleWorkingToday(schoolId, vehicle.id);

  return (
    <div className="min-h-screen bg-dark-900">
      <Header
        schoolLabel={schoolReg.name || school.label}
        role="driver"
        userEmail={session.email}
        showPasswordLink={session.role !== "driver"}
      />
      <DriverDashboard
        schoolId={schoolId}
        vehicle={vehicle}
        initialDistribution={distribution}
        initialWorkingToday={workingToday}
      />
      <footer className="max-w-2xl mx-auto px-3 sm:px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <p className="text-xs text-gray-700">RotaPlan v0.2</p>
      </footer>
    </div>
  );
}
