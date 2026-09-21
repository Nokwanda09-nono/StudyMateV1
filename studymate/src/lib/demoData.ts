// lib/demoData.ts
import { store } from "./store";

export const seedDemoData = () => {
  // Create demo user
  const demoUser = {
    id: "demo-user-1",
    email: "demo@studymate.com",
    emailVerified: true,
    onboardingCompleted: true,
  };
  store.setUser(demoUser);

  // Create demo profile
  const demoProfile = {
    studyHoursPerDay: 3,
    studyDaysPerWeek: 5,
    academicGoal: "graduate",
    studyStyle: "visual",
    fieldOfStudy: "computer-science",
    academicLevel: "undergraduate",
    preferredStudyTime: "evening",
  };
  store.setProfile(demoProfile);

  // Create demo modules
  const modules = [
    {
      id: "module-1",
      name: "Computer Science Fundamentals",
      color: "#6366f1",
      icon: "BookOpen",
      fileCount: 4,
    },
    {
      id: "module-2",
      name: "Advanced Mathematics",
      color: "#22c55e",
      icon: "BookOpen",
      fileCount: 3,
    },
    {
      id: "module-3",
      name: "Physics 101",
      color: "#f97316",
      icon: "BookOpen",
      fileCount: 2,
    },
  ];

  modules.forEach((module) => store.addModule(module));

  // Create demo files
  const files = [
    {
      id: "file-1",
      moduleId: "module-1",
      name: "Introduction to Programming.pdf",
      type: "application/pdf",
      size: 2457600,
      uploadedAt: new Date(),
    },
    {
      id: "file-2",
      moduleId: "module-1",
      name: "Data Structures Notes.pdf",
      type: "application/pdf",
      size: 1835008,
      uploadedAt: new Date(),
    },
    {
      id: "file-3",
      moduleId: "module-2",
      name: "Calculus Review.pdf",
      type: "application/pdf",
      size: 3145728,
      uploadedAt: new Date(),
    },
  ];

  files.forEach((file) => store.addFile(file));

  // Create demo assessments
  const assessments = [
    {
      id: "assessment-1",
      moduleId: "module-1",
      type: "quiz" as const,
      title: "Programming Basics Quiz",
      questionCount: 10,
      completed: true,
      score: 85,
    },
    {
      id: "assessment-2",
      moduleId: "module-2",
      type: "test" as const,
      title: "Calculus Midterm Test",
      questionCount: 25,
      completed: false,
    },
  ];

  assessments.forEach((assessment) => store.addAssessment(assessment));

  // Create demo schedule
  const schedule = [
    {
      id: "schedule-1",
      title: "Computer Science Lecture",
      moduleId: "module-1",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:30",
      color: "#6366f1",
      is_recurring: true,
    },
    {
      id: "schedule-2",
      title: "Mathematics Tutorial",
      moduleId: "module-2",
      dayOfWeek: 2,
      startTime: "11:00",
      endTime: "12:30",
      color: "#22c55e",
      is_recurring: true,
    },
  ];

  schedule.forEach((item) => store.addScheduleItem(item));
};
