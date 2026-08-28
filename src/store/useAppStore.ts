import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { UserSettings, Subject, DriveFile, Note, Task, Appointment, ScheduleItem, Group } from '../types';
import { db } from '../lib/db';

const defaultSettings: UserSettings = {
  name: '',
  university: '',
  college: '',
  enrollmentDate: '',
  totalYears: 4,
  semestersPerYear: 2,
  gradingScale: [
    { id: '1', letter: 'A+', nameAr: 'امتياز مرتفع', nameEn: 'High Distinction', minPercentage: 97, maxPercentage: 100, points: 4.0 },
    { id: '2', letter: 'A', nameAr: 'امتياز', nameEn: 'Distinction', minPercentage: 93, maxPercentage: 96, points: 3.7 },
  ],
  semesters: [],
  theme: 'light',
  language: 'ar',
  initialCumulativeGpa: null,
  initialCompletedCreditHours: null,
  setupMode: 'initial_gpa',
};

export interface AppState {
  userId: string | null;
  isInitialized: boolean;
  settings: UserSettings;
  subjects: Subject[];
  files: DriveFile[];
  notes: Note[];
  tasks: Task[];
  appointments: Appointment[];
  scheduleItems: ScheduleItem[];
  groups: Group[];
  
  initialize: (userId: string) => Promise<void>;
  clearData: () => void;
  
