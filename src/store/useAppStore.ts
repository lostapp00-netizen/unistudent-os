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
  unlinkSpecializationDatabase: () => Promise<void>;
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

      let localSettings: any = {};
      try {
        const savedRaw = localStorage.getItem(`unistudent_settings_${userId}`);
        if (savedRaw) localSettings = JSON.parse(savedRaw);
      } catch {}

      const mergedSettings: UserSettings = {
        ...defaultSettings,
        ...localSettings,
        ...(settingsData || {}),
        name: (settingsData?.name && settingsData.name.trim()) ? settingsData.name : (localSettings.name || defaultSettings.name),
        university: (settingsData?.university && settingsData.university !== 'غير محدد' && settingsData.university !== 'Not specified')
          ? settingsData.university
          : (localSettings.university || settingsData?.university || defaultSettings.university),
        college: (settingsData?.college && settingsData.college !== 'غير محدد' && settingsData.college !== 'Not specified')
          ? settingsData.college
          : (localSettings.college || settingsData?.college || defaultSettings.college),
        email: email || settingsData?.email || localSettings.email || ''
      };

      // Always persist the settings row on login. Brand-new accounts previously
      // never wrote a row (the old equality check always matched), so they were
      // invisible in the admin panel until the student saved something manually.
      db.upsertSettings(userId, { email: email || undefined, name: mergedSettings.name } as any).catch(() => {});

      try {
        const knownRaw = localStorage.getItem('unistudent_known_users');
        const knownList: any[] = knownRaw ? JSON.parse(knownRaw) : [];
        const userProfile = {
          id: userId,
          email: email || mergedSettings.email,
          name: mergedSettings.name,
          university: mergedSettings.university,
          college: mergedSettings.college,
          specialization: mergedSettings.specialization || '',
          specializationStartYear: mergedSettings.specializationStartYear || 2,
          specializationStartSemester: mergedSettings.specializationStartSemester || 1,
          specializationDatabaseId: mergedSettings.specializationDatabaseId || '',
          gradingScale: mergedSettings.gradingScale,
          semesters: mergedSettings.semesters,
          lastSeen: new Date().toISOString()
        };
        const existingIdx = knownList.findIndex((u: any) => u.id === userId);
        if (existingIdx >= 0) {
          knownList[existingIdx] = { ...knownList[existingIdx], ...userProfile };
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
        // Database linking is EXPLICIT-ONLY (restore action). Typing a
        // university/college/specialization name must never create a link,
        // even when a database with the same names exists.
      } catch (e) {
        console.warn('Silent uni resolve in initialize error:', e);
      }

      // Re-initializing the SAME already-initialized user must never flip
      // isInitialized back to false: that renders the full-screen spinner and
      // unmounts every route, destroying open modals/forms (upload dialog,
      // add-subject form...). Only the first boot or a real user switch may
      // show the loading screen.
      const wasInitializedForSameUser = get().userId === userId && get().isInitialized;
      set({
        userId,
        userEmail: email || null,
        isInitialized: wasInitializedForSameUser ? true : false,
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
      if (mergedSettings.universityDatabaseId) {
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
      try {
        const knownRaw = localStorage.getItem('unistudent_known_users');
        if (knownRaw) {
          const knownList = JSON.parse(knownRaw);
          const existingIdx = knownList.findIndex((u: any) => u.id === userId);
          if (existingIdx >= 0) {
            knownList[existingIdx] = {
              ...knownList[existingIdx],
              specialization: updated.specialization !== undefined ? updated.specialization : knownList[existingIdx].specialization,
              specializationStartYear: updated.specializationStartYear !== undefined ? updated.specializationStartYear : knownList[existingIdx].specializationStartYear,
              specializationStartSemester: updated.specializationStartSemester !== undefined ? updated.specializationStartSemester : knownList[existingIdx].specializationStartSemester,
              specializationDatabaseId: updated.specializationDatabaseId !== undefined ? updated.specializationDatabaseId : knownList[existingIdx].specializationDatabaseId,
              university: updated.university || knownList[existingIdx].university,
              college: updated.college || knownList[existingIdx].college,
              name: updated.name || knownList[existingIdx].name
            };
            localStorage.setItem('unistudent_known_users', JSON.stringify(knownList));
          }
        }
      } catch {}
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
      // Send the full merged subject so yearIndex/semesterIndex are always
      // available for the general-vs-specialization phase filter, plus the
      // exact changed fields so personal-only edits get filtered out.
      checkAndNotifySourceUpdate(userId, userEmail, settings.name, 'update_subject', `تعديل مادة: ${old.name}`, { ...old, ...updatedFields }, updatedFields);
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
      const normName = normalizeSubjectName(old.name);
      const templateId = old.universityTemplateId;
      const currentDeleted = settings.deletedSubjectNames || [];

      const toAdd = [deletedName, normName, templateId, id].filter(Boolean) as string[];
      const updatedDeleted = Array.from(new Set([...currentDeleted, ...toAdd]));

      set(state => ({ settings: { ...state.settings, deletedSubjectNames: updatedDeleted } }));
      db.upsertSettings(userId, { deletedSubjectNames: updatedDeleted }).catch(() => {});

      checkAndNotifySourceUpdate(userId, userEmail, settings.name, 'delete_subject', `حذف مادة: ${old.name}`, { id, name: old.name, yearIndex: old.yearIndex, semesterIndex: old.semesterIndex });
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
        // 1. If student already has a valid general college linked, use that as parent
        if (settings.universityDatabaseId && settings.universityDatabaseId !== udb.id) {
          parentDb = await db.getUniversityDatabase(settings.universityDatabaseId);
        }
        // 2. Otherwise check udb.parentDatabaseId
        if (!parentDb && udb.parentDatabaseId) {
          parentDb = await db.getUniversityDatabase(udb.parentDatabaseId);
        }
        // 3. Fallback: match general college database by university and college name
        if (!parentDb) {
          const allDbs = await db.getUniversityDatabases();
          const norm = (str?: string) => normalizeSubjectName(str);
          const normUni = norm(udb.universityNameAr);
          parentDb = allDbs.find(d => 
            !d.isSpecialization && 
            norm(d.universityNameAr) === normUni &&
            (d.id === udb.parentDatabaseId || (norm(d.collegeNameAr) && norm(udb.collegeNameAr).includes(norm(d.collegeNameAr))))
          ) || null;
        }
        if (parentDb) {
          mainCollegeDb = parentDb;
        }
      } else if (options?.specializationDbId) {
        specDb = await db.getUniversityDatabase(options.specializationDbId);
      }

      const isAr = settings.language === 'ar';
      const chosenUni = isAr 
        ? (mainCollegeDb.universityNameAr || mainCollegeDb.universityNameEn || udb.universityNameAr) 
        : (mainCollegeDb.universityNameEn || mainCollegeDb.universityNameAr || udb.universityNameEn);

      let chosenCollege = isAr 
        ? (mainCollegeDb.collegeNameAr || mainCollegeDb.collegeNameEn) 
        : (mainCollegeDb.collegeNameEn || mainCollegeDb.collegeNameAr);
      if (chosenCollege && chosenCollege.includes(' - ')) {
        chosenCollege = chosenCollege.split(' - ')[0].trim();
      }

      const rawScale = (specDb?.gradingScale && specDb.gradingScale.length > 0)
        ? specDb.gradingScale
        : (mainCollegeDb.gradingScale && mainCollegeDb.gradingScale.length > 0 ? mainCollegeDb.gradingScale : settings.gradingScale);

      const effectiveGradingScale = (rawScale || []).filter((g: any) => g && !String(g.id || '').startsWith('__') && (typeof g.points === 'number' || !isNaN(Number(g.points))));

      const specStartYr = Number(specDb?.specializationStartYear || mainCollegeDb.specializationStartYear || 2);
      const specStartSem = Number(specDb?.specializationStartSemester || mainCollegeDb.specializationStartSemester || 1);

      const updatedSettings: Partial<UserSettings> = {
        university: chosenUni,
        college: chosenCollege,
        totalYears: mainCollegeDb.totalYears || specDb?.totalYears || 4,
        semestersPerYear: mainCollegeDb.semestersPerYear || specDb?.semestersPerYear || 2,
        universityDatabaseId: mainCollegeDb.id, // Guarantee always pointed to parent college!
        deletedSubjectNames: [],
        gradingScale: effectiveGradingScale,
        specializationStartYear: specStartYr,
        specializationStartSemester: specStartSem,
      };

      if (specDb) {
        updatedSettings.specialization = specDb.specializationNameAr || specDb.specializationNameEn || '';
        updatedSettings.specializationDatabaseId = specDb.id;
      }

      // Generate or update semesters based on Foundation vs Specialization scope
      const totY = Number(updatedSettings.totalYears || 4);
      const semY = Number(updatedSettings.semestersPerYear || 2);

      let targetYears: number[] = [];
      if (specDb) {
        for (let y = 1; y <= totY; y++) targetYears.push(y);
      } else {
        const maxFoundationYear = Math.max(1, specStartSem === 1 ? specStartYr - 1 : specStartYr);
        for (let y = 1; y <= maxFoundationYear; y++) targetYears.push(y);
      }

      const existingSemesters = settings.semesters || [];
      const updatedSemesters: any[] = [];

      for (const y of targetYears) {
        for (let s = 1; s <= semY; s++) {
          const existing = existingSemesters.find(sm => sm.yearIndex === y && sm.semesterIndex === s);
          if (existing) {
            updatedSemesters.push(existing);
          } else {
            updatedSemesters.push({
              id: uuidv4(),
              yearIndex: y,
              semesterIndex: s,
              startDate: '',
              endDate: '',
              isCurrent: y === 1 && s === 1
            });
          }
        }
      }
      updatedSettings.semesters = updatedSemesters;

      set(state => ({ settings: { ...state.settings, ...updatedSettings } }));
      db.upsertSettings(userId, updatedSettings).catch(console.error);

      // Non-Destructive Dual-Database Merging
      const currentSubjects = get().subjects || [];

      if (specDb) {
        const startYear = Number(specDb.specializationStartYear || settings.specializationStartYear || 2);
        const startSem = Number(specDb.specializationStartSemester || settings.specializationStartSemester || 1);

        // 1. Foundation subjects: keep existing student foundation subjects 100% untouched!
        let foundationSubjs = currentSubjects.filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          return y < startYear || (y === startYear && sem < startSem);
        });

        let newFoundationToInsert: Subject[] = [];
        // If student had no foundation subjects yet, pull them from the parent college database
        if (foundationSubjs.length === 0 && mainCollegeDb && Array.isArray(mainCollegeDb.subjects)) {
          const collegeFoundation = (mainCollegeDb.subjects || []).filter(s => {
            const y = Number(s.yearIndex || 1);
            const sem = Number(s.semesterIndex || 1);
            return y < startYear || (y === startYear && sem < startSem);
          });
          newFoundationToInsert = collegeFoundation.map(s => ({
            id: uuidv4(),
            universityTemplateId: s.id,
            code: (s.code || '').trim(),
            name: s.name,
            creditHours: Number(s.creditHours || 3),
            totalMarks: Number(s.totalMarks || 100),
            yearIndex: Number(s.yearIndex || 1),
            semesterIndex: Number(s.semesterIndex || 1),
            distributions: (s.distributions || []).map((d: any) => ({
              id: uuidv4(),
              name: d.name,
              maxMarks: Number(d.maxMarks !== undefined ? d.maxMarks : 0),
              achievedMarks: null,
              status: 'current' as const
            })),
            status: s.status || 'current',
            includeInGpa: s.includeInGpa !== false
          }));
          foundationSubjs = newFoundationToInsert;
        }

        // 2. Remove old specialization subjects of the student (y >= startYear)
        const oldSpecSubjs = currentSubjects.filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          return y > startYear || (y === startYear && sem >= startSem);
        });
        for (const oldS of oldSpecSubjs) {
          await db.deleteSubject(userId, oldS.id).catch(() => {});
        }

        // 3. New specialization subjects from specDb
        const newSpecSubjs: Subject[] = (specDb.subjects || []).filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          return y > startYear || (y === startYear && sem >= startSem);
        }).map(s => ({
          id: uuidv4(),
          universityTemplateId: s.id,
          code: (s.code || '').trim(),
          name: s.name,
          creditHours: Number(s.creditHours || 3),
          totalMarks: Number(s.totalMarks || 100),
          yearIndex: Number(s.yearIndex || 1),
          semesterIndex: Number(s.semesterIndex || 1),
          distributions: (s.distributions || []).map((d: any) => ({
            id: uuidv4(),
            name: d.name,
            maxMarks: Number(d.maxMarks !== undefined ? d.maxMarks : 0),
            achievedMarks: null,
            status: 'current' as const
          })),
          status: s.status || 'current',
          includeInGpa: s.includeInGpa !== false
        }));

        for (const s of [...newFoundationToInsert, ...newSpecSubjs]) {
          await db.addSubject(userId, s);
        }

        const finalSubjects = [...foundationSubjs, ...newSpecSubjs];
        const { clean: deduped } = deduplicateSubjects(finalSubjects);
        set({ subjects: deduped });
        try {
          localStorage.setItem(`unistudent_subjects_${userId}`, JSON.stringify(deduped));
        } catch {}
      } else {
        // General College Restore: Restore foundation subjects while PRESERVING any existing specialization courses
        const startYear = Number(mainCollegeDb.specializationStartYear || 2);
        const startSem = Number(mainCollegeDb.specializationStartSemester || 1);

        const existingSpecializationSubjs = currentSubjects.filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          return y > startYear || (y === startYear && sem >= startSem);
        });

        // Delete old foundation subjects
        const oldFoundationSubjs = currentSubjects.filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          return y < startYear || (y === startYear && sem < startSem);
        });
        for (const oldS of oldFoundationSubjs) {
          await db.deleteSubject(userId, oldS.id).catch(() => {});
        }

        // Import new foundation subjects from mainCollegeDb
        const newFoundationSubjs: Subject[] = (mainCollegeDb.subjects || []).filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          return y < startYear || (y === startYear && sem < startSem);
        }).map(s => ({
          id: uuidv4(),
          universityTemplateId: s.id,
          code: (s.code || '').trim(),
          name: s.name,
          creditHours: Number(s.creditHours || 3),
          totalMarks: Number(s.totalMarks || 100),
          yearIndex: Number(s.yearIndex || 1),
          semesterIndex: Number(s.semesterIndex || 1),
          distributions: (s.distributions || []).map((d: any) => ({
            id: uuidv4(),
            name: d.name,
            maxMarks: Number(d.maxMarks !== undefined ? d.maxMarks : 0),
            achievedMarks: null,
            status: 'current' as const
          })),
          status: s.status || 'current',
          includeInGpa: s.includeInGpa !== false
        }));

        for (const s of newFoundationSubjs) {
          await db.addSubject(userId, s);
        }

        const finalSubjects = [...newFoundationSubjs, ...existingSpecializationSubjs];
        const { clean: deduped } = deduplicateSubjects(finalSubjects);
        set({ subjects: deduped });
        try {
          localStorage.setItem(`unistudent_subjects_${userId}`, JSON.stringify(deduped));
        } catch {}
      }

      // Drive files: Non-destructive append & merge
      if (options?.importDrive !== false) {
        const incomingDriveFiles: DriveFile[] = specDb
          ? (specDb.driveFiles || [])
          : (mainCollegeDb.driveFiles || []);

        if (incomingDriveFiles.length > 0) {
          const currentDrive = get().files || [];
          const existingTemplateIds = new Set(
            currentDrive.map(f => f.universityTemplateId).filter(Boolean) as string[]
          );
          const existingSignatures = new Set(currentDrive.map(f => `${f.name}-${f.type}-${f.parentId || 'root'}`));

          const idMap = new Map<string, string>();
          const clonedFiles: DriveFile[] = [];
          const clonedTemplateIds = new Set<string>();

          // Parent-first (topological) clone: a folder is always cloned before
          // its children so idMap can link them. The old flat "folders first"
          // sort used an invalid comparator that produced arbitrary order and
          // flattened nested folders to the root.
          const byId = new Map(incomingDriveFiles.map(f => [f.id, f]));
          const inProgress = new Set<string>();
          const cloneFile = async (file: DriveFile): Promise<void> => {
            if (!file || clonedTemplateIds.has(file.id) || inProgress.has(file.id)) return;
            inProgress.add(file.id);

            // Clone parent chain first
            if (file.parentId) {
              await cloneFile(byId.get(file.parentId));
            }

            clonedTemplateIds.add(file.id);

            // Idempotency: skip if this template item was already imported
            if (existingTemplateIds.has(file.id)) {
              idMap.set(file.id, currentDrive.find(f => f.universityTemplateId === file.id)!.id);
              return;
            }
            const signature = `${file.name}-${file.type}-${file.parentId || 'root'}`;
            if (existingSignatures.has(signature)) {
              // Map to the existing local twin so children can attach to it
              const twin = currentDrive.find(f => f.type === file.type && f.name === file.name);
              if (twin) idMap.set(file.id, twin.id);
              return;
            }

            const newId = uuidv4();
            idMap.set(file.id, newId);
            const newParentId = file.parentId ? (idMap.get(file.parentId) || null) : null;

            const cloned: DriveFile = {
              id: newId,
              universityTemplateId: file.id,
              name: file.name,
              size: file.size,
              type: file.type,
              parentId: newParentId,
              createdAt: new Date().toISOString(),
              url: file.url,
              b2FileId: file.b2FileId,
              yearIndex: file.yearIndex,
              semesterIndex: file.semesterIndex
            };
            clonedFiles.push(cloned);
            await db.addDriveFile(userId, cloned);
          };

          for (const file of incomingDriveFiles) {
            await cloneFile(file);
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

    try {
      localStorage.removeItem(`unistudent_subjects_${userId}`);
      localStorage.removeItem(`unistudent_files_${userId}`);
    } catch {}

    await db.upsertSettings(userId, updatedSettings);
  },

  unlinkSpecializationDatabase: async () => {
    const { userId, settings, subjects, files } = get();
    if (!userId) return;

    const specStartYr = Number(settings.specializationStartYear || 2);
    const specStartSem = Number(settings.specializationStartSemester || 1);
    const specDbId = settings.specializationDatabaseId;

    const specTemplateFileIds = new Set<string>();
    const specTemplateSubjectIds = new Set<string>();

    let specDb: UniversityDatabase | null = null;
    if (specDbId) {
      try {
        specDb = await db.getUniversityDatabase(specDbId);
        if (specDb) {
          (specDb.subjects || []).forEach(s => { if (s.id) specTemplateSubjectIds.add(s.id); });
          (specDb.driveFiles || []).forEach(f => { if (f.id) specTemplateFileIds.add(f.id); });
        }
      } catch {}
    }

    // Filter out subjects that belong to specialization (keep foundation subjects)
    const remainingSubjects = subjects.filter(s => {
      const isSpecTemplate = (s.universityTemplateId && specTemplateSubjectIds.has(s.universityTemplateId)) || specTemplateSubjectIds.has(s.id);
      const y = Number(s.yearIndex || 1);
      const sm = Number(s.semesterIndex || 1);
      const isSpecPhase = y > specStartYr || (y === specStartYr && sm >= specStartSem);

      if (isSpecTemplate || isSpecPhase) {
        db.deleteSubject(userId, s.id).catch(() => {});
        return false;
      }
      return true;
    });

    // Filter out files that belong to specialization
    const remainingFiles = files.filter(f => {
      const isSpecFile = (f.universityTemplateId && specTemplateFileIds.has(f.universityTemplateId)) || specTemplateFileIds.has(f.id);
      if (isSpecFile) {
        db.deleteDriveFile(userId, f.id).catch(() => {});
        return false;
      }
      return true;
    });

    // Repair universityDatabaseId if it was pointing to specDbId
    let repairedUniDbId = settings.universityDatabaseId;
    if (repairedUniDbId === specDbId && specDb?.parentDatabaseId) {
      repairedUniDbId = specDb.parentDatabaseId;
    }

    let cleanCollege = settings.college || '';
    if (cleanCollege.includes(' - ')) {
      cleanCollege = cleanCollege.split(' - ')[0].trim();
    }

    const updatedSettings: Partial<UserSettings> = {
      specializationDatabaseId: undefined,
      specialization: '',
      universityDatabaseId: repairedUniDbId,
      college: cleanCollege
    };

    set(state => ({
      subjects: remainingSubjects,
      files: remainingFiles,
      settings: { ...state.settings, ...updatedSettings }
    }));

    try {
      localStorage.setItem(`unistudent_subjects_${userId}`, JSON.stringify(remainingSubjects));
      localStorage.setItem(`unistudent_files_${userId}`, JSON.stringify(remainingFiles));
    } catch {}

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

      // 1. Try finding by ID directly first (fastest, avoids full scan)
      let matchedDb: UniversityDatabase | null = null;
      if (targetDbId) {
        matchedDb = await db.getUniversityDatabase(targetDbId);
      }

      if (!matchedDb) {
        const allDbs = await db.getUniversityDatabases();
        if (targetDbId) {
          matchedDb = allDbs.find(d => d.id === targetDbId) || null;
        }

        // 2. Self-Healing: If not found by ID, but the student previously had a
        // database link (stale ID — e.g. admin re-created the DB), re-link by
        // university & college name. Students who NEVER restored anything must
        // stay unlinked — typing a university/college name is never a link.
        if (!matchedDb && (targetDbId || settings.universityDatabaseId) && settings.university && settings.college && settings.university !== 'غير محدد' && settings.university !== 'Not specified') {
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
      }

      if (!matchedDb) {
        // If student had a universityDatabaseId, but no matching admin database exists anymore
        // (or student entered a custom university / college), simply clear the template ID link!
        // NEVER reset the student's university or college name to 'غير محدد', and NEVER wipe their subjects!
        if (settings.universityDatabaseId || targetDbId) {
          set(state => ({ settings: { ...state.settings, universityDatabaseId: undefined } }));
          db.upsertSettings(userId, { universityDatabaseId: null }).catch(() => {});
          try {
            const savedRaw = localStorage.getItem(`unistudent_settings_${userId}`);
            if (savedRaw) {
              const parsed = JSON.parse(savedRaw);
              delete parsed.universityDatabaseId;
              localStorage.setItem(`unistudent_settings_${userId}`, JSON.stringify(parsed));
            }
          } catch {}
        }
        return;
      }

      // Self-Healing: If matchedDb is a specialization database, resolve its parent general college!
      if (matchedDb && matchedDb.isSpecialization) {
        let parentCollege: UniversityDatabase | null = null;
        if (matchedDb.parentDatabaseId) {
          parentCollege = await db.getUniversityDatabase(matchedDb.parentDatabaseId);
        }
        if (!parentCollege) {
          const allDbs = await db.getUniversityDatabases();
          parentCollege = allDbs.find(d => !d.isSpecialization && (d.id === matchedDb!.parentDatabaseId || d.universityNameAr === matchedDb!.universityNameAr)) || null;
        }
        if (parentCollege) {
          const detectedSpec = matchedDb;
          matchedDb = parentCollege;
          targetDbId = parentCollege.id;
          let cleanCollege = parentCollege.collegeNameAr || '';
          if (cleanCollege.includes(' - ')) {
            cleanCollege = cleanCollege.split(' - ')[0].trim();
          }
          set(state => ({
            settings: {
              ...state.settings,
              universityDatabaseId: parentCollege!.id,
              specializationDatabaseId: detectedSpec.id,
              specialization: detectedSpec.specializationNameAr || detectedSpec.specializationNameEn || state.settings.specialization,
              college: cleanCollege
            }
          }));
          db.upsertSettings(userId, {
            universityDatabaseId: parentCollege.id,
            specializationDatabaseId: detectedSpec.id,
            specialization: detectedSpec.specializationNameAr || detectedSpec.specializationNameEn || settings.specialization,
            college: cleanCollege
          }).catch(() => {});
        }
      }

      // Check for Specialization Database
      let specDb: UniversityDatabase | null = null;
      const targetSpecId = settings.specializationDatabaseId;
      if (targetSpecId) {
        specDb = await db.getUniversityDatabase(targetSpecId);
      }
      // Name-based spec re-link is ONLY a repair for a stale previous spec link.
      // A student who merely typed his specialization name (never restored a spec
      // database) must never be auto-linked here.
      if (!specDb && targetSpecId && settings.specialization && matchedDb) {
        const allDbs = await db.getUniversityDatabases();
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

      if (targetSpecId && !specDb) {
        // Specialization was deleted by Admin or custom: gracefully clear the database ID link without deleting subjects
        set(state => ({ settings: { ...state.settings, specializationDatabaseId: undefined } }));
        db.upsertSettings(userId, { specializationDatabaseId: null }).catch(() => {});
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
      const rawDbScale = (specDb?.gradingScale && specDb.gradingScale.length > 0)
        ? specDb.gradingScale
        : (matchedDb.gradingScale && matchedDb.gradingScale.length > 0 ? matchedDb.gradingScale : null);

      const effectiveDbScale = Array.isArray(rawDbScale)
        ? rawDbScale.filter((g: any) => g && !String(g.id || '').startsWith('__') && (typeof g.points === 'number' || !isNaN(Number(g.points))))
        : null;

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
        // General College Restore only:
        // Must ONLY sync foundation subjects according to college specialization milestone
        const specStartYr = Number(matchedDb.specializationStartYear || settings.specializationStartYear || 2);
        const specStartSem = Number(matchedDb.specializationStartSemester || settings.specializationStartSemester || 1);

        rawTemplateSubjs = !isCollegeSource ? (matchedDb.subjects || []).filter(s => {
          const y = Number(s.yearIndex || 1);
          const sm = Number(s.semesterIndex || 1);
          return y < specStartYr || (y === specStartYr && sm < specStartSem);
        }) : [];
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
          // Priority 4: Normalized Name match (fallback) — ONLY for subjects that
          // are already template-linked. A manually-added subject must never be
          // hijacked into a template subject's year/semester.
          if (tNorm) {
            const idx = list.findIndex(s => s.universityTemplateId && normalizeSubjectName(s.name) === tNorm);
            if (idx >= 0) return idx;
          }
          return -1;
        };

        const matchedExistingIndices = new Set<number>();
        const deletedSubjectSet = new Set<string>();
        (settings.deletedSubjectNames || []).forEach(n => {
          if (n) {
            deletedSubjectSet.add(n.trim().toLowerCase());
            deletedSubjectSet.add(normalizeSubjectName(n));
          }
        });

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
            // Check if student explicitly deleted this subject
            const isDeletedByStudent = 
              deletedSubjectSet.has(normalizeSubjectName(tSub.name)) ||
              deletedSubjectSet.has(tSub.name.trim().toLowerCase()) ||
              (tSub.id && (deletedSubjectSet.has(tSub.id) || (settings.deletedSubjectNames || []).includes(tSub.id)));

            if (isDeletedByStudent) {
              continue;
            }

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

        // B. Delete subjects removed from college database (unless student has completed / achieved marks or in specialization phase)
        const remainingSubjects: Subject[] = [];
        const specStartYr = Number(specDb?.specializationStartYear || matchedDb.specializationStartYear || settings.specializationStartYear || 2);
        const specStartSem = Number(specDb?.specializationStartSemester || matchedDb.specializationStartSemester || settings.specializationStartSemester || 1);

        for (let i = 0; i < currentSubjects.length; i++) {
          const s = currentSubjects[i];
          const isMatched = matchedExistingIndices.has(i);

          if (isMatched) {
            remainingSubjects.push(s);
          } else {
            const y = Number(s.yearIndex || 1);
            const sm = Number(s.semesterIndex || 1);
            const isSpecPhase = y > specStartYr || (y === specStartYr && sm >= specStartSem);

            // 0. Manually-added subjects (no universityTemplateId) belong to the
            // student alone. They must NEVER be auto-deleted by template sync,
            // even when they live in a year/semester outside the template range
            // or carry no achieved marks yet.
            if (!s.universityTemplateId) {
              remainingSubjects.push(s);
              continue;
            }

            // 1. If user is source for specialization, NEVER delete specialization subjects!
            if (isSpecSource && isSpecPhase) {
              remainingSubjects.push(s);
              continue;
            }

            // 2. If college-only sync (no specialization db linked), NEVER delete specialization subjects!
            if (!specDb && isSpecPhase) {
              remainingSubjects.push(s);
              continue;
            }

            // Subject is not in the college template
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
        const templateFileMap = new Map(combinedDriveFiles.map((f: DriveFile) => [f.id, f]));
        const templateNames = new Set(combinedDriveFiles.map((f: DriveFile) => (f.name || '').trim().toLowerCase()));

        // Process parents before children so every new item can link to its
        // parent's LOCAL id (not the template id — that was the cause of
        // "only the first folder is visible, and it's empty").
        const templateById = new Map(combinedDriveFiles.map((f: DriveFile) => [f.id, f]));
        const processedTemplates = new Set<string>();
        const templateToLocalId = new Map<string, string>(
          currentFiles.filter(f => f.universityTemplateId).map(f => [f.universityTemplateId as string, f.id])
        );

        const importTemplateFile = async (tFile: DriveFile): Promise<void> => {
          if (!tFile || processedTemplates.has(tFile.id)) return;
          processedTemplates.add(tFile.id);

          if (tFile.parentId) {
            await importTemplateFile(templateById.get(tFile.parentId));
          }

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
              parentId: tFile.parentId ? (templateToLocalId.get(tFile.parentId) || null) : null,
              createdAt: tFile.createdAt || new Date().toISOString(),
              url: tFile.url || '',
              b2FileId: tFile.b2FileId
            };
            currentFiles.push(newF);
            templateToLocalId.set(tFile.id, newF.id);
            await db.addDriveFile(userId, newF);
            hasFileChanges = true;
          } else {
            templateToLocalId.set(tFile.id, existingFile.id);

            // Heal dangling parents from earlier buggy syncs: recompute the
            // expected local parent and update if it differs.
            const expectedParentId = tFile.parentId ? (templateToLocalId.get(tFile.parentId) || null) : null;
            if ((existingFile.parentId || null) !== expectedParentId) {
              existingFile.parentId = expectedParentId;
              await db.updateDriveFile(userId, existingFile.id, { parentId: expectedParentId }).catch(() => {});
              hasFileChanges = true;
            } else if (existingFile.url !== tFile.url || existingFile.name !== tFile.name || existingFile.universityTemplateId !== tFile.id) {
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
        };

        for (const tFile of combinedDriveFiles) {
          await importTemplateFile(tFile);
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
  data: any,
  changedFields?: Record<string, any>
) {
  try {
    // Only curriculum-relevant edits deserve an admin review. Personal study
    // data (achieved marks, study status, notes...) never generates updates.
    if (type === 'update_subject') {
      const CURRICULUM_FIELDS = ['name', 'code', 'creditHours', 'totalMarks', 'distributions'];
      const changedKeys = Object.keys(changedFields || data || {}).filter(k => k !== 'id');
      const hasCurriculumChange = changedKeys.some(k => CURRICULUM_FIELDS.includes(k));
      if (!hasCurriculumChange) {
        return;
      }
    }

    const uniDbs = await db.getUniversityDatabases();
    const matchingDbs = uniDbs.filter(u => u.sourceUserId === userId);
    for (const matchingDb of matchingDbs) {
      if (data?.yearIndex) {
        const startYr = Number(matchingDb.specializationStartYear || 2);
        const startSm = Number(matchingDb.specializationStartSemester || 1);
        const y = Number(data.yearIndex || 1);
        const sm = Number(data.semesterIndex || 1);

        if (matchingDb.isSpecialization) {
          // If this is a specialization database, ignore subjects before specialization start
          if (y < startYr || (y === startYr && sm < startSm)) {
            continue;
          }
        } else {
          // If this is the general college database, ignore subjects at or after specialization start
          if (y > startYr || (y === startYr && sm >= startSm)) {
            continue;
          }
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
