"use client";

import { logoutAction } from "@/lib/actions";
import Link from "next/link";

export default function SuperAdminHeader({ email }: { email: string }) {
  return (
    <header className="bg-dark-800 border-b border-dark-500">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-5">
        <div className="flex items-start sm:items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-dark-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white leading-none">RotaPlan</h1>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Süper Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="text-right max-w-[45vw] sm:max-w-xs min-w-0">
              <p className="text-[10px] text-gray-600 truncate" title={email}>
                {email}
              </p>
            </div>
            <Link
              href="/sifre-degistir"
              className="p-2 text-gray-500 hover:text-accent hover:bg-dark-600 rounded-lg transition"
              title="Şifre Değiştir"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </Link>
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
        </div>
      </div>
    </header>
  );
}
