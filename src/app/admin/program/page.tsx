import { getStudents, getSchool, getSessions } from "@/lib/store";
import Header from "@/components/Header";
import ProgramEditor from "@/components/ProgramEditor";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ProgramPage() {
  const students = getStudents();
  const school = getSchool();
  const sessions = getSessions();

  return (
    <div className="min-h-screen bg-dark-900">
      <Header schoolLabel={school.label} role="admin" />
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Admin Paneli
          </Link>
        </div>
        <ProgramEditor initialSessions={sessions} initialStudents={students} />
      </main>
      <footer className="max-w-7xl mx-auto px-6 py-6 text-center">
        <p className="text-xs text-gray-700">RotaPlan v0.2</p>
      </footer>
    </div>
  );
}
