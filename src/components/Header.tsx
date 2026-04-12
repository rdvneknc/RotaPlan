"use client";

import Link from "next/link";
import { ADMIN_PAGE_CONTAINER } from "@/lib/admin-layout";
import { logoutAction } from "@/lib/actions";

interface Props {
  schoolLabel: string;
  role: "admin" | "driver";
  userEmail?: string;
  /** Varsayılan: admin arayüzünde açık. Şoför oturumunda kapalı; admin önizlemesinde true geçin. */
  showPasswordLink?: boolean;
}

export default function Header({ schoolLabel, role, userEmail, showPasswordLink }: Props) {
  const canChangePassword = showPasswordLink ?? role === "admin";
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
              {userEmail && (
                <p className="text-[10px] text-gray-600 truncate max-w-[160px]">{userEmail}</p>
              )}
            </div>
            {userEmail ? (
              <div className="flex items-center gap-1">
                {canChangePassword && (
                  <Link
                    href="/sifre-degistir"
                    className="p-2 text-gray-500 hover:text-accent hover:bg-dark-600 rounded-lg transition"
                    title="Şifre Değiştir"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </Link>
                )}
                <button
                  onClick={() => logoutAction()}
                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-dark-600 rounded-lg transition"
                  title="Çıkış Yap"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <Link
                href="/"
                className="p-2.5 text-gray-500 hover:text-accent hover:bg-dark-600 rounded-lg transition"
                title="Ana Sayfa"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
