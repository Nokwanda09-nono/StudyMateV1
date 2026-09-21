// lib/store.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
}

export interface UserProfile {
  studyHoursPerDay?: number;
  studyDaysPerWeek?: number;
  academicGoal?: string;
  studyStyle?: string;
  fieldOfStudy?: string;
  academicLevel?: string;
  preferredStudyTime?: string;
}

export interface Module {
  id: string;
  name: string;
  color: string;
  icon: string;
  fileCount: number;
}

export interface FileItem {
  id: string;
  moduleId: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

export interface Assessment {
  id: string;
  moduleId: string;
  type: "quiz" | "test" | "mock_exam";
  title: string;
  questionCount: number;
  completed: boolean;
  score?: number;
}

export interface ScheduleItem {
  id: string;
  title: string;
  moduleId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  color: string;
  is_recurring: boolean;
}

export interface AttendanceRecord {
  id: string;
  scheduleId: string;
  date: string;
  status: "present" | "absent";
}

class Store {
  private modules: Module[] = [];
  private files: FileItem[] = [];
  private assessments: Assessment[] = [];
  private schedule: ScheduleItem[] = [];
  private attendance: AttendanceRecord[] = [];
  private user: User | null = null;
  private profile: UserProfile | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage() {
    try {
      const modules = await AsyncStorage.getItem("modules");
      const files = await AsyncStorage.getItem("files");
      const assessments = await AsyncStorage.getItem("assessments");
      const schedule = await AsyncStorage.getItem("schedule");
      const attendance = await AsyncStorage.getItem("attendance");
      const user = await AsyncStorage.getItem("user");
      const profile = await AsyncStorage.getItem("profile");

      if (modules) this.modules = JSON.parse(modules);
      if (files) this.files = JSON.parse(files);
      if (assessments) this.assessments = JSON.parse(assessments);
      if (schedule) this.schedule = JSON.parse(schedule);
      if (attendance) this.attendance = JSON.parse(attendance);
      if (user) this.user = JSON.parse(user);
      if (profile) this.profile = JSON.parse(profile);
    } catch (error) {
      console.error("Error loading from storage:", error);
    }
  }

  private async saveToStorage(key: string, data: any) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  }

  // Module methods
  getModules(): Module[] {
    return this.modules;
  }

  addModule(module: Module) {
    this.modules.push(module);
    this.saveToStorage("modules", this.modules);
  }

  deleteModule(id: string) {
    this.modules = this.modules.filter((m) => m.id !== id);
    this.files = this.files.filter((f) => f.moduleId !== id);
    this.assessments = this.assessments.filter((a) => a.moduleId !== id);
    this.saveToStorage("modules", this.modules);
    this.saveToStorage("files", this.files);
    this.saveToStorage("assessments", this.assessments);
  }

  // File methods
  getFiles(): FileItem[] {
    return this.files;
  }

  addFile(file: FileItem) {
    this.files.push(file);
    const module = this.modules.find((m) => m.id === file.moduleId);
    if (module) {
      module.fileCount = this.files.filter(
        (f) => f.moduleId === module.id,
      ).length;
    }
    this.saveToStorage("files", this.files);
    this.saveToStorage("modules", this.modules);
  }

  deleteFile(id: string) {
    const file = this.files.find((f) => f.id === id);
    this.files = this.files.filter((f) => f.id !== id);
    if (file) {
      const module = this.modules.find((m) => m.id === file.moduleId);
      if (module) {
        module.fileCount = this.files.filter(
          (f) => f.moduleId === module.id,
        ).length;
      }
    }
    this.saveToStorage("files", this.files);
    this.saveToStorage("modules", this.modules);
  }

  // Assessment methods
  getAssessments(): Assessment[] {
    return this.assessments;
  }

  addAssessment(assessment: Assessment) {
    this.assessments.push(assessment);
    this.saveToStorage("assessments", this.assessments);
  }

  updateAssessment(id: string, updates: Partial<Assessment>) {
    const index = this.assessments.findIndex((a) => a.id === id);
    if (index !== -1) {
      this.assessments[index] = { ...this.assessments[index], ...updates };
      this.saveToStorage("assessments", this.assessments);
    }
  }

  // Schedule methods
  getSchedule(): ScheduleItem[] {
    return this.schedule;
  }

  addScheduleItem(item: ScheduleItem) {
    this.schedule.push(item);
    this.saveToStorage("schedule", this.schedule);
  }

  deleteScheduleItem(id: string) {
    this.schedule = this.schedule.filter((s) => s.id !== id);
    this.saveToStorage("schedule", this.schedule);
  }

  // Attendance methods
  getAttendance(): AttendanceRecord[] {
    return this.attendance;
  }

  addAttendance(record: AttendanceRecord) {
    this.attendance.push(record);
    this.saveToStorage("attendance", this.attendance);
  }

  // User methods
  getUser(): User | null {
    return this.user;
  }

  setUser(user: User) {
    this.user = user;
    this.saveToStorage("user", user);
  }

  // Profile methods
  getProfile(): UserProfile | null {
    return this.profile;
  }

  setProfile(profile: UserProfile) {
    this.profile = profile;
    this.saveToStorage("profile", profile);
  }

  clearAllData() {
    this.modules = [];
    this.files = [];
    this.assessments = [];
    this.schedule = [];
    this.attendance = [];
    this.user = null;
    this.profile = null;

    AsyncStorage.clear();
  }
}

export const store = new Store();
