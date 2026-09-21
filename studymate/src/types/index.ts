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
  uri?: string;
}

export interface Assessment {
  id: string;
  moduleId: string;
  type: 'quiz' | 'test' | 'mock_exam';
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
  status: 'present' | 'absent';
}