/**
 * Uygulama veri katmanı cephesi. `getAppStore()` dosya veya Firestore uygulamasına yönlendirir.
 * @see src/lib/persistence/
 */
import { getAppStore } from "./persistence/backend";
import type { AppStore } from "./persistence/app-store";

const backend = () => getAppStore();

/** Doğrudan backend (özel enjeksiyon). Normal kullanımda aşağıdaki fonksiyonlar yeterli. */
export { getAppStore } from "./persistence/backend";

export type { SessionDistributionAssignment } from "./types";
export type { WeeklyScheduleMap } from "./persistence/app-store";
export type { PasswordResetTokenRecord } from "./persistence/password-reset-tokens";

export async function getSchools() {
  return backend().getSchools();
}
export async function getSchoolById(id: string) {
  return backend().getSchoolById(id);
}
export async function addSchool(input: Parameters<AppStore["addSchool"]>[0]) {
  return backend().addSchool(input);
}
export async function updateSchoolRegistry(id: string, updates: Parameters<AppStore["updateSchoolRegistry"]>[1]) {
  return backend().updateSchoolRegistry(id, updates);
}
export async function deleteSchool(id: string) {
  return backend().deleteSchool(id);
}
export async function getSchoolStats(schoolId: string) {
  return backend().getSchoolStats(schoolId);
}
export async function getUsers() {
  return backend().getUsers();
}
export async function getUsersBySchool(schoolId: string) {
  return backend().getUsersBySchool(schoolId);
}
export async function getUserByEmail(email: string) {
  return backend().getUserByEmail(email);
}
export async function getUserById(id: string) {
  return backend().getUserById(id);
}
export async function createUser(input: Parameters<AppStore["createUser"]>[0]) {
  return backend().createUser(input);
}
export async function registerUserFromFirebaseAuth(
  input: Parameters<AppStore["registerUserFromFirebaseAuth"]>[0],
) {
  return backend().registerUserFromFirebaseAuth(input);
}
export async function validateUser(email: string, password: string) {
  return backend().validateUser(email, password);
}
export async function changeUserPassword(userId: string, newPassword: string) {
  return backend().changeUserPassword(userId, newPassword);
}
export async function setUserPassword(userId: string, newPassword: string, mustChangePassword: boolean) {
  return backend().setUserPassword(userId, newPassword, mustChangePassword);
}
export async function deleteUser(userId: string) {
  return backend().deleteUser(userId);
}
export async function getSchool(schoolId: string) {
  return backend().getSchool(schoolId);
}
export async function updateSchool(schoolId: string, school: Parameters<AppStore["updateSchool"]>[1]) {
  return backend().updateSchool(schoolId, school);
}
export async function getSessions(schoolId: string) {
  return backend().getSessions(schoolId);
}
export async function getSessionById(schoolId: string, id: string) {
  return backend().getSessionById(schoolId, id);
}
export async function getCurrentSession(schoolId: string) {
  return backend().getCurrentSession(schoolId);
}
export async function getClassDuration(schoolId: string) {
  return backend().getClassDuration(schoolId);
}
export async function setClassDuration(schoolId: string, minutes: number) {
  return backend().setClassDuration(schoolId, minutes);
}
export async function addSession(schoolId: string, input: Parameters<AppStore["addSession"]>[1]) {
  return backend().addSession(schoolId, input);
}
export async function updateSession(
  schoolId: string,
  id: string,
  updates: Parameters<AppStore["updateSession"]>[2],
) {
  return backend().updateSession(schoolId, id, updates);
}
export async function deleteSession(schoolId: string, id: string) {
  return backend().deleteSession(schoolId, id);
}
export async function loadSession(schoolId: string, sessionId: string) {
  return backend().loadSession(schoolId, sessionId);
}
export async function getWeeklySchedule(schoolId: string) {
  return backend().getWeeklySchedule(schoolId);
}
export async function setWeeklyScheduleDay(
  schoolId: string,
  day: string,
  sessionId: string,
  studentIds: string[],
) {
  return backend().setWeeklyScheduleDay(schoolId, day, sessionId, studentIds);
}
export async function replaceWeeklySchedule(
  schoolId: string,
  schedule: { [day: string]: { [sessionId: string]: string[] } },
) {
  return backend().replaceWeeklySchedule(schoolId, schedule);
}
export async function getWeeklyScheduleForDay(schoolId: string, day: string) {
  return backend().getWeeklyScheduleForDay(schoolId, day);
}
export async function getVehicles(schoolId: string) {
  return backend().getVehicles(schoolId);
}
export async function getVehicleBySlug(schoolId: string, slug: string) {
  return backend().getVehicleBySlug(schoolId, slug);
}
export async function getVehicleById(schoolId: string, id: string) {
  return backend().getVehicleById(schoolId, id);
}
export function normalizeDriverUsername(raw: string) {
  return backend().normalizeDriverUsername(raw);
}
export async function isDriverLoginUsernameTaken(
  username: string,
  except?: Parameters<AppStore["isDriverLoginUsernameTaken"]>[1],
) {
  return backend().isDriverLoginUsernameTaken(username, except);
}
export async function findVehicleByLoginUsername(username: string) {
  return backend().findVehicleByLoginUsername(username);
}
export async function resolveDriverByUsername(username: string) {
  return backend().resolveDriverByUsername(username);
}
export async function addVehicle(schoolId: string, input: Parameters<AppStore["addVehicle"]>[1]) {
  return backend().addVehicle(schoolId, input);
}
export async function updateVehicle(
  schoolId: string,
  id: string,
  updates: Parameters<AppStore["updateVehicle"]>[2],
) {
  return backend().updateVehicle(schoolId, id, updates);
}
export async function deleteVehicle(schoolId: string, id: string) {
  return backend().deleteVehicle(schoolId, id);
}
export async function getStudents(schoolId: string) {
  return backend().getStudents(schoolId);
}
export async function getStudentsByVehicle(schoolId: string, vehicleId: string) {
  return backend().getStudentsByVehicle(schoolId, vehicleId);
}
export async function addStudent(schoolId: string, input: Parameters<AppStore["addStudent"]>[1]) {
  return backend().addStudent(schoolId, input);
}
export async function updateStudent(
  schoolId: string,
  id: string,
  updates: Parameters<AppStore["updateStudent"]>[2],
) {
  return backend().updateStudent(schoolId, id, updates);
}
export async function deleteStudent(schoolId: string, id: string) {
  return backend().deleteStudent(schoolId, id);
}
export async function toggleStudentActive(schoolId: string, id: string) {
  return backend().toggleStudentActive(schoolId, id);
}
export async function setAllStudentsActiveByVehicle(schoolId: string, vehicleId: string, active: boolean) {
  return backend().setAllStudentsActiveByVehicle(schoolId, vehicleId, active);
}
export async function setAllStudentsActive(schoolId: string, active: boolean) {
  return backend().setAllStudentsActive(schoolId, active);
}
export async function assignStudentToVehicle(schoolId: string, studentId: string, vehicleId: string | null) {
  return backend().assignStudentToVehicle(schoolId, studentId, vehicleId);
}
export async function reorderStudent(schoolId: string, id: string, direction: "up" | "down") {
  return backend().reorderStudent(schoolId, id, direction);
}
export async function getWorkingVehicleIdsForDay(schoolId: string, dayKey: string) {
  return backend().getWorkingVehicleIdsForDay(schoolId, dayKey);
}
export async function setWorkingVehicleIdsForDay(schoolId: string, dayKey: string, vehicleIds: string[]) {
  return backend().setWorkingVehicleIdsForDay(schoolId, dayKey, vehicleIds);
}
export async function isVehicleWorkingToday(schoolId: string, vehicleId: string) {
  return backend().isVehicleWorkingToday(schoolId, vehicleId);
}
export async function distributeDailyAll(schoolId: string) {
  return backend().distributeDailyAll(schoolId);
}
export async function getDailyDistribution(schoolId: string) {
  return backend().getDailyDistribution(schoolId);
}
export async function getVehicleCountSuggestionForDay(schoolId: string, dayKey: string) {
  return backend().getVehicleCountSuggestionForDay(schoolId, dayKey);
}
export async function clearDailyDistributionToday(schoolId: string) {
  return backend().clearDailyDistributionToday(schoolId);
}
export async function updateDailyDistributionGroup(
  schoolId: string,
  groupId: string,
  assignments: Parameters<AppStore["updateDailyDistributionGroup"]>[2],
) {
  return backend().updateDailyDistributionGroup(schoolId, groupId, assignments);
}
export async function getGroupDistribution(schoolId: string, groupId: string, vehicleId: string) {
  return backend().getGroupDistribution(schoolId, groupId, vehicleId);
}
export async function generateRouteLinkForGroup(
  schoolId: string,
  groupId: string,
  vehicleId: string,
  excludeStudentIds?: string[] | null,
) {
  return backend().generateRouteLinkForGroup(schoolId, groupId, vehicleId, excludeStudentIds);
}

export async function readPasswordResetTokens() {
  return backend().readPasswordResetTokens();
}
export async function writePasswordResetTokens(tokens: Parameters<AppStore["writePasswordResetTokens"]>[0]) {
  return backend().writePasswordResetTokens(tokens);
}