  updateSettings: (settings: Partial<UserSettings>) => void;
  updateTheme: (theme: 'light' | 'dark') => void;
  updateLanguage: (lang: 'ar' | 'en') => void;
  addSubject: (subject: Subject) => void;
  updateSubject: (id: string, subject: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;
  addFile: (file: DriveFile) => void;
  deleteFile: (id: string) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, note: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, task: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addAppointment: (appointment: Appointment) => void;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  addScheduleItem: (item: ScheduleItem) => void;
  updateScheduleItem: (id: string, item: Partial<ScheduleItem>) => void;
  deleteScheduleItem: (id: string) => void;
  addGroup: (group: Group) => void;
  updateGroup: (id: string, group: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  userId: null,
  isInitialized: false,
  settings: defaultSettings,
  subjects: [],
  files: [],
  notes: [],
  tasks: [],
  appointments: [],
  scheduleItems: [],
  groups: [],

  initialize: async (userId: string) => {
    // Fetch all data for the user
    const [
      settingsData,
      subjects,
      tasks,
      notes,
      appointments,
      scheduleItems,
      groups,
      files
    ] = await Promise.all([
      db.getSettings(userId),
      db.getSubjects(userId),
      db.getTasks(userId),
      db.getNotes(userId),
      db.getAppointments(userId),
      db.getScheduleItems(userId),
      db.getGroups(userId),
      db.getDriveFiles(userId)
    ]);

    // Groups Initialization
    let finalGroups = groups;
    const isGroupsInitialized = localStorage.getItem(`unistudent_groups_initialized_${userId}`);
    if (!isGroupsInitialized && groups.length === 0) {
      const defaultGroups: Group[] = [
        { id: uuidv4(), name: 'Study', color: 'indigo' },
        { id: uuidv4(), name: 'Work', color: 'emerald' },
        { id: uuidv4(), name: 'Personal', color: 'amber' }
      ];
      finalGroups = defaultGroups;
      for (const g of defaultGroups) {
        db.addGroup(userId, g).catch(console.error);
      }
      localStorage.setItem(`unistudent_groups_initialized_${userId}`, 'true');
    }

    set({
      userId,
      isInitialized: true,
      settings: settingsData ? { ...defaultSettings, ...settingsData } : defaultSettings,
      subjects,
      tasks,
      notes,
      appointments,
      scheduleItems,
      groups: finalGroups,
      files
    });
  },

  clearData: () => {
    set({
      userId: null,
      isInitialized: false,
      settings: defaultSettings,
      subjects: [],
      files: [],
      notes: [],
      tasks: [],
      appointments: [],
      scheduleItems: [],
      groups: []
    });
  },

  // Settings
  updateSettings: (newSettings) => {
    const { userId, settings } = get();
    if (!userId) return;
    const updated = { ...settings, ...newSettings };
    set({ settings: updated });
    db.upsertSettings(userId, updated);
  },
  updateTheme: (theme) => {
    const { userId, settings } = get();
    if (!userId) return;
    set({ settings: { ...settings, theme } });
    db.upsertSettings(userId, { theme });
  },
  updateLanguage: (language) => {
    const { userId, settings } = get();
    if (!userId) return;
    set({ settings: { ...settings, language } });
    db.upsertSettings(userId, { language });
  },

  // Subjects
  addSubject: (subject) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ subjects: [...state.subjects, subject] }));
    db.addSubject(userId, subject);
  },
  updateSubject: (id, updatedFields) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ subjects: state.subjects.map(s => s.id === id ? { ...s, ...updatedFields } : s) }));
    db.updateSubject(userId, id, updatedFields);
  },
  deleteSubject: (id) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ subjects: state.subjects.filter(s => s.id !== id) }));
    db.deleteSubject(userId, id);
  },

  // Files
  addFile: (file) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ files: [...state.files, file] }));
    db.addDriveFile(userId, file);
  },
  deleteFile: (id) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ files: state.files.filter(f => f.id !== id) }));
    db.deleteDriveFile(userId, id);
  },

  // Notes
  addNote: (note) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ notes: [...state.notes, note] }));
    db.addNote(userId, note);
  },
  updateNote: (id, updatedFields) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ notes: state.notes.map(n => n.id === id ? { ...n, ...updatedFields } : n) }));
    db.updateNote(userId, id, updatedFields);
  },
  deleteNote: (id) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ notes: state.notes.filter(n => n.id !== id) }));
    db.deleteNote(userId, id);
  },

  // Tasks
  addTask: (task) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ tasks: [...state.tasks, task] }));
    db.addTask(userId, task);
  },
  updateTask: (id, updatedFields) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ tasks: state.tasks.map(t => t.id === id ? { ...t, ...updatedFields } : t) }));
    db.updateTask(userId, id, updatedFields);
  },
  deleteTask: (id) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ tasks: state.tasks.filter(t => t.id !== id) }));
    db.deleteTask(userId, id);
  },

  // Appointments
  addAppointment: (appointment) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ appointments: [...state.appointments, appointment] }));
    db.addAppointment(userId, appointment);
  },
  updateAppointment: (id, updatedFields) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ appointments: state.appointments.map(a => a.id === id ? { ...a, ...updatedFields } : a) }));
    db.updateAppointment(userId, id, updatedFields);
  },
  deleteAppointment: (id) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ appointments: state.appointments.filter(a => a.id !== id) }));
    db.deleteAppointment(userId, id);
  },

  // Schedule Items
  addScheduleItem: (item) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ scheduleItems: [...state.scheduleItems, item] }));
    db.addScheduleItem(userId, item);
  },
  updateScheduleItem: (id, updatedFields) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ scheduleItems: state.scheduleItems.map(s => s.id === id ? { ...s, ...updatedFields } : s) }));
    db.updateScheduleItem(userId, id, updatedFields);
  },
  deleteScheduleItem: (id) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ scheduleItems: state.scheduleItems.filter(s => s.id !== id) }));
    db.deleteScheduleItem(userId, id);
  },

  // Groups
  addGroup: (group) => {
    const { userId } = get();
    if (!userId) return;
    localStorage.setItem(`unistudent_groups_initialized_${userId}`, 'true');
    set((state) => ({ groups: [...state.groups, group] }));
    db.addGroup(userId, group);
  },
  updateGroup: (id, updatedFields) => {
    const { userId, groups } = get();
    if (!userId) return;
    set({ groups: groups.map(g => g.id === id ? { ...g, ...updatedFields } : g) });
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) {
      db.updateGroup(userId, id, updatedFields).catch(console.error);
    }
  },
  deleteGroup: async (id) => {
    const { userId, groups } = get();
    if (!userId) return;
    localStorage.setItem(`unistudent_groups_initialized_${userId}`, 'true');
    const previousGroups = groups;
    set({ groups: groups.filter(g => g.id !== id) });
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) {
      try {
        await db.deleteGroup(userId, id);
      } catch (e) {
        console.error('Failed to delete group in DB:', e);
        set({ groups: previousGroups });
        alert('حدث خطأ أثناء حذف المجموعة. يرجى المحاولة لاحقاً.');
      }
    }
  }
}));
