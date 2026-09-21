import React, { createContext, useContext, useEffect, useState } from "react";
import {
    Assessment,
    AttendanceRecord,
    FileItem,
    Module,
    ScheduleItem,
    store,
    User,
    UserProfile,
} from "../lib/store";

interface StoreContextType {
  modules: Module[];
  assessments: Assessment[];
  files: FileItem[];
  schedule: ScheduleItem[];
  attendance: AttendanceRecord[];
  user: User | null;
  profile: UserProfile | null;
  addModule: (module: Module) => void;
  deleteModule: (id: string) => void;
  addAssessment: (assessment: Assessment) => void;
  updateAssessment: (id: string, updates: Partial<Assessment>) => void;
  addFile: (file: FileItem) => void;
  deleteFile: (id: string) => void;
  addScheduleItem: (item: ScheduleItem) => void;
  deleteScheduleItem: (id: string) => void;
  addAttendance: (record: AttendanceRecord) => void;
  setUser: (user: User) => void;
  setProfile: (profile: UserProfile) => void;
  clearAllData: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [user, setUserState] = useState<User | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);

  useEffect(() => {
    const loadData = async () => {
      // Sync from store which might already have loaded from storage
      setModules(store.getModules());
      setAssessments(store.getAssessments());
      setFiles(store.getFiles());
      setSchedule(store.getSchedule());
      setAttendance(store.getAttendance());
      setUserState(store.getUser());
      setProfileState(store.getProfile());
    };
    loadData();
  }, []);

  const addModule = (module: Module) => {
    store.addModule(module);
    setModules([...store.getModules()]);
  };

  const deleteModule = (id: string) => {
    store.deleteModule(id);
    setModules([...store.getModules()]);
    setFiles([...store.getFiles()]);
    setAssessments([...store.getAssessments()]);
  };

  const addAssessment = (assessment: Assessment) => {
    store.addAssessment(assessment);
    setAssessments([...store.getAssessments()]);
  };

  const updateAssessment = (id: string, updates: Partial<Assessment>) => {
    store.updateAssessment(id, updates);
    setAssessments([...store.getAssessments()]);
  };

  const addFile = (file: FileItem) => {
    store.addFile(file);
    setFiles([...store.getFiles()]);
    setModules([...store.getModules()]);
  };

  const deleteFile = (id: string) => {
    store.deleteFile(id);
    setFiles([...store.getFiles()]);
    setModules([...store.getModules()]);
  };

  const addScheduleItem = (item: ScheduleItem) => {
    store.addScheduleItem(item);
    setSchedule([...store.getSchedule()]);
  };

  const deleteScheduleItem = (id: string) => {
    store.deleteScheduleItem(id);
    setSchedule([...store.getSchedule()]);
  };

  const addAttendance = (record: AttendanceRecord) => {
    store.addAttendance(record);
    setAttendance([...store.getAttendance()]);
  };

  const setUser = (user: User) => {
    store.setUser(user);
    setUserState(user);
  };

  const setProfile = (profile: UserProfile) => {
    store.setProfile(profile);
    setProfileState(profile);
  };

  const clearAllData = () => {
    store.clearAllData();
    setModules([]);
    setAssessments([]);
    setFiles([]);
    setSchedule([]);
    setAttendance([]);
    setUserState(null);
    setProfileState(null);
  };

  return (
    <StoreContext.Provider
      value={{
        modules,
        assessments,
        files,
        schedule,
        attendance,
        user,
        profile,
        addModule,
        deleteModule,
        addAssessment,
        updateAssessment,
        addFile,
        deleteFile,
        addScheduleItem,
        deleteScheduleItem,
        addAttendance,
        setUser,
        setProfile,
        clearAllData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
