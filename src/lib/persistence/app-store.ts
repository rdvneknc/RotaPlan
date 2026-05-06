import type {
  Student,
  Vehicle,
  Session,
  SchoolInfo,
  School,
  AppUser,
  DailyDistribution,
  SessionDistributionAssignment,
  DriverRouteDirections,
} from "../types";
import type { VehicleCountSuggestion } from "../optimizer";
import type { PasswordResetTokenRecord } from "./password-reset-tokens";

export type WeeklyScheduleMap = {
  [day: string]: {
    [sessionId: string]: string[];
  };
};

/**
 * Tüm uygulama verisi — dosya veya Firestore (`DataPersistence`) arkasında aynı asenkron sözleşme.
 */
export interface AppStore {
  getSchools(): Promise<School[]>;
  getSchoolById(id: string): Promise<School | null>;
  addSchool(input: Omit<School, "id" | "createdAt">): Promise<School>;
  updateSchoolRegistry(id: string, updates: Partial<Omit<School, "id" | "createdAt">>): Promise<School | null>;
  deleteSchool(id: string): Promise<boolean>;
  getSchoolStats(schoolId: string): Promise<{ studentCount: number; vehicleCount: number; sessionCount: number }>;

  getUsers(): Promise<AppUser[]>;
  getUsersBySchool(schoolId: string): Promise<AppUser[]>;
  getUserByEmail(email: string): Promise<AppUser | null>;
  getUserById(id: string): Promise<AppUser | null>;
  createUser(input: {
    email: string;
    password: string;
    schoolId: string | null;
    role: "superadmin" | "admin";
  }): Promise<AppUser | { error: string }>;
  registerUserFromFirebaseAuth(input: {
    uid: string;
    email: string;
    schoolId: string | null;
    role: "superadmin" | "admin";
  }): Promise<AppUser | { error: string }>;
  validateUser(email: string, password: string): Promise<AppUser | null>;
  changeUserPassword(userId: string, newPassword: string): Promise<boolean>;
  setUserPassword(userId: string, newPassword: string, mustChangePassword: boolean): Promise<boolean>;
  deleteUser(userId: string): Promise<boolean>;

  getSchool(schoolId: string): Promise<SchoolInfo>;
  updateSchool(schoolId: string, school: SchoolInfo): Promise<void>;

  getSessions(schoolId: string): Promise<Session[]>;
  getSessionById(schoolId: string, id: string): Promise<Session | null>;
  getCurrentSession(schoolId: string): Promise<Session | null>;
  getClassDuration(schoolId: string): Promise<number>;
  setClassDuration(schoolId: string, minutes: number): Promise<void>;
  addSession(schoolId: string, input: { label: string; time: string; studentIds: string[] }): Promise<Session>;
  updateSession(
    schoolId: string,
    id: string,
    updates: { label?: string; time?: string; studentIds?: string[] },
  ): Promise<Session | null>;
  deleteSession(schoolId: string, id: string): Promise<boolean>;
  loadSession(schoolId: string, sessionId: string): Promise<{ error?: string; loaded?: number }>;

  getWeeklySchedule(schoolId: string): Promise<WeeklyScheduleMap>;
  setWeeklyScheduleDay(schoolId: string, day: string, sessionId: string, studentIds: string[]): Promise<void>;
  replaceWeeklySchedule(schoolId: string, schedule: WeeklyScheduleMap): Promise<void>;
  getWeeklyScheduleForDay(schoolId: string, day: string): Promise<{ [sessionId: string]: string[] }>;

  getVehicles(schoolId: string): Promise<Vehicle[]>;
  getVehicleBySlug(schoolId: string, slug: string): Promise<Vehicle | null>;
  getVehicleById(schoolId: string, id: string): Promise<Vehicle | null>;
  normalizeDriverUsername(raw: string): string;
  isDriverLoginUsernameTaken(
    username: string,
    except?: { schoolId: string; vehicleId: string },
  ): Promise<boolean>;
  findVehicleByLoginUsername(username: string): Promise<{ schoolId: string; vehicle: Vehicle } | null>;
  resolveDriverByUsername(username: string): Promise<{ schoolId: string; vehicle: Vehicle } | null>;
  addVehicle(
    schoolId: string,
    input: { driverName: string; plate: string; capacity: number; loginUsername: string },
  ): Promise<Vehicle>;
  updateVehicle(
    schoolId: string,
    id: string,
    updates: Partial<Omit<Vehicle, "id" | "slug">>,
  ): Promise<Vehicle | null>;
  deleteVehicle(schoolId: string, id: string): Promise<boolean>;

  getStudents(schoolId: string): Promise<Student[]>;
  getStudentsByVehicle(schoolId: string, vehicleId: string): Promise<Student[]>;
  addStudent(schoolId: string, input: Omit<Student, "id" | "isActive">): Promise<Student>;
  updateStudent(schoolId: string, id: string, updates: Partial<Omit<Student, "id">>): Promise<Student | null>;
  deleteStudent(schoolId: string, id: string): Promise<boolean>;
  toggleStudentActive(schoolId: string, id: string): Promise<Student | null>;
  setAllStudentsActiveByVehicle(schoolId: string, vehicleId: string, active: boolean): Promise<void>;
  setAllStudentsActive(schoolId: string, active: boolean): Promise<void>;
  assignStudentToVehicle(schoolId: string, studentId: string, vehicleId: string | null): Promise<Student | null>;
  reorderStudent(schoolId: string, id: string, direction: "up" | "down"): Promise<boolean>;

  getWorkingVehicleIdsForDay(schoolId: string, dayKey: string): Promise<string[]>;
  setWorkingVehicleIdsForDay(
    schoolId: string,
    dayKey: string,
    vehicleIds: string[],
  ): Promise<{ error?: string }>;
  isVehicleWorkingToday(schoolId: string, vehicleId: string): Promise<boolean>;

  distributeDailyAll(schoolId: string): Promise<{
    error?: string;
    groupCount?: number;
    uniqueStudents?: number;
    vehicleCount?: number;
    warnings?: string[];
  }>;
  getDailyDistribution(schoolId: string): Promise<DailyDistribution | null>;
  getVehicleCountSuggestionForDay(schoolId: string, dayKey: string): Promise<VehicleCountSuggestion | null>;
  clearDailyDistributionToday(schoolId: string): Promise<void>;

  updateDailyDistributionGroup(
    schoolId: string,
    groupId: string,
    assignments: SessionDistributionAssignment[],
  ): Promise<{ error?: string }>;
  getGroupDistribution(schoolId: string, groupId: string, vehicleId: string): Promise<Student[]>;
  generateDriverRouteDirections(
    schoolId: string,
    groupId: string,
    vehicleId: string,
    excludeStudentIds?: string[] | null,
  ): Promise<DriverRouteDirections | null>;
  generateRouteLinkForGroup(
    schoolId: string,
    groupId: string,
    vehicleId: string,
    excludeStudentIds?: string[] | null,
  ): Promise<string | null>;

  readPasswordResetTokens(): Promise<PasswordResetTokenRecord[]>;
  writePasswordResetTokens(tokens: PasswordResetTokenRecord[]): Promise<void>;
}
