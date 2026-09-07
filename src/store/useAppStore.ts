import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { UserSettings, Subject, DriveFile, Note, Task, Appointment, ScheduleItem, Group, GraduationGradeRule, GradeRule, UniversityDatabase } from '../types';
import { db } from '../lib/db';
import { normalizeSubjectName } from '../lib/academicTranslation';

let activeSyncPromise: Promise<void> | null = null;
let isImportInProgress = false;

export function deduplicateSubjects(subjectsList: Subject[]): { clean: Subject[]; duplicatesToRemove: Subject[] } {
  const seen = new Map<string, Subject>();
  const duplicatesToRemove: Subject[] = [];

  for (const s of subjectsList) {
    const normName = normalizeSubjectName(s.name);
    if (!normName) continue;
    const y = Number(s.yearIndex !== undefined && s.yearIndex !== null ? s.yearIndex : 1);
    const sem = Number(s.semesterIndex !== undefined && s.semesterIndex !== null ? s.semesterIndex : 1);
    const key = `${normName}_${y}_${sem}`;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, s);
    } else {
      // Prioritize the subject that has achieved marks or higher progress
      const sMarksCount = (s.distributions || []).filter(d => d.achievedMarks !== null && d.achievedMarks !== undefined && Number(d.achievedMarks) > 0).length;
      const exMarksCount = (existing.distributions || []).filter(d => d.achievedMarks !== null && d.achievedMarks !== undefined && Number(d.achievedMarks) > 0).length;

      if (sMarksCount > exMarksCount) {
        duplicatesToRemove.push(existing);
        seen.set(key, s);
      } else {
        duplicatesToRemove.push(s);
      }
    }
  }

  return {
    clean: Array.from(seen.values()),
    duplicatesToRemove
  };
}

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
  specialization: '',
  specializationStartYear: undefined,
  specializationStartSemester: undefined,
  specializationDatabaseId: undefined,
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
  refreshSubjects: () => Promise<void>;
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
  importFromUniversityDatabase: (universityDbId: string, options?: { importDrive?: boolean; specializationDbId?: string }) => Promise<void>;
  unlinkUniversityDatabase: () => Promise<void>;
  syncWithUniversityDatabase: () => Promise<void>;
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

      // Auto-deduplicate any pre-existing duplicate subjects from previous sync bugs
      let finalSubjects = subjects || [];
      const dedupResult = deduplicateSubjects(finalSubjects);
      if (dedupResult.duplicatesToRemove.length > 0) {
        finalSubjects = dedupResult.clean;
        for (const dup of dedupResult.duplicatesToRemove) {
          db.deleteSubject(userId, dup.id).catch(() => {});
        }
      }

      try {
        let uniDbId = mergedSettings.universityDatabaseId;
        if (!uniDbId) {
          try {
            const savedRaw = localStorage.getItem(`unistudent_settings_${userId}`);
            if (savedRaw) {
              const parsed = JSON.parse(savedRaw);
              if (parsed.universityDatabaseId) {
                uniDbId = parsed.universityDatabaseId;
                mergedSettings.universityDatabaseId = uniDbId;
              }
            }
          } catch {}
        }

        if (!uniDbId && mergedSettings.university && mergedSettings.college && mergedSettings.university !== 'غير محدد') {
          const allDbs = await db.getUniversityDatabases();
          const autoMatched = allDbs.find(d => 
            (normalizeSubjectName(d.universityNameAr) === normalizeSubjectName(mergedSettings.university) || normalizeSubjectName(d.universityNameEn) === normalizeSubjectName(mergedSettings.university)) &&
            (normalizeSubjectName(d.collegeNameAr) === normalizeSubjectName(mergedSettings.college) || normalizeSubjectName(d.collegeNameEn) === normalizeSubjectName(mergedSettings.college))
          );
          if (autoMatched) {
            uniDbId = autoMatched.id;
            mergedSettings.universityDatabaseId = autoMatched.id;
            db.upsertSettings(userId, { universityDatabaseId: autoMatched.id }).catch(() => {});
          }
        }

        if (uniDbId && mergedSettings.specialization && !mergedSettings.specializationDatabaseId) {
          const allDbs = await db.getUniversityDatabases();
          const specMatched = allDbs.find(d => 
            d.isSpecialization && 
            (d.parentDatabaseId === uniDbId || normalizeSubjectName(d.collegeNameAr) === normalizeSubjectName(mergedSettings.college)) &&
            (normalizeSubjectName(d.specializationNameAr) === normalizeSubjectName(mergedSettings.specialization) || normalizeSubjectName(d.specializationNameEn) === normalizeSubjectName(mergedSettings.specialization))
          );
          if (specMatched) {
            mergedSettings.specializationDatabaseId = specMatched.id;
            db.upsertSettings(userId, { specializationDatabaseId: specMatched.id }).catch(() => {});
          }
        }
      } catch (e) {
        console.warn('Silent uni resolve in initialize error:', e);
      }

      set({
        userId,
        userEmail: email || null,
        isInitialized: false,
        settings: mergedSettings,
        subjects: finalSubjects,
        tasks: tasks || [],
        notes: notes || [],
        appointments: appointments || [],
        scheduleItems: scheduleItems || [],
        groups: finalGroups,
        files: files || []
      });

      // Pre-sync with university database BEFORE marking initialized so the UI displays up-to-date data on the first frame
      if (mergedSettings.universityDatabaseId || (mergedSettings.university && mergedSettings.college && mergedSettings.university !== 'غير محدد')) {
        try {
          await Promise.race([
            get().syncWithUniversityDatabase(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 2500))
          ]);
        } catch (e) {
          console.warn('Initial university pre-sync completed or timed out:', e);
        }
      }

      set({ isInitialized: true });
    } catch (err) {
      console.error('Error during initialize:', err);
      set({
        userId,
        userEmail: email || null,
        isInitialized: true
      });
    }
  },

  // Refresh just the academic catalogue. This is used for restored shared
  // databases so approved source changes reach subscribers without a logout.
  refreshSubjects: async () => {
    const { userId } = get();
    if (!userId) return;

    try {
      const subjects = await db.getSubjects(userId);
      set({ subjects: subjects || [] });
    } catch (err) {
      console.warn('Error refreshing shared subjects:', err);
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

  addSubject: (subject) => {
    const { userId, userEmail, settings } = get();
    if (!userId) return;
    const finalSubject: Subject = {
      ...subject,
      code: (subject.code || '').trim(),
      distributions: subject.distributions || [],
      includeInGpa: subject.includeInGpa !== false
    };
    set((state) => ({ subjects: [...state.subjects.filter(s => s.id !== finalSubject.id), finalSubject] }));
    db.addSubject(userId, finalSubject);

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
      const deletedName = old.name.trim().toLowerCase();
      const currentDeleted = settings.deletedSubjectNames || [];
      if (!currentDeleted.includes(deletedName)) {
        const updatedDeleted = [...currentDeleted, deletedName];
        set(state => ({ settings: { ...state.settings, deletedSubjectNames: updatedDeleted } }));
        db.upsertSettings(userId, { deletedSubjectNames: updatedDeleted }).catch(() => {});
      }
      checkAndNotifySourceUpdate(userId, userEmail, settings.name, 'delete_subject', `حذف مادة: ${old.name}`, { id, name: old.name });
    }
  },

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

  importFromUniversityDatabase: async (universityDbId: string, options?: { importDrive?: boolean; specializationDbId?: string }) => {
    const { userId, settings } = get();
    if (!userId) return;

    if (isImportInProgress) return;
    isImportInProgress = true;

    try {
      const udb = await db.getUniversityDatabase(universityDbId);
      if (!udb) throw new Error('قاعدة بيانات الجامعة غير موجودة');

      let parentDb: UniversityDatabase | null = null;
      let specDb: UniversityDatabase | null = null;
      let mainCollegeDb: UniversityDatabase = udb;

      if (udb.isSpecialization) {
        specDb = udb;
        if (udb.parentDatabaseId) {
          parentDb = await db.getUniversityDatabase(udb.parentDatabaseId);
          if (parentDb) {
            mainCollegeDb = parentDb;
          }
        }
      } else if (options?.specializationDbId) {
        specDb = await db.getUniversityDatabase(options.specializationDbId);
      }

      const isAr = settings.language === 'ar';
      const chosenUni = isAr 
        ? (mainCollegeDb.universityNameAr || mainCollegeDb.universityNameEn) 
        : (mainCollegeDb.universityNameEn || mainCollegeDb.universityNameAr);
      const chosenCollege = isAr 
        ? (mainCollegeDb.collegeNameAr || mainCollegeDb.collegeNameEn) 
        : (mainCollegeDb.collegeNameEn || mainCollegeDb.collegeNameAr);

      const effectiveGradingScale = (specDb?.gradingScale && specDb.gradingScale.length > 0)
        ? specDb.gradingScale
        : (mainCollegeDb.gradingScale && mainCollegeDb.gradingScale.length > 0 ? mainCollegeDb.gradingScale : settings.gradingScale);

      const updatedSettings: Partial<UserSettings> = {
        university: chosenUni,
        college: chosenCollege,
        totalYears: mainCollegeDb.totalYears || specDb?.totalYears || 4,
        semestersPerYear: mainCollegeDb.semestersPerYear || specDb?.semestersPerYear || 2,
        universityDatabaseId: mainCollegeDb.id,
        deletedSubjectNames: [],
        gradingScale: effectiveGradingScale
      };

      if (specDb) {
        updatedSettings.specialization = specDb.specializationNameAr || specDb.specializationNameEn || '';
        updatedSettings.specializationStartYear = specDb.specializationStartYear || 2;
        updatedSettings.specializationStartSemester = specDb.specializationStartSemester || 1;
        updatedSettings.specializationDatabaseId = specDb.id;
      }

      if (!settings.semesters || settings.semesters.length === 0) {
        const newSemesters: any[] = [];
        const totY = Number(updatedSettings.totalYears || 4);
        const semY = Number(updatedSettings.semestersPerYear || 2);
        for (let y = 1; y <= totY; y++) {
          for (let s = 1; s <= semY; s++) {
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

      // Smart Slicing & Non-Destructive Dual-Database Merging
      let rawCandidateSubjects: Subject[] = [];
      const currentSubjects = get().subjects || [];

      if (specDb) {
        const startYear = Number(specDb.specializationStartYear || 2);
        const startSem = Number(specDb.specializationStartSemester || 1);

        // 1. Preserve existing foundation subjects of the student (before specialization milestone)
        let preservedFoundationSubjs = currentSubjects.filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          return y < startYear || (y === startYear && sem < startSem);
        });

        // If student had no foundation subjects yet, pull them from the parent college database
        if (preservedFoundationSubjs.length === 0 && mainCollegeDb) {
          preservedFoundationSubjs = (mainCollegeDb.subjects || []).filter(s => {
            const y = Number(s.yearIndex || 1);
            const sem = Number(s.semesterIndex || 1);
            return y < startYear || (y === startYear && sem < startSem);
          });
        }

        // 2. Specialized courses from the specialization database
        const specializationSubjs = (specDb.subjects || []).filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          return y > startYear || (y === startYear && sem >= startSem);
        });

        rawCandidateSubjects = [...preservedFoundationSubjs, ...specializationSubjs];
      } else {
        // General College Restore: Restore foundation subjects while PRESERVING any existing specialization courses
        const startYear = Number(mainCollegeDb.specializationStartYear || 2);
        const startSem = Number(mainCollegeDb.specializationStartSemester || 1);

        const existingSpecializationSubjs = currentSubjects.filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          return y > startYear || (y === startYear && sem >= startSem);
        });

        const foundationSubjs = (mainCollegeDb.subjects || []).filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          return y < startYear || (y === startYear && sem < startSem);
        });

        rawCandidateSubjects = [...foundationSubjs, ...existingSpecializationSubjs];
      }

      if (rawCandidateSubjects.length > 0) {
        await db.clearAllSubjects(userId);

        const { clean: dedupedTemplateSubjs } = deduplicateSubjects(rawCandidateSubjects);

        const importedSubjects: Subject[] = dedupedTemplateSubjs.map(s => {
          const y = s.yearIndex !== undefined && s.yearIndex !== null ? s.yearIndex : ((s as any).year_index !== undefined ? (s as any).year_index : 1);
          const sem = s.semesterIndex !== undefined && s.semesterIndex !== null ? s.semesterIndex : ((s as any).semester_index !== undefined ? (s as any).semester_index : 1);
          const hrs = s.creditHours !== undefined && s.creditHours !== null ? s.creditHours : ((s as any).credit_hours !== undefined ? (s as any).credit_hours : 3);
          const marks = s.totalMarks !== undefined && s.totalMarks !== null ? s.totalMarks : ((s as any).total_marks !== undefined ? (s as any).total_marks : 100);

          return {
            id: uuidv4(),
            code: (s.code || '').trim(),
            name: s.name,
            creditHours: Number(hrs || 3),
            totalMarks: Number(marks || 100),
            yearIndex: Number(y || 1),
            semesterIndex: Number(sem || 1),
            distributions: (s.distributions || []).map((d: any) => ({
              id: uuidv4(),
              name: d.name,
              maxMarks: Number(d.maxMarks !== undefined ? d.maxMarks : ((d as any).max_marks !== undefined ? (d as any).max_marks : 0)),
              achievedMarks: null,
              status: 'current' as const
            })),
            status: s.status || 'current',
            includeInGpa: s.includeInGpa !== false && (s as any).include_in_gpa !== false
          };
        });

        set({ subjects: importedSubjects });

        for (const subj of importedSubjects) {
          await db.addSubject(userId, subj);
        }
      }

      // Drive files: Non-destructive append & merge
      if (options?.importDrive !== false) {
        const incomingDriveFiles: DriveFile[] = specDb 
          ? (specDb.driveFiles || [])
          : (mainCollegeDb.driveFiles || []);

        if (incomingDriveFiles.length > 0) {
          const currentDrive = get().files || [];
          const existingNames = new Set(currentDrive.map(f => `${f.name}-${f.type}-${f.parentId || 'root'}`));

          const idMap = new Map<string, string>();
          const clonedFiles: DriveFile[] = [];
          const sortedFiles = [...incomingDriveFiles].sort((a, b) => (a.type === 'folder' ? -1 : 1));

          for (const file of sortedFiles) {
            const signature = `${file.name}-${file.type}-${file.parentId || 'root'}`;
            if (existingNames.has(signature)) continue;

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
            await db.addDriveFile(userId, cloned);
          }

          if (clonedFiles.length > 0) {
            set(state => ({ files: [...state.files, ...clonedFiles] }));
          }
        }
      }
    } finally {
      isImportInProgress = false;
    }
  },

  unlinkUniversityDatabase: async () => {
    const { userId, settings } = get();
    if (!userId) return;

    await db.clearAllSubjects(userId);
    await db.clearAllDriveFiles(userId);

    const defaultScale: GradeRule[] = [
      { id: '1', letter: 'A+', nameAr: 'ممتاز مرتفع', nameEn: 'High Excellent', minPercentage: 90, maxPercentage: 100, maxOperator: '<=', points: 4.0 },
      { id: '2', letter: 'A', nameAr: 'ممتاز', nameEn: 'Excellent', minPercentage: 85, maxPercentage: 89.99, maxOperator: '<=', points: 3.7 },
      { id: '3', letter: 'B+', nameAr: 'جيد جداً مرتفع', nameEn: 'High Very Good', minPercentage: 80, maxPercentage: 84.99, maxOperator: '<=', points: 3.3 },
      { id: '4', letter: 'B', nameAr: 'جيد جداً', nameEn: 'Very Good', minPercentage: 75, maxPercentage: 79.99, maxOperator: '<=', points: 3.0 },
      { id: '5', letter: 'C+', nameAr: 'جيد مرتفع', nameEn: 'High Good', minPercentage: 70, maxPercentage: 74.99, maxOperator: '<=', points: 2.7 },
      { id: '6', letter: 'C', nameAr: 'جيد', nameEn: 'Good', minPercentage: 65, maxPercentage: 69.99, maxOperator: '<=', points: 2.4 },
      { id: '7', letter: 'D+', nameAr: 'مقبول مرتفع', nameEn: 'High Pass', minPercentage: 60, maxPercentage: 64.99, maxOperator: '<=', points: 2.2 },
      { id: '8', letter: 'D', nameAr: 'مقبول', nameEn: 'Pass', minPercentage: 50, maxPercentage: 59.99, maxOperator: '<=', points: 2.0 },
      { id: '9', letter: 'F', nameAr: 'راسب', nameEn: 'Fail', minPercentage: 0, maxPercentage: 49.99, maxOperator: '<', points: 0.0 }
    ];

    const updatedSettings: Partial<UserSettings> = {
      universityDatabaseId: undefined,
      specializationDatabaseId: undefined,
      university: 'غير محدد',
      college: 'غير محدد',
      specialization: '',
      deletedSubjectNames: [],
      gradingScale: defaultScale
    };

    set(state => ({
      subjects: [],
      files: [],
      settings: { ...state.settings, ...updatedSettings }
    }));

    await db.upsertSettings(userId, updatedSettings);
  },

  syncWithUniversityDatabase: async () => {
    if (activeSyncPromise) {
      return activeSyncPromise;
    }

    activeSyncPromise = (async () => {
      const { userId, settings } = get();
      if (!userId) return;

      try {
      let targetDbId = settings.universityDatabaseId;
      if (!targetDbId) {
        try {
          const savedRaw = localStorage.getItem(`unistudent_settings_${userId}`);
          if (savedRaw) {
            const parsed = JSON.parse(savedRaw);
            if (parsed.universityDatabaseId) {
              targetDbId = parsed.universityDatabaseId;
            }
          }
        } catch {}
      }

      const allDbs = await db.getUniversityDatabases();
      let matchedDb: UniversityDatabase | null = null;

      // 1. Try finding by ID first
      if (targetDbId) {
        matchedDb = allDbs.find(d => d.id === targetDbId) || null;
      }

      // 2. Self-Healing: If not found by ID, but user has university & college specified (or stale ID)
      if (!matchedDb && settings.university && settings.college && settings.university !== 'غير محدد' && settings.university !== 'Not specified') {
        const norm = (str?: string) => normalizeSubjectName(str);
        const normUni = norm(settings.university);
        const normCol = norm(settings.college);

        matchedDb = allDbs.find(d => {
          const uAr = norm(d.universityNameAr);
          const uEn = norm(d.universityNameEn);
          const cAr = norm(d.collegeNameAr);
          const cEn = norm(d.collegeNameEn);
          const uniMatches = (uAr && normUni.includes(uAr)) || (uEn && normUni.includes(uEn)) || (uAr && uAr.includes(normUni)) || uAr === normUni || uEn === normUni;
          const colMatches = (cAr && normCol.includes(cAr)) || (cEn && normCol.includes(cEn)) || (cAr && cAr.includes(normCol)) || cAr === normCol || cEn === normCol;
          return uniMatches && colMatches;
        }) || null;

        // Auto-heal the database ID immediately in Store, Supabase settings, and localStorage
        if (matchedDb) {
          targetDbId = matchedDb.id;
          set(state => ({ settings: { ...state.settings, universityDatabaseId: matchedDb!.id } }));
          db.upsertSettings(userId, { universityDatabaseId: matchedDb.id }).catch(() => {});
        }
      }

      if (!matchedDb) return;

      // Check for Specialization Database
      let specDb: UniversityDatabase | null = null;
      const targetSpecId = settings.specializationDatabaseId;
      if (targetSpecId) {
        specDb = allDbs.find(d => d.id === targetSpecId) || null;
      }
      if (!specDb && settings.specialization && matchedDb) {
        const norm = (str?: string) => normalizeSubjectName(str);
        const normSpec = norm(settings.specialization);
        specDb = allDbs.find(d => 
          d.isSpecialization && 
          (d.parentDatabaseId === matchedDb!.id || norm(d.collegeNameAr) === norm(matchedDb!.collegeNameAr)) &&
          (norm(d.specializationNameAr) === normSpec || norm(d.specializationNameEn) === normSpec)
        ) || null;
        if (specDb) {
          set(state => ({ settings: { ...state.settings, specializationDatabaseId: specDb!.id } }));
          db.upsertSettings(userId, { specializationDatabaseId: specDb.id }).catch(() => {});
        }
      }

      const isCollegeSource = !!(matchedDb.sourceUserId && matchedDb.sourceUserId === userId);
      const isSpecSource = !!(specDb && specDb.sourceUserId && specDb.sourceUserId === userId);

      // If user is source for both or source for only available database, isolate from reverse sync
      if (isCollegeSource && (!specDb || isSpecSource)) {
        return;
      }

      // If user's stored ID was different from the active DB, heal it
      if (settings.universityDatabaseId !== matchedDb.id) {
        set(state => ({ settings: { ...state.settings, universityDatabaseId: matchedDb.id } }));
        db.upsertSettings(userId, { universityDatabaseId: matchedDb.id }).catch(() => {});
      }

      let hasSubjectChanges = false;
      let hasFileChanges = false;
      let currentSubjects = [...get().subjects];
      let currentFiles = [...get().files];

      // Auto-deduplicate any pre-existing duplicate subjects
      const { clean: dedupedSubjects, duplicatesToRemove } = deduplicateSubjects(currentSubjects);
      if (duplicatesToRemove.length > 0) {
        currentSubjects = dedupedSubjects;
        hasSubjectChanges = true;
        for (const dup of duplicatesToRemove) {
          await db.deleteSubject(userId, dup.id).catch(() => {});
        }
      }

      // 1. Sync Grading Scale
      const effectiveDbScale = (specDb?.gradingScale && specDb.gradingScale.length > 0)
        ? specDb.gradingScale
        : (matchedDb.gradingScale && matchedDb.gradingScale.length > 0 ? matchedDb.gradingScale : null);

      if (effectiveDbScale && effectiveDbScale.length > 0) {
        const curScaleStr = JSON.stringify(settings.gradingScale || []);
        const tmplScaleStr = JSON.stringify(effectiveDbScale);
        if (curScaleStr !== tmplScaleStr) {
          set(state => ({ settings: { ...state.settings, gradingScale: effectiveDbScale } }));
          db.upsertSettings(userId, { gradingScale: effectiveDbScale }).catch(() => {});
        }
      }

      // 2. Dual-Sync Subjects with Smart Slicing & Multi-Key Matching
      let rawTemplateSubjs: Subject[] = [];
      if (specDb) {
        const startYear = Number(specDb.specializationStartYear || settings.specializationStartYear || 2);
        const startSem = Number(specDb.specializationStartSemester || settings.specializationStartSemester || 1);

        // Foundation subjects from main college database (prior to milestone)
        const foundationSubjs = !isCollegeSource ? (matchedDb.subjects || []).filter(s => {
          const y = Number(s.yearIndex || 1);
          const sm = Number(s.semesterIndex || 1);
          return y < startYear || (y === startYear && sm < startSem);
        }) : [];

        // Specialization subjects from specDb (from milestone onward)
        const specSubjs = !isSpecSource ? (specDb.subjects || []).filter(s => {
          const y = Number(s.yearIndex || 1);
          const sm = Number(s.semesterIndex || 1);
          return y > startYear || (y === startYear && sm >= startSem);
        }) : [];

        rawTemplateSubjs = [...foundationSubjs, ...specSubjs];
      } else {
        rawTemplateSubjs = !isCollegeSource ? (matchedDb.subjects || []) : [];
      }

      if (rawTemplateSubjs.length > 0) {
        const { clean: templateSubjs } = deduplicateSubjects(rawTemplateSubjs);

        // Multi-key matching helper function
        const findMatchingSubjectIndex = (tSub: Subject, list: Subject[]): number => {
          // Priority 1: Exact template ID link
          if (tSub.id) {
            const idx = list.findIndex(s => s.universityTemplateId === tSub.id || s.id === tSub.id);
            if (idx >= 0) return idx;
          }
          // Priority 2: Code + Year + Semester (if code present)
          const tCode = (tSub.code || '').trim().toLowerCase();
          if (tCode) {
            const idx = list.findIndex(s => {
              const sCode = (s.code || '').trim().toLowerCase();
              return sCode === tCode && Number(s.yearIndex || 1) === Number(tSub.yearIndex || 1) && Number(s.semesterIndex || 1) === Number(tSub.semesterIndex || 1);
            });
            if (idx >= 0) return idx;
          }
          // Priority 3: Normalized Name + Year + Semester
          const tNorm = normalizeSubjectName(tSub.name);
          if (tNorm) {
            const idx = list.findIndex(s => {
              return normalizeSubjectName(s.name) === tNorm && Number(s.yearIndex || 1) === Number(tSub.yearIndex || 1) && Number(s.semesterIndex || 1) === Number(tSub.semesterIndex || 1);
            });
            if (idx >= 0) return idx;
          }
          // Priority 4: Normalized Name match (fallback)
          if (tNorm) {
            const idx = list.findIndex(s => normalizeSubjectName(s.name) === tNorm);
            if (idx >= 0) return idx;
          }
          return -1;
        };

        const matchedExistingIndices = new Set<number>();

        // A. Update existing subjects or add new ones
        for (const tSub of templateSubjs) {
          const tYear = Number(tSub.yearIndex !== undefined ? tSub.yearIndex : ((tSub as any).year_index !== undefined ? (tSub as any).year_index : 1));
          const tSem = Number(tSub.semesterIndex !== undefined ? tSub.semesterIndex : ((tSub as any).semester_index !== undefined ? (tSub as any).semester_index : 1));
          const tHours = Number(tSub.creditHours !== undefined ? tSub.creditHours : ((tSub as any).credit_hours !== undefined ? (tSub as any).credit_hours : 3));
          const tMarks = Number(tSub.totalMarks !== undefined ? tSub.totalMarks : ((tSub as any).total_marks !== undefined ? (tSub as any).total_marks : 100));

          const matchIdx = findMatchingSubjectIndex(tSub, currentSubjects);

          if (matchIdx >= 0) {
            matchedExistingIndices.add(matchIdx);
            const existing = currentSubjects[matchIdx];

            const tDists = tSub.distributions || [];
            const curDists = existing.distributions || [];
            const curDistsByName = new Map(curDists.map(d => [normalizeSubjectName(d.name), d]));

            let distsChanged = false;
            if (tDists.length !== curDists.length) {
              distsChanged = true;
            } else {
              for (const td of tDists) {
                const cd = curDistsByName.get(normalizeSubjectName(td.name));
                if (!cd || Number(cd.maxMarks) !== Number(td.maxMarks)) {
                  distsChanged = true;
                  break;
                }
              }
            }

            const hasChanged =
              existing.name !== tSub.name ||
              existing.yearIndex !== tYear ||
              existing.semesterIndex !== tSem ||
              existing.creditHours !== tHours ||
              existing.totalMarks !== tMarks ||
              (tSub.code && existing.code !== tSub.code) ||
              existing.universityTemplateId !== tSub.id ||
              distsChanged;

            if (hasChanged) {
              const syncedDists = tDists.map(td => {
                const prev = curDistsByName.get(normalizeSubjectName(td.name));
                return {
                  id: prev?.id || td.id || uuidv4(),
                  name: td.name,
                  maxMarks: Number(td.maxMarks || 0),
                  achievedMarks: prev ? prev.achievedMarks : null,
                  status: prev ? prev.status : ('current' as const)
                };
              });

              const updated: Subject = {
                ...existing,
                universityTemplateId: tSub.id,
                name: tSub.name,
                yearIndex: tYear,
                semesterIndex: tSem,
                creditHours: tHours,
                totalMarks: tMarks,
                code: tSub.code || existing.code,
                distributions: syncedDists.length > 0 ? syncedDists : existing.distributions,
                includeInGpa: tSub.includeInGpa !== false
              };
              currentSubjects[matchIdx] = updated;
              await db.updateSubject(userId, existing.id, updated);
              hasSubjectChanges = true;
            }
          } else {
            // New subject added in college database: Add to student
            const newS: Subject = {
              id: uuidv4(),
              universityTemplateId: tSub.id,
              code: (tSub.code || '').trim(),
              name: tSub.name,
              creditHours: tHours,
              totalMarks: tMarks,
              yearIndex: tYear,
              semesterIndex: tSem,
              distributions: (tSub.distributions || []).map((d: any) => ({
                id: d.id || uuidv4(),
                name: d.name,
                maxMarks: Number(d.maxMarks !== undefined ? d.maxMarks : ((d as any).max_marks !== undefined ? (d as any).max_marks : 0)),
                achievedMarks: null,
                status: 'current' as const
              })),
              status: 'current',
              includeInGpa: tSub.includeInGpa !== false && (tSub as any).include_in_gpa !== false
            };

            currentSubjects.push(newS);
            matchedExistingIndices.add(currentSubjects.length - 1);
            await db.addSubject(userId, newS);
            hasSubjectChanges = true;
          }
        }

        // B. Delete subjects removed from college database (unless student has completed / achieved marks)
        const remainingSubjects: Subject[] = [];
        for (let i = 0; i < currentSubjects.length; i++) {
          const s = currentSubjects[i];
          const isMatched = matchedExistingIndices.has(i);

          if (isMatched) {
            remainingSubjects.push(s);
          } else {
            // Subject is not in the college database
            const hasAchievedMarks = (s.distributions || []).some(
              d => d.achievedMarks !== null && d.achievedMarks !== undefined && Number(d.achievedMarks) > 0
            );
            const isFinished = s.status === 'finished';

            // Delete if not completed with marks
            if (!hasAchievedMarks && !isFinished) {
              await db.deleteSubject(userId, s.id);
              hasSubjectChanges = true;
            } else {
              remainingSubjects.push(s);
            }
          }
        }
        if (hasSubjectChanges) {
          currentSubjects = remainingSubjects;
        }
      }

      // 3. Sync Drive Files
      const combinedDriveFiles: DriveFile[] = [
        ...(!isCollegeSource ? (matchedDb.driveFiles || []) : []),
        ...(!isSpecSource && specDb ? (specDb.driveFiles || []) : [])
      ];

      if (combinedDriveFiles.length > 0) {
        const templateFiles = combinedDriveFiles;
        const templateFileMap = new Map(templateFiles.map((f: DriveFile) => [f.id, f]));
        const templateNames = new Set(templateFiles.map((f: DriveFile) => (f.name || '').trim().toLowerCase()));

        // Add or update drive files
        for (const tFile of templateFiles) {
          const existingFile = currentFiles.find(f => 
            (f.universityTemplateId && f.universityTemplateId === tFile.id) ||
            (f.name.trim().toLowerCase() === (tFile.name || '').trim().toLowerCase() && f.type === tFile.type)
          );

          if (!existingFile) {
            const newF: DriveFile = {
              id: uuidv4(),
              universityTemplateId: tFile.id,
              name: tFile.name,
              size: Number(tFile.size || 0),
              type: tFile.type || 'file',
              parentId: tFile.parentId || null,
              createdAt: tFile.createdAt || new Date().toISOString(),
              url: tFile.url || '',
              b2FileId: tFile.b2FileId
            };
            currentFiles.push(newF);
            await db.addDriveFile(userId, newF);
            hasFileChanges = true;
          } else {
            // Check if file URL or name changed
            if (existingFile.url !== tFile.url || existingFile.name !== tFile.name || existingFile.universityTemplateId !== tFile.id) {
              existingFile.url = tFile.url;
              existingFile.name = tFile.name;
              existingFile.universityTemplateId = tFile.id;
              await db.updateDriveFile(userId, existingFile.id, {
                url: tFile.url,
                name: tFile.name,
                universityTemplateId: tFile.id
              }).catch(() => {});
              hasFileChanges = true;
            }
          }
        }

        // Remove drive files that were deleted from template
        const remainingFiles: DriveFile[] = [];
        for (const f of currentFiles) {
          const fName = (f.name || '').trim().toLowerCase();
          const isFromTemplate = Boolean(f.universityTemplateId) || Boolean(f.url);
          const stillInTemplate = (f.universityTemplateId && templateFileMap.has(f.universityTemplateId)) || templateNames.has(fName);

          if (isFromTemplate && !stillInTemplate) {
            await db.deleteDriveFile(userId, f.id);
            hasFileChanges = true;
          } else {
            remainingFiles.push(f);
          }
        }
        if (hasFileChanges) {
          currentFiles = remainingFiles;
        }
      }

      if (hasSubjectChanges) {
        set({ subjects: currentSubjects });
        try {
          localStorage.setItem(`unistudent_subjects_${userId}`, JSON.stringify(currentSubjects));
        } catch {}
      }
      if (hasFileChanges) {
        set({ files: currentFiles });
        try {
          localStorage.setItem(`unistudent_files_${userId}`, JSON.stringify(currentFiles));
        } catch {}
      }

      // Sync grading scale if template has one and it differs
      if (matchedDb.gradingScale && Array.isArray(matchedDb.gradingScale) && matchedDb.gradingScale.length > 0) {
        const curScaleStr = JSON.stringify(settings.gradingScale || []);
        const tplScaleStr = JSON.stringify(matchedDb.gradingScale);
        if (curScaleStr !== tplScaleStr) {
          const updatedSettings = { ...settings, gradingScale: matchedDb.gradingScale };
          set({ settings: updatedSettings });
          db.upsertSettings(userId, { gradingScale: matchedDb.gradingScale }).catch(console.warn);
        }
      }
      } catch (e) {
        console.warn('syncWithUniversityDatabase error:', e);
      } finally {
        activeSyncPromise = null;
      }
    })();

    return activeSyncPromise;
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
    const matchingDbs = uniDbs.filter(u => u.sourceUserId === userId);
    for (const matchingDb of matchingDbs) {
      // If this is a specialization database, check if subject falls into its milestone
      if (matchingDb.isSpecialization && data?.yearIndex) {
        const startYr = Number(matchingDb.specializationStartYear || 2);
        const startSm = Number(matchingDb.specializationStartSemester || 1);
        const y = Number(data.yearIndex || 1);
        const sm = Number(data.semesterIndex || 1);
        if (y < startYr || (y === startYr && sm < startSm)) {
          // This subject belongs to parent college years, not this specialization database
          continue;
        }
      }

      let finalDescription = description;
      if (type === 'add_subject' && data?.name) {
        finalDescription = `إضافة مادة جديدة: ${data.name} (سنة ${data.yearIndex || 1} - ترم ${data.semesterIndex || 1})`;
      } else if (type === 'update_subject' && data?.name) {
        finalDescription = `تعديل مادة: ${data.name} (سنة ${data.yearIndex || 1} - ترم ${data.semesterIndex || 1})`;
      }

      await db.recordPendingUpdate({
        id: uuidv4(),
        universityDatabaseId: matchingDb.id,
        universityName: matchingDb.universityNameAr || matchingDb.universityNameEn,
        collegeName: matchingDb.collegeNameAr || matchingDb.collegeNameEn,
        isSpecialization: matchingDb.isSpecialization,
        specializationName: matchingDb.specializationNameAr || matchingDb.specializationNameEn,
        parentCollegeName: matchingDb.collegeNameAr || matchingDb.collegeNameEn,
        sourceUserId: userId,
        sourceUserEmail: userEmail || '',
        sourceUserName: userName || '',
        type,
        description: finalDescription,
        data,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn('Error in checkAndNotifySourceUpdate:', e);
  }
}
