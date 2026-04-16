"use client";

import { useState, useCallback } from "react";
import { School } from "@/lib/types";
import {
  createSchool,
  editSchoolAction,
  removeSchool,
  fetchAllSchoolStats,
  createUserAction,
  deleteUserAction,
  fetchAllUsers,
  superAdminResetPasswordAction,
} from "@/lib/actions";
import Link from "next/link";

interface SchoolWithStats {
  school: School;
  stats: { studentCount: number; vehicleCount: number; sessionCount: number };
}

interface UserInfo {
  id: string;
  email: string;
  role: string;
  schoolId: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

interface Props {
  initialSchools: SchoolWithStats[];
  initialUsers: UserInfo[];
}

export default function SuperAdminDashboard({ initialSchools, initialUsers }: Props) {
  const [schools, setSchools] = useState<SchoolWithStats[]>(initialSchools);
  const [showForm, setShowForm] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserInfo[]>(initialUsers);
  const [addingUserForSchool, setAddingUserForSchool] = useState<string | null>(null);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPwError, setResetPwError] = useState<string | null>(null);
  const [resetPwLoading, setResetPwLoading] = useState(false);

  const refresh = useCallback(async () => {
    const [data, usrs] = await Promise.all([fetchAllSchoolStats(), fetchAllUsers()]);
    setSchools(data);
    setUsers(usrs);
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    const result = await createSchool(formData);
    if (result.error) {
      setFormError(result.error);
    } else {
      setShowForm(false);
      await refresh();
    }
    setLoading(false);
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSchool) return;
    setLoading(true);
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("id", editingSchool.id);
    const result = await editSchoolAction(formData);
    if (result.error) {
      setFormError(result.error);
    } else {
      setEditingSchool(null);
      await refresh();
    }
    setLoading(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" okulunu silmek istediğinize emin misiniz? Tüm veriler silinecektir.`)) return;
    const formData = new FormData();
    formData.set("id", id);
    await removeSchool(formData);
    await refresh();
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUserLoading(true);
    setUserFormError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("role", "admin");
    if (addingUserForSchool) formData.set("schoolId", addingUserForSchool);
    const result = await createUserAction(formData);
    if (result.error) {
      setUserFormError(result.error);
    } else {
      setAddingUserForSchool(null);
      await refresh();
    }
    setUserLoading(false);
  }

  async function handleDeleteUser(id: string, email: string) {
    if (!confirm(`"${email}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
    const formData = new FormData();
    formData.set("id", id);
    await deleteUserAction(formData);
    await refresh();
  }

  function getSchoolUsers(schoolId: string): UserInfo[] {
    return users.filter((u) => u.schoolId === schoolId);
  }

  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetPasswordUserId) return;
    setResetPwLoading(true);
    setResetPwError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("userId", resetPasswordUserId);
    const result = await superAdminResetPasswordAction(formData);
    if (result.error) {
      setResetPwError(result.error);
    } else {
      setResetPasswordUserId(null);
      await refresh();
    }
    setResetPwLoading(false);
  }

  const totalStudents = schools.reduce((s, x) => s + x.stats.studentCount, 0);
  const totalVehicles = schools.reduce((s, x) => s + x.stats.vehicleCount, 0);

  return (
    <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-3 sm:p-4 text-center">
          <p className="text-xl sm:text-2xl font-bold text-white">{schools.length}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Okul</p>
        </div>
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-3 sm:p-4 text-center">
          <p className="text-xl sm:text-2xl font-bold text-accent">{totalStudents}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Toplam Öğrenci</p>
        </div>
        <div className="bg-dark-800 rounded-2xl border border-dark-500 p-3 sm:p-4 text-center">
          <p className="text-xl sm:text-2xl font-bold text-white">{totalVehicles}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Toplam Araç</p>
        </div>
      </div>

      <div className="bg-dark-800 rounded-2xl border border-dark-500 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Okullar</h2>
          <button
            onClick={() => { setShowForm(!showForm); setEditingSchool(null); setFormError(null); }}
            className="text-sm text-accent hover:text-accent-hover font-medium flex items-center gap-1.5 transition"
          >
            {showForm ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Kapat
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Okul Ekle
              </>
            )}
          </button>
        </div>

        {showForm && !editingSchool && (
          <form onSubmit={handleCreate} className="mb-5 pb-5 border-b border-dark-500 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input name="name" placeholder="Okul Adı" required className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
              <input name="label" placeholder="Konum Etiketi (ör. Ereğli, Konya)" required className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
            </div>
            <input name="mapsUrl" placeholder="Google Maps Linki" required className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
            <input name="googleSheetUrl" placeholder="Google Sheets linki (opsiyonel, okul programı için)" className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
            <input name="adminEmail" placeholder="İletişim e-postası (opsiyonel, kayıt için)" className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
            <p className="text-xs text-gray-600">Panel girişi (opsiyonel): okulla birlikte ilk admin hesabı oluşturulur.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input name="panelLoginEmail" type="email" placeholder="Panel giriş e-postası (opsiyonel)" className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
              <input name="panelLoginPassword" type="text" autoComplete="new-password" placeholder="Panel şifresi (opsiyonel, min 4)" minLength={4} className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
            </div>
            {formError && <p className="text-sm text-red-400">{formError}</p>}
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover rounded-xl transition disabled:opacity-50">
              {loading ? "Ekleniyor..." : "Okul Ekle"}
            </button>
          </form>
        )}

        {editingSchool && (
          <form onSubmit={handleEdit} className="mb-5 pb-5 border-b border-dark-500 space-y-3">
            <p className="text-sm text-gray-400 mb-1">Düzenleniyor: {editingSchool.name}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input name="name" defaultValue={editingSchool.name} placeholder="Okul Adı" required className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
              <input name="label" defaultValue={editingSchool.label} placeholder="Konum Etiketi" required className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
            </div>
            <input name="mapsUrl" defaultValue={editingSchool.mapsUrl} placeholder="Google Maps Linki" required className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
            <input
              name="googleSheetUrl"
              defaultValue={
                editingSchool.googleSheetId
                  ? `https://docs.google.com/spreadsheets/d/${editingSchool.googleSheetId}/edit`
                  : ""
              }
              placeholder="Google Sheets linki (opsiyonel)"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none"
            />
            <input name="adminEmail" defaultValue={editingSchool.adminEmail ?? ""} placeholder="İletişim e-postası (opsiyonel)" className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-xl text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
            {formError && <p className="text-sm text-red-400">{formError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-dark-900 bg-accent hover:bg-accent-hover rounded-xl transition disabled:opacity-50">
                {loading ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button type="button" onClick={() => { setEditingSchool(null); setFormError(null); }} className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition">
                İptal
              </button>
            </div>
          </form>
        )}

        {schools.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p className="text-base">Henüz okul eklenmemiş.</p>
            <p className="text-sm mt-1">Yukarıdaki butona tıklayarak ilk okulu ekleyin.</p>
          </div>
        ) : (
          <ul className="divide-y divide-dark-500">
            {schools.map(({ school, stats }) => {
              const schoolUsers = getSchoolUsers(school.id);
              return (
              <li key={school.id} className="py-4 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-white">{school.name}</p>
                    <p className="text-sm text-gray-500">{school.label}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                      <span>{stats.studentCount} öğrenci</span>
                      <span>{stats.vehicleCount} araç</span>
                      <span>{stats.sessionCount} seans</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    <Link
                      href={`/admin/${school.id}`}
                      className="px-3 py-2 text-xs font-semibold text-dark-900 bg-accent hover:bg-accent-hover rounded-lg transition"
                    >
                      Panele Geç
                    </Link>
                    <Link
                      href={`/sofor/${school.id}`}
                      className="px-3 py-2 text-xs font-medium text-gray-300 bg-dark-600 hover:bg-dark-500 rounded-lg transition"
                      title="Şoför Paneli"
                    >
                      Şoför
                    </Link>
                    <button
                      onClick={() => { setEditingSchool(school); setShowForm(false); setFormError(null); }}
                      className="p-2 text-gray-500 hover:text-accent hover:bg-accent/10 rounded-lg transition"
                      title="Düzenle"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(school.id, school.name)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Sil"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Admin users */}
                <div className="ml-1 pl-3 border-l-2 border-dark-500">
                  {schoolUsers.length > 0 ? (
                    <div className="space-y-1">
                      {schoolUsers.map((u) => (
                        <div key={u.id} className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-gray-300">{u.email}</span>
                            {u.mustChangePassword && <span className="text-amber-400 text-[10px]">(geçici şifre)</span>}
                            <button
                              type="button"
                              onClick={() => {
                                setResetPasswordUserId(resetPasswordUserId === u.id ? null : u.id);
                                setResetPwError(null);
                              }}
                              className="text-gray-600 hover:text-accent transition text-[10px] font-medium"
                              title="Yeni şifre ata"
                            >
                              Şifre
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              className="ml-auto text-gray-600 hover:text-red-400 transition"
                              title="Kullanıcıyı sil"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {resetPasswordUserId === u.id && (
                            <form onSubmit={handleResetPassword} className="flex flex-wrap items-end gap-2 pl-5">
                              <input name="newPassword" type="text" autoComplete="new-password" required minLength={4} placeholder="Yeni şifre" className="w-28 px-2 py-1 bg-dark-700 border border-dark-500 rounded text-xs text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
                              <input name="confirmPassword" type="text" autoComplete="new-password" required minLength={4} placeholder="Tekrar" className="w-28 px-2 py-1 bg-dark-700 border border-dark-500 rounded text-xs text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
                              <button type="submit" disabled={resetPwLoading} className="px-2 py-1 text-[10px] font-semibold text-dark-900 bg-accent rounded transition disabled:opacity-50">
                                {resetPwLoading ? "…" : "Kaydet"}
                              </button>
                              <button type="button" onClick={() => { setResetPasswordUserId(null); setResetPwError(null); }} className="text-[10px] text-gray-500 hover:text-white">
                                İptal
                              </button>
                              {resetPwError && <span className="text-[10px] text-red-400 w-full">{resetPwError}</span>}
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">Henüz admin atanmamış.</p>
                  )}

                  {addingUserForSchool === school.id ? (
                    <form onSubmit={handleCreateUser} className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                      <input name="email" type="email" required placeholder="admin@okul.com" className="flex-1 min-w-0 px-2.5 py-1.5 bg-dark-700 border border-dark-500 rounded-lg text-xs text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
                      <input name="password" type="text" autoComplete="new-password" required placeholder="Şifre (min 4)" minLength={4} className="w-full sm:w-32 px-2.5 py-1.5 bg-dark-700 border border-dark-500 rounded-lg text-xs text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
                      <div className="flex gap-2">
                        <button type="submit" disabled={userLoading} className="px-3 py-1.5 text-xs font-semibold text-dark-900 bg-accent hover:bg-accent-hover rounded-lg transition disabled:opacity-50">
                          {userLoading ? "..." : "Ekle"}
                        </button>
                        <button type="button" onClick={() => { setAddingUserForSchool(null); setUserFormError(null); }} className="px-2 py-1.5 text-xs text-gray-500 hover:text-white transition">
                          İptal
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => { setAddingUserForSchool(school.id); setUserFormError(null); }}
                      className="mt-1.5 text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Admin Ekle
                    </button>
                  )}

                  {userFormError && addingUserForSchool === school.id && (
                    <p className="text-xs text-red-400 mt-1">{userFormError}</p>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
