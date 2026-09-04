import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { UserSettings, Subject, DriveFile, Note, Task, Appointment, ScheduleItem, Group, GraduationGradeRule, GradeRule } from '../types';
import { db } from '../lib/db';
import { normalizeSubjectName } from '../lib/academicTranslation';

let isSyncInProgress = false;

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
  importFromUniversityDatabase: (universityDbId: string, options?: { importDrive?: boolean }) => Promise<void>;
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
      } catch (e) {
        console.warn('Silent uni resolve in initialize error:', e);
      }

      set({
        userId,
        userEmail: email || null,
        isInitialized: true,
        settings: mergedSettings,
        subjects: finalSubjects,
        tasks: tasks || [],
        notes: notes || [],
        appointments: appointments || [],
        scheduleItems: scheduleItems || [],
        groups: finalGroups,
        files: files || []
      });

      if (mergedSettings.universityDatabaseId) {
        get().syncWithUniversityDatabase().catch(console.warn);
      }
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

  importFromUniversityDatabase: async (universityDbId: string, options?: { importDrive?: boolean }) => {
    const { userId, settings } = get();
    if (!userId) return;

    if (isSyncInProgress) return;
    isSyncInProgress = true;

    try {
      const udb = await db.getUniversityDatabase(universityDbId);
      if (!udb) throw new Error('قاعدة بيانات الجامعة غير موجودة');

      const isAr = settings.language === 'ar';
      const chosenUni = isAr ? (udb.universityNameAr || udb.universityNameEn) : (udb.universityNameEn || udb.universityNameAr);
      const chosenCollege = isAr ? (udb.collegeNameAr || udb.collegeNameEn) : (udb.collegeNameEn || udb.collegeNameAr);

      const updatedSettings: Partial<UserSettings> = {
        university: chosenUni,
        college: chosenCollege,
        totalYears: udb.totalYears || 4,
        semestersPerYear: udb.semestersPerYear || 2,
        universityDatabaseId: udb.id,
        deletedSubjectNames: [],
        gradingScale: udb.gradingScale && udb.gradingScale.length > 0 ? udb.gradingScale : settings.gradingScale
      };

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

      if (udb.subjects && udb.subjects.length > 0) {
        await db.clearAllSubjects(userId);

        const { clean: dedupedTemplateSubjs } = deduplicateSubjects(udb.subjects);

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

      if (options?.importDrive !== false && udb.driveFiles && udb.driveFiles.length > 0) {
        await db.clearAllDriveFiles(userId);
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
          await db.addDriveFile(userId, cloned);
        }

        set({ files: clonedFiles });
      }
    } finally {
      isSyncInProgress = false;
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
      university: 'غير محدد',
      college: 'غير محدد',
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
    const { userId, settings } = get();
    if (!userId) return;

    if (isSyncInProgress) return;
    isSyncInProgress = true;

    try {
      let targetDbId = settings.universityDatabaseId;
      if (!targetDbId) {
        try {
          const savedRaw = localStorage.getItem(`unistudent_settings_${userId}`);
          if (savedRaw) {
            const parsed = JSON.parse(savedRaw);
            if (parsed.universityDatabaseId) {
              targetDbId = parsed.universityDatabaseId;
              set(state => ({ settings: { ...state.settings, universityDatabaseId: targetDbId } }));
            }
          }
        } catch {}
      }

      if (!targetDbId && settings.university && settings.college && settings.university !== 'غير محدد') {
        const allDbs = await db.getUniversityDatabases();
        const autoMatched = allDbs.find(d => 
          (normalizeSubjectName(d.universityNameAr) === normalizeSubjectName(settings.university) || normalizeSubjectName(d.universityNameEn) === normalizeSubjectName(settings.university)) &&
          (normalizeSubjectName(d.collegeNameAr) === normalizeSubjectName(settings.college) || normalizeSubjectName(d.collegeNameEn) === normalizeSubjectName(settings.college))
        );
        if (autoMatched) {
          targetDbId = autoMatched.id;
          set(state => ({ settings: { ...state.settings, universityDatabaseId: autoMatched.id } }));
          db.upsertSettings(userId, { universityDatabaseId: autoMatched.id }).catch(() => {});
        }
      }

      if (!targetDbId) return;

      const matchedDb = await db.getUniversityDatabase(targetDbId);
      if (!matchedDb) return;

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

      if (matchedDb.gradingScale && matchedDb.gradingScale.length > 0) {
        const curScaleStr = JSON.stringify(settings.gradingScale || []);
        const tmplScaleStr = JSON.stringify(matchedDb.gradingScale);
        if (curScaleStr !== tmplScaleStr) {
          set(state => ({ settings: { ...state.settings, gradingScale: matchedDb.gradingScale } }));
          db.upsertSettings(userId, { gradingScale: matchedDb.gradingScale }).catch(() => {});
        }
      }

      if (matchedDb.subjects && Array.isArray(matchedDb.subjects)) {
        const { clean: templateSubjs } = deduplicateSubjects(matchedDb.subjects);
        const existingByName = new Map(currentSubjects.map(s => [normalizeSubjectName(s.name), s]));
        const deletedNames = new Set((settings.deletedSubjectNames || []).map(n => normalizeSubjectName(n)));
        const templateNames = new Set(templateSubjs.map(s => normalizeSubjectName(s.name)));

        // 1. Add new subjects from master template
        for (const tSub of templateSubjs) {
          const tName = normalizeSubjectName(tSub.name);
          if (!tName) continue;

          if (!existingByName.has(tName)) {
            if (deletedNames.has(tName)) continue;

            const tYear = Number(tSub.yearIndex !== undefined ? tSub.yearIndex : ((tSub as any).year_index !== undefined ? (tSub as any).year_index : 1));
            const tSem = Number(tSub.semesterIndex !== undefined ? tSub.semesterIndex : ((tSub as any).semester_index !== undefined ? (tSub as any).semester_index : 1));
            const tHours = Number(tSub.creditHours !== undefined ? tSub.creditHours : ((tSub as any).credit_hours !== undefined ? (tSub as any).credit_hours : 3));
            const tMarks = Number(tSub.totalMarks !== undefined ? tSub.totalMarks : ((tSub as any).total_marks !== undefined ? (tSub as any).total_marks : 100));

            const newS: Subject = {
              id: uuidv4(),
              code: (tSub.code || '').trim(),
              name: tSub.name,
              creditHours: tHours,
              totalMarks: tMarks,
              yearIndex: tYear,
              semesterIndex: tSem,
              distributions: (tSub.distributions || []).map((d: any) => ({
                id: uuidv4(),
                name: d.name,
                maxMarks: Number(d.maxMarks !== undefined ? d.maxMarks : ((d as any).max_marks !== undefined ? (d as any).max_marks : 0)),
                achievedMarks: null,
                status: 'current' as const
              })),
              status: 'current',
              includeInGpa: tSub.includeInGpa !== false && (tSub as any).include_in_gpa !== false
            };

            currentSubjects.push(newS);
            existingByName.set(tName, newS);
            await db.addSubject(userId, newS);
            hasSubjectChanges = true;
          }
        }

        // 2. Sync metadata changes for existing subjects
        const templateSubjsByName = new Map(templateSubjs.map(s => [normalizeSubjectName(s.name), s]));
        for (let i = 0; i < currentSubjects.length; i++) {
          const existing = currentSubjects[i];
          const template = templateSubjsByName.get(normalizeSubjectName(existing.name));
          if (template) {
            const tYear = Number(template.yearIndex !== undefined ? template.yearIndex : ((template as any).year_index !== undefined ? (template as any).year_index : 1));
            const tSem = Number(template.semesterIndex !== undefined ? template.semesterIndex : ((template as any).semester_index !== undefined ? (template as any).semester_index : 1));
            const tHours = Number(template.creditHours !== undefined ? template.creditHours : ((template as any).credit_hours !== undefined ? (template as any).credit_hours : 3));
            const tMarks = Number(template.totalMarks !== undefined ? template.totalMarks : ((template as any).total_marks !== undefined ? (template as any).total_marks : 100));

            const tDists = template.distributions || [];
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
              existing.yearIndex !== tYear ||
              existing.semesterIndex !== tSem ||
              existing.creditHours !== tHours ||
              existing.totalMarks !== tMarks ||
              (template.code && existing.code !== template.code) ||
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
                yearIndex: tYear,
                semesterIndex: tSem,
                creditHours: tHours,
                totalMarks: tMarks,
                code: template.code || existing.code,
                distributions: syncedDists.length > 0 ? syncedDists : existing.distributions
              };
              currentSubjects[i] = updated;
              await db.updateSubject(userId, existing.id, updated);
              hasSubjectChanges = true;
            }
          }
        }

        // 3. Delete subjects removed from master template (only if student hasn't entered marks and not finished)
        const remainingSubjects: Subject[] = [];
        for (const existing of currentSubjects) {
          const normName = normalizeSubjectName(existing.name);
          const hasAchievedMarks = (existing.distributions || []).some(d => d.achievedMarks !== null && d.achievedMarks !== undefined && Number(d.achievedMarks) > 0);
          if (templateSubjs.length > 0 && !templateNames.has(normName) && !hasAchievedMarks && existing.status !== 'finished') {
            await db.deleteSubject(userId, existing.id);
            hasSubjectChanges = true;
          } else {
            remainingSubjects.push(existing);
          }
        }
        if (hasSubjectChanges) {
          currentSubjects = remainingSubjects;
        }
      }

      // 3. Sync Drive Files
      if (matchedDb.driveFiles && Array.isArray(matchedDb.driveFiles)) {
        const templateFiles = matchedDb.driveFiles;
        const existingNames = new Set(currentFiles.map(f => f.name.trim().toLowerCase()));
        const templateNames = new Set(templateFiles.map(f => f.name.trim().toLowerCase()));

        // A. Add new drive files from template
        for (const tFile of templateFiles) {
          const tName = tFile.name.trim().toLowerCase();
          if (!existingNames.has(tName)) {
            const newF: DriveFile = {
              id: uuidv4(),
              name: tFile.name,
              size: Number(tFile.size || 0),
              type: tFile.type || 'file',
              parentId: null,
              createdAt: tFile.createdAt || new Date().toISOString(),
              url: tFile.url || '',
              b2FileId: tFile.b2FileId
            };
            currentFiles.push(newF);
            existingNames.add(tName);
            await db.addDriveFile(userId, newF);
            hasFileChanges = true;
          }
        }

        // B. Remove drive files that were deleted from template
        const remainingFiles: DriveFile[] = [];
        for (const f of currentFiles) {
          const fName = f.name.trim().toLowerCase();
          if (f.url && !templateNames.has(fName)) {
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
      }
      if (hasFileChanges) {
        set({ files: currentFiles });
      }
    } catch (e) {
      console.warn('syncWithUniversityDatabase error:', e);
    } finally {
      isSyncInProgress = false;
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
