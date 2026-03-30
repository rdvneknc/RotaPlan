"use client";

import Link from "next/link";
import { ADMIN_PAGE_CONTAINER } from "@/lib/admin-layout";

interface Props {
  schoolLabel: string;
  role: "admin" | "driver";
}

export default function Header({ schoolLabel, role }: Props) {
  const containerClass =
    role === "admin" ? `${ADMIN_PAGE_CONTAINER} py-5` : "max-w-2xl mx-auto px-4 py-5";

  return (
    <header className="bg-dark-800 border-b border-dark-500">
      <div className={containerClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <svg className="w-6 h-6 text-dark-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">RotaPlan</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {role === "admin" ? "Admin Paneli" : "Şoför Paneli"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-500">Okul</p>
              <p
                className={`text-sm font-medium text-gray-300 truncate ${
                  role === "admin" ? "max-w-[160px] sm:max-w-[220px] md:max-w-xs lg:max-w-sm" : "max-w-[160px]"
                }`}
              >
                {schoolLabel}
              </p>
            </div>
            <Link
              href="/"
              className="p-2.5 text-gray-500 hover:text-accent hover:bg-dark-600 rounded-lg transition"
              title="Çıkış"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
