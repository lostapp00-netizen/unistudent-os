import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { UserSettings, Subject, DriveFile, Note, Task, Appointment, ScheduleItem, Group, GraduationGradeRule } from '../types';
import { db } from '../lib/db';

const getInitialTheme = (): 'light' | 'dark' => {
  try {
    const saved = localStorage.getItem('unistudent_theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {}
  return 'light';
};

const getInitialLang = (): 'ar' | 'en' => {
  try {
    const saved = localStorage.getItem('unistudent_lang');
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {}
  return 'en';
};

export const defaultGraduationScale: GraduationGradeRule[] = [
  { id: '1', letter: 'A+', nameAr: 'ممتاز مع مرتبة الشرف', nameEn: 'Excellent with High Honors', minPercentage: 95, maxPercentage: 100, minGpa: 3.75, maxGpa: 4.0, gpaOperator: '<=' },
  { id: '2', letter: 'A', nameAr: 'ممتاز', nameEn: 'Excellent', minPercentage: 85, maxPercentage: 94.99, maxOperator: '<', minGpa: 3.50, maxGpa: 3.74, gpaOperator: '<' },
  { id: '3', letter: 'B+', nameAr: 'جيد جداً مرتفع', nameEn: 'Very Good High', minPercentage: 80, maxPercentage: 84.99, maxOperator: '<', minGpa: 3.00, maxGpa: 3.49, gpaOperator: '<' },
  { id: '4', letter: 'B', nameAr: 'جيد جداً', nameEn: 'Very Good', minPercentage: 75, maxPercentage: 79.99, maxOperator: '<', minGpa: 2.50, maxGpa: 2.99, gpaOperator: '<' },
  { id: '5', letter: 'C', nameAr: 'جيد', nameEn: 'Good', minPercentage: 65, maxPercentage: 74.99, maxOperator: '<', minGpa: 2.00, maxGpa: 2.49, gpaOperator: '<' },
  { id: '6', letter: 'D', nameAr: 'مقبول', nameEn: 'Pass', minPercentage: 50, maxPercentage: 64.99, maxOperator: '<', minGpa: 1.50, maxGpa: 1.99, gpaOperator: '<' },
  { id: '7', letter: 'F', nameAr: 'راسب', nameEn: 'Fail', minPercentage: 0, maxPercentage: 49.99, maxOperator: '<', minGpa: 0.00, maxGpa: 1.49, gpaOperator: '<' },
];

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
  theme: getInitialTheme(),
  language: getInitialLang(),
  initialCumulativeGpa: null,
  initialCompletedCreditHours: null,
  setupMode: 'initial_gpa',
  warningGradeLetter: 'C',
  warningGpaPoints: 2.0,
  enableGraduationScale: false,
  graduationGradingScale: defaultGraduationScale,
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
  
  userEmail: string | null;
  initialize: (userId: string, email?: string) => Promise<void>;
  clearData: () => void;
  
  updateSettings: (settings: Partial<UserSettings>) => void;
  updateTheme: (theme: 'light' | 'dark') => void;
  updateLanguage: (lang: 'ar' | 'en') => void;
  addSubject: (subject: Subject) => void;
  updateSubject: (id: string, subject: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;
  addFile: (file: DriveFile) => void;
  updateFile: (id: string, file: Partial<DriveFile>) => void;
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
  importFromUniversityDatabase: (universityDbId: string, options?: { importDrive?: boolean }) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  userId: null,
  userEmail: null,
  isInitialized: false,
  settings: defaultSettings,
  subjects: [],
  files: [],
  notes: [],
  tasks: [],
  appointments: [],
  scheduleItems: [],
  groups: [],

  initialize: async (userId: string, email?: string) => {
    try {
      if (email) {
        try {
          localStorage.setItem(`unistudent_user_email_${userId}`, email);
        } catch {}
      }

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
        db.getSettings(userId).catch(() => null),
        db.getSubjects(userId).catch(() => []),
        db.getTasks(userId).catch(() => []),
        db.getNotes(userId).catch(() => []),
        db.getAppointments(userId).catch(() => []),
        db.getScheduleItems(userId).catch(() => []),
        db.getGroups(userId).catch(() => []),
        db.getDriveFiles(userId).catch(() => [])
      ]);

      // Groups Initialization
      let finalGroups = groups || [];
      const isNewUser = !settingsData && (!groups || groups.length === 0);
      const isGroupsInitialized = localStorage.getItem(`unistudent_groups_initialized_${userId}`);
      if (isNewUser && !isGroupsInitialized) {
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
      } else {
        localStorage.setItem(`unistudent_groups_initialized_${userId}`, 'true');
      }

      const mergedSettings: UserSettings = settingsData 
        ? { ...defaultSettings, ...settingsData, email: email || settingsData.email }
        : { ...defaultSettings, email: email || '' };

      if (email && (!settingsData?.email || settingsData.email !== email)) {
        db.upsertSettings(userId, { email }).catch(() => {});
      }

      try {
        const knownRaw = localStorage.getItem('unistudent_known_users');
        const knownList: any[] = knownRaw ? JSON.parse(knownRaw) : [];
        const userProfile = {
          id: userId,
          email: email || mergedSettings.email,
          name: mergedSettings.name,
          university: mergedSettings.university,
          college: mergedSettings.college,
          gradingScale: mergedSettings.gradingScale,
          semesters: mergedSettings.semesters,
          lastSeen: new Date().toISOString()
        };
        const existingIdx = knownList.findIndex((u: any) => u.id === userId);
        if (existingIdx >= 0) {
          knownList[existingIdx] = userProfile;
        } else {
          knownList.push(userProfile);
        }
        localStorage.setItem('unistudent_known_users', JSON.stringify(knownList));
      } catch {}

      set({
        userId,
        userEmail: email || null,
        isInitialized: true,
        settings: mergedSettings,
        subjects: subjects || [],
        tasks: tasks || [],
        notes: notes || [],
        appointments: appointments || [],
        scheduleItems: scheduleItems || [],
        groups: finalGroups,
        files: files || []
      });
    } catch (err) {
      console.error('Error during initialize:', err);
      set({
        userId,
        userEmail: email || null,
        isInitialized: true
      });
    }
  },

  clearData: () => {
    set({
      userId: null,
      userEmail: null,
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
    const updated = { ...settings, ...newSettings };
    set({ settings: updated });
    if (userId) {
      db.upsertSettings(userId, updated);
    }
  },
  updateTheme: (theme) => {
    const { userId, settings } = get();
    set({ settings: { ...settings, theme } });
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('unistudent_theme', theme);
    } catch {}
    if (userId) {
      db.upsertSettings(userId, { theme });
    }
  },
  updateLanguage: (language) => {
    const { userId, settings } = get();
    set({ settings: { ...settings, language } });
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    try {
      localStorage.setItem('unistudent_lang', language);
    } catch {}
    if (userId) {
      db.upsertSettings(userId, { language });
    }
  },

  // Subjects
  addSubject: (subject) => {
    const { userId, userEmail, settings } = get();
    if (!userId) return;
    const finalSubject: Subject = {
      ...subject,
      code: subject.code?.trim() || `SUB-${Math.floor(100 + Math.random() * 900)}`,
      distributions: subject.distributions || [],
      includeInGpa: subject.includeInGpa !== false
    };
    set((state) => ({ subjects: [...state.subjects.filter(s => s.id !== finalSubject.id), finalSubject] }));
    db.addSubject(userId, finalSubject);

    // If student is source for university DB, notify admin
    checkAndNotifySourceUpdate(userId, userEmail, settings.name, 'add_subject', `إضافة مادة جديدة: ${finalSubject.name}`, finalSubject);
  },
  updateSubject: (id, updatedFields) => {
    const { userId, userEmail, settings, subjects } = get();
    if (!userId) return;
    const old = subjects.find(s => s.id === id);
    set((state) => ({ subjects: state.subjects.map(s => s.id === id ? { ...s, ...updatedFields } : s) }));
    db.updateSubject(userId, id, updatedFields);

    if (old) {
      checkAndNotifySourceUpdate(userId, userEmail, settings.name, 'update_subject', `تعديل مادة: ${old.name}`, { id, ...updatedFields });
    }
  },
  deleteSubject: (id) => {
    const { userId, userEmail, settings, subjects } = get();
    if (!userId) return;
    const old = subjects.find(s => s.id === id);
    set((state) => ({ subjects: state.subjects.filter(s => s.id !== id) }));
    db.deleteSubject(userId, id);

    if (old) {
      checkAndNotifySourceUpdate(userId, userEmail, settings.name, 'delete_subject', `حذف مادة: ${old.name}`, { id, name: old.name });
    }
  },

  // Files
  addFile: (file) => {
    const { userId, userEmail, settings } = get();
    if (!userId) return;
    set((state) => ({ files: [...state.files, file] }));
    db.addDriveFile(userId, file);

    checkAndNotifySourceUpdate(userId, userEmail, settings.name, 'add_file', `رفع ملف إلى الدرايف: ${file.name}`, file);
  },
  updateFile: (id, updatedFields) => {
    const { userId } = get();
    if (!userId) return;
    set((state) => ({ files: state.files.map(f => f.id === id ? { ...f, ...updatedFields } : f) }));
    db.updateDriveFile(userId, id, updatedFields);
  },
  deleteFile: (id) => {
    const { userId, files, userEmail, settings } = get();
    if (!userId) return;
    const target = files.find(f => f.id === id);
    if (target) {
      import('../lib/backblaze').then(({ deleteFromB2, extractB2KeyFromUrl }) => {
        const key = target.b2FileId || extractB2KeyFromUrl(target.url);
        if (key) {
          deleteFromB2(key).catch(console.error);
        }
      }).catch(console.error);

      checkAndNotifySourceUpdate(userId, userEmail, settings.name, 'delete_file', `حذف ملف من الدرايف: ${target.name}`, { id, name: target.name });
    }
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
    const { userId, notes } = get();
    if (!userId) return;
    if (updatedFields.attachments) {
      const current = notes.find(n => n.id === id);
      if (current?.attachments?.length) {
        const newIds = new Set((updatedFields.attachments || []).map(a => a.id));
        const removed = current.attachments.filter(a => !newIds.has(a.id));
        if (removed.length > 0) {
          import('../lib/backblaze').then(({ deleteMultipleFromB2, extractB2KeyFromUrl }) => {
            const keys = removed.map(a => a.b2FileId || (a as any).b2_file_id || extractB2KeyFromUrl(a.url)).filter(Boolean);
            deleteMultipleFromB2(keys).catch(console.error);
          }).catch(console.error);
        }
      }
    }
    set((state) => ({ notes: state.notes.map(n => n.id === id ? { ...n, ...updatedFields } : n) }));
    db.updateNote(userId, id, updatedFields);
  },
  deleteNote: (id) => {
    const { userId, notes } = get();
    if (!userId) return;
    const target = notes.find(n => n.id === id);
    if (target?.attachments?.length) {
      import('../lib/backblaze').then(({ deleteMultipleFromB2, extractB2KeyFromUrl }) => {
        const keys = target.attachments!.map(a => a.b2FileId || (a as any).b2_file_id || extractB2KeyFromUrl(a.url)).filter(Boolean);
        deleteMultipleFromB2(keys).catch(console.error);
      }).catch(console.error);
    }
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
    const { userId, tasks } = get();
    if (!userId) return;
    if (updatedFields.attachments) {
      const current = tasks.find(t => t.id === id);
      if (current?.attachments?.length) {
        const newIds = new Set((updatedFields.attachments || []).map(a => a.id));
        const removed = current.attachments.filter(a => !newIds.has(a.id));
        if (removed.length > 0) {
          import('../lib/backblaze').then(({ deleteMultipleFromB2, extractB2KeyFromUrl }) => {
            const keys = removed.map(a => a.b2FileId || (a as any).b2_file_id || extractB2KeyFromUrl(a.url)).filter(Boolean);
            deleteMultipleFromB2(keys).catch(console.error);
          }).catch(console.error);
        }
      }
    }
    set((state) => ({ tasks: state.tasks.map(t => t.id === id ? { ...t, ...updatedFields } : t) }));
    db.updateTask(userId, id, updatedFields);
  },
  deleteTask: (id) => {
    const { userId, tasks } = get();
    if (!userId) return;
    const target = tasks.find(t => t.id === id);
    if (target?.attachments?.length) {
      import('../lib/backblaze').then(({ deleteMultipleFromB2, extractB2KeyFromUrl }) => {
        const keys = target.attachments!.map(a => a.b2FileId || (a as any).b2_file_id || extractB2KeyFromUrl(a.url)).filter(Boolean);
        deleteMultipleFromB2(keys).catch(console.error);
      }).catch(console.error);
    }
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
    const { userId, appointments } = get();
    if (!userId) return;
    if (updatedFields.attachments) {
      const current = appointments.find(a => a.id === id);
      if (current?.attachments?.length) {
        const newIds = new Set((updatedFields.attachments || []).map(a => a.id));
        const removed = current.attachments.filter(a => !newIds.has(a.id));
        if (removed.length > 0) {
          import('../lib/backblaze').then(({ deleteMultipleFromB2, extractB2KeyFromUrl }) => {
            const keys = removed.map(a => a.b2FileId || (a as any).b2_file_id || extractB2KeyFromUrl(a.url)).filter(Boolean);
            deleteMultipleFromB2(keys).catch(console.error);
          }).catch(console.error);
        }
      }
    }
    set((state) => ({ appointments: state.appointments.map(a => a.id === id ? { ...a, ...updatedFields } : a) }));
    db.updateAppointment(userId, id, updatedFields);
  },
  deleteAppointment: (id) => {
    const { userId, appointments } = get();
    if (!userId) return;
    const target = appointments.find(a => a.id === id);
    if (target?.attachments?.length) {
      import('../lib/backblaze').then(({ deleteMultipleFromB2, extractB2KeyFromUrl }) => {
        const keys = target.attachments!.map(a => a.b2FileId || (a as any).b2_file_id || extractB2KeyFromUrl(a.url)).filter(Boolean);
        deleteMultipleFromB2(keys).catch(console.error);
      }).catch(console.error);
    }
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
    const { userId, scheduleItems } = get();
    if (!userId) return;
    if (updatedFields.attachments) {
      const current = scheduleItems.find(s => s.id === id);
      if (current?.attachments?.length) {
        const newIds = new Set((updatedFields.attachments || []).map(a => a.id));
        const removed = current.attachments.filter(a => !newIds.has(a.id));
        if (removed.length > 0) {
          import('../lib/backblaze').then(({ deleteMultipleFromB2, extractB2KeyFromUrl }) => {
            const keys = removed.map(a => a.b2FileId || (a as any).b2_file_id || extractB2KeyFromUrl(a.url)).filter(Boolean);
            deleteMultipleFromB2(keys).catch(console.error);
          }).catch(console.error);
        }
      }
    }
    set((state) => ({ scheduleItems: state.scheduleItems.map(s => s.id === id ? { ...s, ...updatedFields } : s) }));
    db.updateScheduleItem(userId, id, updatedFields);
  },
  deleteScheduleItem: (id) => {
    const { userId, scheduleItems } = get();
    if (!userId) return;
    const target = scheduleItems.find(s => s.id === id);
    if (target?.attachments?.length) {
      import('../lib/backblaze').then(({ deleteMultipleFromB2, extractB2KeyFromUrl }) => {
        const keys = target.attachments!.map(a => a.b2FileId || (a as any).b2_file_id || extractB2KeyFromUrl(a.url)).filter(Boolean);
        deleteMultipleFromB2(keys).catch(console.error);
      }).catch(console.error);
    }
    set((state) => ({ scheduleItems: state.scheduleItems.filter(s => s.id !== id) }));
    db.deleteScheduleItem(userId, id);
  },

  // Groups
  addGroup: async (group) => {
    const { userId } = get();
    if (!userId) return;
    localStorage.setItem(`unistudent_groups_initialized_${userId}`, 'true');
    set((state) => ({ groups: [...state.groups, group] }));
    try {
      await db.addGroup(userId, group);
    } catch (e) {
      console.error('Failed to add group:', e);
    }
  },
  updateGroup: async (id, updatedFields) => {
    const { userId, groups } = get();
    if (!userId) return;
    set({ groups: groups.map(g => g.id === id ? { ...g, ...updatedFields } : g) });
    try {
      await db.updateGroup(userId, id, updatedFields);
    } catch (e) {
      console.error('Failed to update group:', e);
    }
  },
  deleteGroup: async (id) => {
    const { userId, groups, tasks, notes, appointments, scheduleItems } = get();
    if (!userId) return;
    localStorage.setItem(`unistudent_groups_initialized_${userId}`, 'true');
    const previousGroups = groups;
    
    // Update local state and unbind from entities
    set({
      groups: groups.filter(g => g.id !== id),
      tasks: tasks.map(t => t.groupId === id ? { ...t, groupId: undefined } : t),
      notes: notes.map(n => n.groupId === id ? { ...n, groupId: undefined } : n),
      appointments: appointments.map(a => a.groupId === id ? { ...a, groupId: undefined } : a),
      scheduleItems: scheduleItems.map(s => s.groupId === id ? { ...s, groupId: undefined } : s)
    });
    
    try {
      await db.deleteGroup(userId, id);
    } catch (e) {
      console.error('Failed to delete group in DB:', e);
      set({ groups: previousGroups });
      alert('حدث خطأ أثناء حذف المجموعة. يرجى المحاولة لاحقاً.');
    }
  },

  // University Database Import
  importFromUniversityDatabase: async (universityDbId: string, options?: { importDrive?: boolean }) => {
    const { userId, settings } = get();
    if (!userId) return;

    const udb = await db.getUniversityDatabase(universityDbId);
    if (!udb) throw new Error('قاعدة بيانات الجامعة غير موجودة');

    const isAr = settings.language === 'ar';
    const chosenUni = isAr ? (udb.universityNameAr || udb.universityNameEn) : (udb.universityNameEn || udb.universityNameAr);
    const chosenCollege = isAr ? (udb.collegeNameAr || udb.collegeNameEn) : (udb.collegeNameEn || udb.collegeNameAr);

    // 1. Update Settings
    const updatedSettings: Partial<UserSettings> = {
      university: chosenUni,
      college: chosenCollege,
      totalYears: udb.totalYears || 4,
      semestersPerYear: udb.semestersPerYear || 2,
      universityDatabaseId: udb.id,
      gradingScale: udb.gradingScale && udb.gradingScale.length > 0 ? udb.gradingScale : settings.gradingScale
    };

    // Generate basic semesters if needed
    if (!settings.semesters || settings.semesters.length === 0) {
      const newSemesters: any[] = [];
      for (let y = 1; y <= (udb.totalYears || 4); y++) {
        for (let s = 1; s <= (udb.semestersPerYear || 2); s++) {
          newSemesters.push({
            id: uuidv4(),
            yearIndex: y,
            semesterIndex: s,
            startDate: '',
            endDate: '',
            isCurrent: y === 1 && s === 1
          });
        }
      }
      updatedSettings.semesters = newSemesters;
    }

    set(state => ({ settings: { ...state.settings, ...updatedSettings } }));
    db.upsertSettings(userId, updatedSettings).catch(console.error);

    // 2. Clone and import Subjects
    if (udb.subjects && udb.subjects.length > 0) {
      const importedSubjects: Subject[] = udb.subjects.map(s => ({
        id: uuidv4(),
        code: s.code || `SUB-${Math.floor(100 + Math.random() * 900)}`,
        name: s.name,
        creditHours: Number(s.creditHours || 3),
        totalMarks: Number(s.totalMarks || 100),
        yearIndex: Number(s.yearIndex || 1),
        semesterIndex: Number(s.semesterIndex || 1),
        distributions: (s.distributions || []).map((d: any) => ({
          id: uuidv4(),
          name: d.name,
          maxMarks: Number(d.maxMarks || 0),
          achievedMarks: null,
          status: 'current'
        })),
        status: s.status || 'current',
        includeInGpa: s.includeInGpa !== false
      }));

      for (const subj of importedSubjects) {
        db.addSubject(userId, subj).catch(console.error);
      }
      set(state => ({
        subjects: [...state.subjects, ...importedSubjects]
      }));
    }

    // 3. Clone and import Drive Files
    if (options?.importDrive !== false && udb.driveFiles && udb.driveFiles.length > 0) {
      const idMap = new Map<string, string>();
      const clonedFiles: DriveFile[] = [];
      const sortedFiles = [...udb.driveFiles].sort((a, b) => (a.type === 'folder' ? -1 : 1));

      for (const file of sortedFiles) {
        const newId = uuidv4();
        idMap.set(file.id, newId);
        const newParentId = file.parentId ? idMap.get(file.parentId) || null : null;

        const cloned: DriveFile = {
          id: newId,
          name: file.name,
          size: file.size,
          type: file.type,
          parentId: newParentId,
          createdAt: new Date().toISOString(),
          url: file.url,
          b2FileId: file.b2FileId
        };
        clonedFiles.push(cloned);
        db.addDriveFile(userId, cloned).catch(console.error);
      }

      set(state => ({
        files: [...state.files, ...clonedFiles]
      }));
    }
  }
}));

async function checkAndNotifySourceUpdate(
  userId: string,
  userEmail: string | null,
  userName: string | undefined,
  type: 'add_subject' | 'update_subject' | 'delete_subject' | 'add_file' | 'delete_file',
  description: string,
  data: any
) {
  try {
    const uniDbs = await db.getUniversityDatabases();
    const matchingDb = uniDbs.find(u => u.sourceUserId === userId);
    if (matchingDb) {
      await db.recordPendingUpdate({
        id: uuidv4(),
        universityDatabaseId: matchingDb.id,
        universityName: matchingDb.universityNameAr || matchingDb.universityNameEn,
        collegeName: matchingDb.collegeNameAr || matchingDb.collegeNameEn,
        sourceUserId: userId,
        sourceUserEmail: userEmail || '',
        sourceUserName: userName || '',
        type,
        description,
        data,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn('Error in checkAndNotifySourceUpdate:', e);
  }
}
