import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { UserSettings, Subject, DriveFile, Note, Task, Appointment, ScheduleItem, Group, GraduationGradeRule, UniversityDatabase, AlternatingLecture } from '../types';
import { db, flushPendingWrites, matchDriveItemInDatabase, matchSubjectInDatabase } from '../lib/db';
import { normalizeSubjectName } from '../lib/academicTranslation';
import { matchesDriveItem, reconcileTemplateDriveFiles } from '../lib/utils';

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
  addAlternatingLecture: (pair: AlternatingLecture) => void;
  updateAlternatingLecture: (id: string, pair: Partial<AlternatingLecture>) => void;
  deleteAlternatingLecture: (id: string) => void;
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

// --- Deleted template-file tombstones ---
// Records template ids of drive items the user deleted on purpose, so the
// university-database sync never resurrects them (the "deleted folder comes
// back" bug). Per-device by design; survives sign-out.
function getDeletedTemplateFileIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`unistudent_deleted_template_files_${userId}`);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function addDeletedTemplateFileId(userId: string, templateId: string): void {
  try {
    const key = `unistudent_deleted_template_files_${userId}`;
    const raw = localStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(templateId)) {
      list.push(templateId);
      localStorage.setItem(key, JSON.stringify(list.slice(-5000)));
    }
  } catch {}
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

      // Replay any writes that failed on a previous session (DB hiccup /
      // transient RLS/schema issue) BEFORE reading, so retried rows show up
      // in this same load instead of appearing one refresh late.
      await flushPendingWrites(userId).catch((e) => console.warn('Pending writes flush failed:', e));

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
        email: email || settingsData?.email || localSettings.email || '',
        universityDatabaseId: settingsData?.universityDatabaseId || localSettings.universityDatabaseId || undefined,
        specializationDatabaseId: settingsData?.specializationDatabaseId || localSettings.specializationDatabaseId || undefined,
        specialization: (settingsData?.specialization && settingsData.specialization.trim()) ? settingsData.specialization : (localSettings.specialization || defaultSettings.specialization || ''),
        specializationStartYear: settingsData?.specializationStartYear ?? localSettings.specializationStartYear ?? defaultSettings.specializationStartYear,
        specializationStartSemester: settingsData?.specializationStartSemester ?? localSettings.specializationStartSemester ?? defaultSettings.specializationStartSemester,
        gradingScale: (settingsData?.gradingScale && settingsData.gradingScale.length > 0) ? settingsData.gradingScale : (localSettings.gradingScale && localSettings.gradingScale.length > 0 ? localSettings.gradingScale : defaultSettings.gradingScale),
        semesters: (settingsData?.semesters && settingsData.semesters.length > 0) ? settingsData.semesters : (localSettings.semesters && localSettings.semesters.length > 0 ? localSettings.semesters : defaultSettings.semesters)
      };

      try {
        localStorage.setItem(`unistudent_settings_${userId}`, JSON.stringify(mergedSettings));
      } catch {}

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

      // Database linking is EXPLICIT-ONLY (restore action). The database row is
      // the single source of truth for the link — a stale localStorage id must
      // never resurrect a link the student (or an unlink) already cleared.
      // Typing a university/college/specialization name must never create a
      // link, even when a database with the same names exists.

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

  // المحاضرات التبادلية: زوجان يتبادلان الظهور. تختفي واحدة ويظهر بدلها
  // التانية كل `intervalDays` بداية من `startDate`.
  addAlternatingLecture: (pair) => {
    const { settings, updateSettings } = get();
    updateSettings({ alternatingLectures: [...(settings.alternatingLectures || []), pair] });
  },

  updateAlternatingLecture: (id, changes) => {
    const { settings, updateSettings } = get();
    updateSettings({
      alternatingLectures: (settings.alternatingLectures || []).map(p => p.id === id ? { ...p, ...changes } : p)
    });
  },

  deleteAlternatingLecture: (id) => {
    const { settings, updateSettings } = get();
    updateSettings({ alternatingLectures: (settings.alternatingLectures || []).filter(p => p.id !== id) });
  },

  updateSettings: (newSettings) => {
    const { userId, userEmail, settings } = get();
    const oldGradingScale = settings.gradingScale;
    const updated = { ...settings, ...newSettings };
    set({ settings: updated });
    if (userId) {
      db.upsertSettings(userId, updated);
      if (
        newSettings.gradingScale && 
        Array.isArray(newSettings.gradingScale) && 
        newSettings.gradingScale.length > 0 &&
        JSON.stringify(newSettings.gradingScale) !== JSON.stringify(oldGradingScale)
      ) {
        checkAndNotifySourceUpdate(
          userId,
          userEmail,
          updated.name,
          'update_grading_scale',
          'تعديل جدول التقديرات الأكاديمي',
          { gradingScale: newSettings.gradingScale, previous: oldGradingScale }
        );
      }
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
      // Send the full merged subject, the previous subject snapshot, and changed fields
      checkAndNotifySourceUpdate(
        userId,
        userEmail,
        settings.name,
        'update_subject',
        `تعديل مادة: ${old.name}`,
        { ...old, ...updatedFields, previous: old },
        updatedFields
      );
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

      checkAndNotifySourceUpdate(
        userId,
        userEmail,
        settings.name,
        'delete_subject',
        `حذف مادة: ${old.name}`,
        {
          id,
          universityTemplateId: old.universityTemplateId,
          name: old.name,
          code: old.code,
          yearIndex: old.yearIndex,
          semesterIndex: old.semesterIndex
        }
      );
    }
  },

  addFile: (file) => {
    const { userId, userEmail, settings, files, subjects } = get();
    if (!userId) return;
    set((state) => ({ files: [...state.files, file] }));
    db.addDriveFile(userId, file);

    const parentName = file.parentId
      ? (files.find(f => f.id === file.parentId)?.name || '')
      : '';
    const subName = file.subjectId
      ? (subjects.find(s => s.id === file.subjectId)?.name || '')
      : '';

    checkAndNotifySourceUpdate(
      userId,
      userEmail,
      settings.name,
      'add_file',
      `رفع ملف إلى الدرايف: ${file.name}`,
      { ...file, parentName, subjectName: subName }
    );
  },
  updateFile: (id, updatedFields) => {
    const { userId, userEmail, settings, files, subjects } = get();
    if (!userId) return;
    const oldFile = files.find(f => f.id === id);
    set((state) => ({ files: state.files.map(f => f.id === id ? { ...f, ...updatedFields } : f) }));
    db.updateDriveFile(userId, id, updatedFields);

    if (oldFile) {
      const mergedFile = { ...oldFile, ...updatedFields };
      const parentName = mergedFile.parentId
        ? (files.find(f => f.id === mergedFile.parentId)?.name || '')
        : '';
      const oldParentName = oldFile.parentId
        ? (files.find(f => f.id === oldFile.parentId)?.name || '')
        : '';
      const subName = mergedFile.subjectId ? (subjects.find(s => s.id === mergedFile.subjectId)?.name || '') : '';
      const oldSubName = oldFile.subjectId ? (subjects.find(s => s.id === oldFile.subjectId)?.name || '') : '';
      const itemKind = mergedFile.type === 'folder' ? 'مجلد' : 'ملف';
      checkAndNotifySourceUpdate(
        userId,
        userEmail,
        settings.name,
        'update_file',
        `تعديل ${itemKind}: ${mergedFile.name}`,
        {
          ...mergedFile,
          parentName,
          subjectName: subName,
          previous: {
            ...oldFile,
            parentName: oldParentName,
            subjectName: oldSubName
          }
        },
        updatedFields
      );
    }
  },
  deleteFile: (id) => {
    const { userId, files, subjects, userEmail, settings } = get();
    if (!userId) return;
    const target = files.find(f => f.id === id);
    if (target) {
      const parentName = target.parentId ? (files.find(f => f.id === target.parentId)?.name || '') : '';
      const subName = target.subjectId ? (subjects.find(s => s.id === target.subjectId)?.name || '') : '';

      // Tombstone template-derived items: folder deletes call deleteFile() per
      // descendant, so the whole subtree gets recorded automatically and the
      // sync will never re-import them.
      if (target.universityTemplateId) {
        addDeletedTemplateFileId(userId, target.universityTemplateId);
      } else {
        // Only the student's OWN uploads own their B2 object. Template-derived
        // clones share the source's B2 object, so it must never be deleted.
        import('../lib/backblaze').then(({ deleteFromB2, extractB2KeyFromUrl }) => {
          const key = target.b2FileId || extractB2KeyFromUrl(target.url);
          if (key) {
            deleteFromB2(key).catch(console.error);
          }
        }).catch(console.error);
      }

      checkAndNotifySourceUpdate(
        userId,
        userEmail,
        settings.name,
        'delete_file',
        `حذف ملف من الدرايف: ${target.name}`,
        {
          id,
          universityTemplateId: target.universityTemplateId,
          name: target.name,
          type: target.type,
          url: target.url,
          b2FileId: target.b2FileId,
          parentId: target.parentId,
          parentName,
          subjectId: target.subjectId,
          subjectName: subName,
          yearIndex: target.yearIndex,
          semesterIndex: target.semesterIndex
        }
      );
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
      if (activeSyncPromise) await activeSyncPromise;
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
        // 3. Fallback: match general college database by university and college name.
        // STRUCTURE ANCHOR rows (no cohort metadata AND no subjects) are excluded:
        // they are admin-only holders and must never become a student's parent DB.
        if (!parentDb) {
          const allDbs = await db.getUniversityDatabases();
          const norm = (str?: string) => normalizeSubjectName(str);
          const normUni = norm(udb.universityNameAr);
          const isAnchor = (d: UniversityDatabase) => !d.cohortName && (d.subjects || []).length === 0;
          const exactParent = allDbs.find(d =>
            !d.isSpecialization &&
            d.id === udb.parentDatabaseId
          ) || null;
          parentDb = exactParent || allDbs.find(d =>
            !d.isSpecialization &&
            !isAnchor(d) &&
            norm(d.universityNameAr) === normUni &&
            (norm(d.collegeNameAr) && norm(udb.collegeNameAr).includes(norm(d.collegeNameAr)))
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

      // نظام الحساب المعتمد للجامعة/الكلية: التخصص أولاً (لو له نظام محدَّد)،
      // وبعده الكلية العامة. لو القاعدة مش محدِّدة نظام، بنسيب نظام الطالب زي ما هو.
      const systemSource = (specDb?.gradingSystem ? specDb : null) || (mainCollegeDb.gradingSystem ? mainCollegeDb : null);
      const dbGradingSystem = systemSource?.gradingSystem === 'points' || systemSource?.gradingSystem === 'gpa'
        ? systemSource.gradingSystem
        : undefined;

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

      if (dbGradingSystem) {
        updatedSettings.gradingSystem = dbGradingSystem;
        // قيمة النقطة والتوتال بتيجي مع القاعدة لما تكون بنظام النقط.
        if (dbGradingSystem === 'points') {
          const dbMarksPerPoint = Number(systemSource?.marksPerPoint || 0);
          const dbTotalPoints = Number(systemSource?.totalPoints || 0);
          if (dbMarksPerPoint > 0) updatedSettings.marksPerPoint = dbMarksPerPoint;
          if (dbTotalPoints > 0) updatedSettings.totalPoints = dbTotalPoints;
        }
      }

      if (specDb) {
        updatedSettings.specialization = specDb.specializationNameAr || specDb.specializationNameEn || '';
        updatedSettings.specializationDatabaseId = specDb.id;
      } else {
        // General College Restore: keep student's existing specialization if present
        if (settings.specialization) updatedSettings.specialization = settings.specialization;
        if (settings.specializationDatabaseId) updatedSettings.specializationDatabaseId = settings.specializationDatabaseId;
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
      const activePrev = existingSemesters.find(sm => sm.isCurrent);
      const activeYear = activePrev ? activePrev.yearIndex : 1;
      const activeSem = activePrev ? activePrev.semesterIndex : 1;

      const updatedSemesters: any[] = [];

      for (const y of targetYears) {
        for (let s = 1; s <= semY; s++) {
          const existing = existingSemesters.find(sm => sm.yearIndex === y && sm.semesterIndex === s);
          const isThisCurrent = (y === activeYear && s === activeSem);
          if (existing) {
            updatedSemesters.push({ ...existing, isCurrent: isThisCurrent });
          } else {
            updatedSemesters.push({
              id: uuidv4(),
              yearIndex: y,
              semesterIndex: s,
              startDate: '',
              endDate: '',
              isCurrent: isThisCurrent
            });
          }
        }
      }

      // Fallback: guarantee at least one semester is marked current
      if (!updatedSemesters.some(sm => sm.isCurrent) && updatedSemesters.length > 0) {
        updatedSemesters[0].isCurrent = true;
      }
      updatedSettings.semesters = updatedSemesters;

      set(state => ({ settings: { ...state.settings, ...updatedSettings } }));
      try {
        const currentLocalRaw = localStorage.getItem(`unistudent_settings_${userId}`);
        const currentLocal = currentLocalRaw ? JSON.parse(currentLocalRaw) : {};
        localStorage.setItem(`unistudent_settings_${userId}`, JSON.stringify({
          ...currentLocal,
          ...get().settings
        }));
      } catch {}
      await db.upsertSettings(userId, updatedSettings);

      // Non-Destructive Dual-Database Merging
      const currentSubjects = get().subjects || [];

      // Idempotency helpers: a subject that is already on the student's account
      // (by template id, or by name+year+semester when the student added it
      // personally) is NEVER re-imported and NEVER deleted — the student's copy
      // with its grades/status always wins.
      const existingTemplateIds = new Set(
        currentSubjects.map(s => s.universityTemplateId).filter(Boolean) as string[]
      );
      const existingSubjectKeys = new Set(
        currentSubjects.map(s => `${normalizeSubjectName(s.name)}-${Number(s.yearIndex || 1)}-${Number(s.semesterIndex || 1)}`)
      );
      const isNewTemplateSubject = (s: any) =>
        !(s.id && existingTemplateIds.has(s.id)) &&
        !existingSubjectKeys.has(`${normalizeSubjectName(s.name)}-${Number(s.yearIndex || 1)}-${Number(s.semesterIndex || 1)}`);

      if (specDb) {
        const startYear = Number(specDb.specializationStartYear || settings.specializationStartYear || 2);
        const startSem = Number(specDb.specializationStartSemester || settings.specializationStartSemester || 1);

        // 1. Foundation subjects: keep existing student foundation subjects 100% untouched!
        //    (personal AND previously-imported — a re-restore never deletes anything)
        const foundationSubjs = currentSubjects.filter(s => {
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
          newFoundationToInsert = collegeFoundation.filter(isNewTemplateSubject).map(s => ({
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
        }

        // 2. Idempotent specialization import: NOTHING is deleted. Existing
        //    template subjects keep the student's grades, personal subjects
        //    always stay, and only MISSING template subjects are imported.
        const newSpecSubjs: Subject[] = (specDb.subjects || []).filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          const inSpecPhase = y > startYear || (y === startYear && sem >= startSem);
          return inSpecPhase && isNewTemplateSubject(s);
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

        const finalSubjects = [...currentSubjects, ...newFoundationToInsert, ...newSpecSubjs];
        const { clean: deduped } = deduplicateSubjects(finalSubjects);
        set({ subjects: deduped });
        try {
          localStorage.setItem(`unistudent_subjects_${userId}`, JSON.stringify(deduped));
        } catch {}
      } else {
        // General College Restore: import MISSING foundation subjects while
        // preserving everything else — specialization courses, personal
        // subjects, and previously-imported template subjects with their
        // grades are never deleted or overwritten.
        const startYear = Number(mainCollegeDb.specializationStartYear || 2);
        const startSem = Number(mainCollegeDb.specializationStartSemester || 1);

        const newFoundationSubjs: Subject[] = (mainCollegeDb.subjects || []).filter(s => {
          const y = Number(s.yearIndex || 1);
          const sem = Number(s.semesterIndex || 1);
          const inFoundation = y < startYear || (y === startYear && sem < startSem);
          return inFoundation && isNewTemplateSubject(s);
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

        const finalSubjects = [...currentSubjects, ...newFoundationSubjs];
        const { clean: deduped } = deduplicateSubjects(finalSubjects);
        set({ subjects: deduped });
        try {
          localStorage.setItem(`unistudent_subjects_${userId}`, JSON.stringify(deduped));
        } catch {}
      }

      // Drive files: Non-destructive append & merge
      if (options?.importDrive !== false) {
        const incomingDriveFiles: DriveFile[] = specDb
          ? [...(mainCollegeDb?.driveFiles || []), ...(specDb.driveFiles || [])]
          : (mainCollegeDb?.driveFiles || []);

        if (incomingDriveFiles.length > 0) {
          const clonedFiles: DriveFile[] = [];
          const clonedTemplateIds = new Set<string>();
          const idMap = new Map<string, string>();
          const currentDriveSnapshot = [...(get().files || [])];

          // Parent-first (topological) clone: a folder is always resolved
          // before its children so idMap can link them. Dedup matches the
          // RESOLVED LOCAL parent (not the template parent id), so ancestor
          // folders shared between the college DB and the specialization DB
          // (different template ids by design) are reused instead of being
          // imported a second time.
          const byId = new Map(incomingDriveFiles.map(f => [f.id, f]));
          const inProgress = new Set<string>();
          const cloneFile = async (file: DriveFile): Promise<void> => {
            if (!file || clonedTemplateIds.has(file.id) || inProgress.has(file.id)) return;
            inProgress.add(file.id);

            if (file.parentId) {
              const parentObj = byId.get(file.parentId);
              if (parentObj) {
                await cloneFile(parentObj);
              }
            }

            clonedTemplateIds.add(file.id);
            const newParentId = file.parentId ? (idMap.get(file.parentId) || null) : null;

            // Exact template item already imported.
            const templateTwin = currentDriveSnapshot.find(f => f.universityTemplateId === file.id);
            if (templateTwin) {
              idMap.set(file.id, templateTwin.id);
              return;
            }

            // Same logical item already present under the resolved local
            // parent (same name, type, phase and identical content) — e.g. the
            // shared foundation folder chain that both databases contain.
            const twin = currentDriveSnapshot.find(f => matchesDriveItem(f, file, newParentId));
            if (twin) {
              idMap.set(file.id, twin.id);
              // The twin may sit at the root because its parent could not be
              // resolved on an earlier pull. Now that the parent is known, move
              // it into place instead of cloning the whole subtree again.
              if (newParentId && !twin.parentId) {
                twin.parentId = newParentId;
                await db.updateDriveFile(userId, twin.id, { parentId: newParentId }).catch(() => {});
              }
              return;
            }

            const newId = uuidv4();
            idMap.set(file.id, newId);

            // Map template subject ID to corresponding local restored subject ID
            let mappedSubjectId: string | undefined = undefined;
            if (file.subjectId) {
              const currentSubs = get().subjects || [];
              const matchingSub = currentSubs.find(s =>
                s.universityTemplateId === file.subjectId ||
                s.id === file.subjectId
              ) || currentSubs.find(s => {
                const allTemplateSubs = (mainCollegeDb?.subjects || []).concat(specDb?.subjects || []);
                const templateSub = allTemplateSubs.find(ts => ts.id === file.subjectId);
                if (templateSub) {
                  return normalizeSubjectName(s.name) === normalizeSubjectName(templateSub.name) &&
                         Number(s.yearIndex || 1) === Number(templateSub.yearIndex || 1) &&
                         Number(s.semesterIndex || 1) === Number(templateSub.semesterIndex || 1);
                }
                return false;
              });
              if (matchingSub) {
                mappedSubjectId = matchingSub.id;
              }
            }

            const cloned: DriveFile = {
              id: newId,
              universityTemplateId: file.id,
              name: file.name,
              size: file.size,
              type: file.type,
              parentId: newParentId,
              createdAt: file.createdAt || new Date().toISOString(),
              url: file.url,
              b2FileId: file.b2FileId,
              yearIndex: file.yearIndex,
              semesterIndex: file.semesterIndex,
              subjectId: mappedSubjectId || file.subjectId
            };
            clonedFiles.push(cloned);
            currentDriveSnapshot.push(cloned);
            await db.addDriveFile(userId, cloned);
          };

          for (const file of incomingDriveFiles) {
            await cloneFile(file);
          }

          // Heal what an EARLIER restore left behind: a copy of a folder whose
          // parent could not be resolved back then sits at the root next to the
          // real one, with the same files inside. Template-derived copies are
          // merged into one; personal items are never deleted.
          const afterClone = [...get().files, ...clonedFiles];
          const { files: healedDrive, moved, removedIds } = reconcileTemplateDriveFiles(afterClone, incomingDriveFiles);
          for (const id of removedIds) {
            await db.deleteDriveFile(userId, id).catch(() => {});
          }
          for (const move of moved) {
            await db.updateDriveFile(userId, move.id, { parentId: move.parentId }).catch(() => {});
          }

          if (clonedFiles.length > 0 || removedIds.length > 0 || moved.length > 0) {
            set({ files: healedDrive });
            try {
              localStorage.setItem(`unistudent_drive_files_${userId}`, JSON.stringify(healedDrive));
              localStorage.setItem(`unistudent_files_${userId}`, JSON.stringify(healedDrive));
            } catch {}
          }
        }
      }
    } finally {
      isImportInProgress = false;
    }
  },

  unlinkUniversityDatabase: async () => {
    const { userId, settings, subjects, files } = get();
    if (!userId) return;

    // Collect the template ids of every linked database (general + spec).
    // Only items derived from those templates are removed — everything the
    // student added personally (subjects, files, notes, tasks, schedule)
    // survives the unlink.
    const templateSubjectIds = new Set<string>();
    const templateFileIds = new Set<string>();
    const linkedDbIds = Array.from(new Set([
      settings.universityDatabaseId,
      settings.specializationDatabaseId
    ].filter(Boolean) as string[]));

    for (const dbId of linkedDbIds) {
      try {
        const udb = await db.getUniversityDatabase(dbId);
        if (udb) {
          (udb.subjects || []).forEach(s => { if (s.id) templateSubjectIds.add(s.id); });
          (udb.driveFiles || []).forEach(f => { if (f.id) templateFileIds.add(f.id); });
        }
      } catch {}
    }

    const remainingSubjects = subjects.filter(s => {
      const isTemplate = Boolean(s.universityTemplateId) || templateSubjectIds.has(s.id);
      if (isTemplate) {
        db.deleteSubject(userId, s.id).catch(() => {});
        return false;
      }
      return true;
    });

    const remainingFiles = files.filter(f => {
      const isTemplate = Boolean(f.universityTemplateId) || templateFileIds.has(f.id);
      if (isTemplate) {
        // Tombstone so a future re-link never re-imports what the student removed.
        if (f.universityTemplateId) addDeletedTemplateFileId(userId, f.universityTemplateId);
        // Never delete the B2 object — it belongs to the shared template.
        db.deleteDriveFile(userId, f.id).catch(() => {});
        return false;
      }
      return true;
    });

    // Names typed by the student stay untouched — only the database link is
    // cleared. The academic frame written at import time (grading scale,
    // milestone, year/semester totals and semester descriptors) is reset and
    // re-derived from the student's REMAINING personal subjects only.
    let maxYear = 0;
    let maxSem = 0;
    const coveredPairs = new Set<string>();
    for (const s of remainingSubjects) {
      const y = Math.max(1, Number(s.yearIndex || 1));
      const sem = Math.max(1, Number(s.semesterIndex || 1));
      if (y > maxYear) maxYear = y;
      if (sem > maxSem) maxSem = sem;
      coveredPairs.add(`${y}-${sem}`);
    }
    const existingSemestersList = settings.semesters || [];
    const personalSemesters = Array.from(coveredPairs)
      .map(pair => {
        const [y, sem] = pair.split('-').map(Number);
        const existing = existingSemestersList.find(sm => sm.yearIndex === y && sm.semesterIndex === sem);
        if (existing) return existing;
        return { id: uuidv4(), yearIndex: y, semesterIndex: sem, startDate: '', endDate: '', isCurrent: false };
      })
      .sort((a, b) => (a.yearIndex - b.yearIndex) || (a.semesterIndex - b.semesterIndex));
    if (personalSemesters.length > 0) personalSemesters[personalSemesters.length - 1].isCurrent = true;

    const updatedSettings: Partial<UserSettings> = {
      universityDatabaseId: undefined,
      specializationDatabaseId: undefined,
      specialization: '',
      deletedSubjectNames: [],
      gradingScale: [
        { id: '1', letter: 'A+', nameAr: 'امتياز مرتفع', nameEn: 'High Distinction', minPercentage: 97, maxPercentage: 100, points: 4.0 },
        { id: '2', letter: 'A', nameAr: 'امتياز', nameEn: 'Distinction', minPercentage: 93, maxPercentage: 96, points: 3.7 }
      ],
      specializationStartYear: undefined,
      specializationStartSemester: undefined,
      totalYears: maxYear > 0 ? maxYear : 4,
      semestersPerYear: maxSem > 0 ? maxSem : 2,
      semesters: personalSemesters
    };

    set(state => ({
      subjects: remainingSubjects,
      files: remainingFiles,
      settings: { ...state.settings, ...updatedSettings }
    }));

    try {
      localStorage.setItem(`unistudent_subjects_${userId}`, JSON.stringify(remainingSubjects));
      localStorage.setItem(`unistudent_files_${userId}`, JSON.stringify(remainingFiles));
      // Scrub link IDs and specialization from cached settings
      const savedRaw = localStorage.getItem(`unistudent_settings_${userId}`);
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw);
          delete parsed.universityDatabaseId;
          delete parsed.specializationDatabaseId;
          parsed.specialization = '';
          delete parsed.specializationStartYear;
          delete parsed.specializationStartSemester;
          parsed.semesters = personalSemesters;
          parsed.totalYears = maxYear > 0 ? maxYear : 4;
          parsed.semestersPerYear = maxSem > 0 ? maxSem : 2;
          localStorage.setItem(`unistudent_settings_${userId}`, JSON.stringify(parsed));
        } catch {}
      }
    } catch {}

    await db.upsertSettings(userId, {
      ...updatedSettings,
      universityDatabaseId: null as any,
      specializationDatabaseId: null as any,
      specialization: null as any,
      specializationStartYear: null as any,
      specializationStartSemester: null as any
    });
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

      if (isSpecTemplate || (!specDb && s.universityTemplateId && isSpecPhase)) {
        db.deleteSubject(userId, s.id).catch(() => {});
        return false;
      }
      return true;
    });

    // Filter out files that belong to specialization
    const remainingFiles = files.filter(f => {
      const isSpecPhase = Number(f.yearIndex) > specStartYr || (Number(f.yearIndex) === specStartYr && Number(f.semesterIndex) >= specStartSem);
      const isSpecFile = (f.universityTemplateId && specTemplateFileIds.has(f.universityTemplateId)) || specTemplateFileIds.has(f.id) || (!specDb && f.universityTemplateId && isSpecPhase);
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
      const savedRaw = localStorage.getItem(`unistudent_settings_${userId}`);
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw);
          delete parsed.specializationDatabaseId;
          parsed.specialization = '';
          if (repairedUniDbId) {
            parsed.universityDatabaseId = repairedUniDbId;
          } else {
            delete parsed.universityDatabaseId;
          }
          localStorage.setItem(`unistudent_settings_${userId}`, JSON.stringify(parsed));
        } catch {}
      }
    } catch {}

    await db.upsertSettings(userId, {
      ...updatedSettings,
      specializationDatabaseId: null as any,
      specialization: null as any
    });
  },

  syncWithUniversityDatabase: async () => {
    if (activeSyncPromise) {
      return activeSyncPromise;
    }

    activeSyncPromise = (async () => {
      const { userId, userEmail, settings } = get();
      if (!userId) return;

      try {
      // The database row is the ONLY source for the link. No localStorage
      // fallback — an unlink must stay unlinked on every subsequent boot.
      let targetDbId = settings.universityDatabaseId;

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
      }

      if (!matchedDb) {
        // If student had a universityDatabaseId, but no matching admin database exists anymore (deleted by admin),
        // unlink the university database completely and remove the template data!
        if (settings.universityDatabaseId || targetDbId) {
          await get().unlinkUniversityDatabase();
        }
        return;
      }

      // Self-Healing: If matchedDb is a specialization database, resolve its parent general college.
      if (matchedDb && matchedDb.isSpecialization) {
        let parentCollege: UniversityDatabase | null = null;
        if (matchedDb.parentDatabaseId) {
          parentCollege = await db.getUniversityDatabase(matchedDb.parentDatabaseId);
          if (!parentCollege) {
            const allDbs = await db.getUniversityDatabases();
            parentCollege = allDbs.find(d => !d.isSpecialization && d.id === matchedDb!.parentDatabaseId) || null;
          }
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

      if (targetSpecId && !specDb) {
        // Specialization was deleted by Admin: unlink specialization database and clean up its template data!
        await get().unlinkSpecializationDatabase();
      }

      const userEmailLower = (userEmail || settings.email || '').trim().toLowerCase();
      const isCollegeSource = Boolean(
        (matchedDb.sourceUserId && matchedDb.sourceUserId === userId) ||
        (matchedDb.sourceUserEmail && userEmailLower && matchedDb.sourceUserEmail.trim().toLowerCase() === userEmailLower)
      );
      const isSpecSource = Boolean(
        specDb && (
          (specDb.sourceUserId && specDb.sourceUserId === userId) ||
          (specDb.sourceUserEmail && userEmailLower && specDb.sourceUserEmail.trim().toLowerCase() === userEmailLower)
        )
      );

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
      const deletedTemplateFileIds = getDeletedTemplateFileIds(userId);
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

          // User deleted this template item on purpose — never resurrect it.
          if (deletedTemplateFileIds.has(tFile.id)) return;

          if (tFile.parentId) {
            const parentObj = templateById.get(tFile.parentId);
            if (parentObj) {
              await importTemplateFile(parentObj);
            }
          }

          const expectedParentId = tFile.parentId ? (templateToLocalId.get(tFile.parentId) || null) : null;
          const existingFile = currentFiles.find(f =>
            (f.universityTemplateId && f.universityTemplateId === tFile.id) ||
            matchesDriveItem(f, tFile, expectedParentId)
          );

          // Map template subject ID to corresponding local subject ID
          let mappedSubjectId: string | undefined = undefined;
          if (tFile.subjectId) {
            const currentSubs = currentSubjects || [];
            const matchingSub = currentSubs.find(s =>
              s.universityTemplateId === tFile.subjectId ||
              s.id === tFile.subjectId
            ) || currentSubs.find(s => {
              const allTemplateSubs = (matchedDb?.subjects || []).concat(specDb?.subjects || []);
              const templateSub = allTemplateSubs.find(ts => ts.id === tFile.subjectId);
              if (templateSub) {
                return normalizeSubjectName(s.name) === normalizeSubjectName(templateSub.name) &&
                       Number(s.yearIndex || 1) === Number(templateSub.yearIndex || 1) &&
                       Number(s.semesterIndex || 1) === Number(templateSub.semesterIndex || 1);
              }
              return false;
            });
            if (matchingSub) {
              mappedSubjectId = matchingSub.id;
            }
          }

          if (!existingFile) {
            const newF: DriveFile = {
              id: uuidv4(),
              universityTemplateId: tFile.id,
              name: tFile.name,
              size: Number(tFile.size || 0),
              type: tFile.type || 'file',
              parentId: expectedParentId,
              createdAt: tFile.createdAt || new Date().toISOString(),
              url: tFile.url || '',
              b2FileId: tFile.b2FileId,
              yearIndex: tFile.yearIndex,
              semesterIndex: tFile.semesterIndex,
              subjectId: mappedSubjectId || tFile.subjectId
            };
            currentFiles.push(newF);
            templateToLocalId.set(tFile.id, newF.id);
            await db.addDriveFile(userId, newF);
            hasFileChanges = true;
          } else {
            templateToLocalId.set(tFile.id, existingFile.id);

            const needUpdate =
              (tFile.url && existingFile.url !== tFile.url) ||
              (tFile.name && existingFile.name !== tFile.name) ||
              existingFile.universityTemplateId !== tFile.id ||
              (expectedParentId && !existingFile.parentId) ||
              (tFile.yearIndex !== undefined && existingFile.yearIndex !== tFile.yearIndex) ||
              (tFile.semesterIndex !== undefined && existingFile.semesterIndex !== tFile.semesterIndex) ||
              (mappedSubjectId && existingFile.subjectId !== mappedSubjectId);

            if (needUpdate) {
              if (tFile.url) existingFile.url = tFile.url;
              if (tFile.b2FileId) existingFile.b2FileId = tFile.b2FileId;
              if (tFile.name) existingFile.name = tFile.name;
              existingFile.universityTemplateId = tFile.id;
              // Re-attach an item that was left at the root because its parent
              // was unresolvable when it was first pulled.
              if (expectedParentId && !existingFile.parentId) existingFile.parentId = expectedParentId;
              if (tFile.yearIndex !== undefined) existingFile.yearIndex = tFile.yearIndex;
              if (tFile.semesterIndex !== undefined) existingFile.semesterIndex = tFile.semesterIndex;
              if (mappedSubjectId) existingFile.subjectId = mappedSubjectId;

              await db.updateDriveFile(userId, existingFile.id, {
                parentId: existingFile.parentId,
                url: existingFile.url,
                b2FileId: existingFile.b2FileId,
                name: existingFile.name,
                yearIndex: existingFile.yearIndex,
                semesterIndex: existingFile.semesterIndex,
                subjectId: existingFile.subjectId,
                universityTemplateId: tFile.id
              }).catch(() => {});
              hasFileChanges = true;
            }
          }
        };

        for (const tFile of combinedDriveFiles) {
          await importTemplateFile(tFile);
        }

        // Heal duplicates created by older restores: every template-derived row
        // is traced back to its template entry, re-attached to the local copy of
        // its template parent when it was left at the root, and merged with a
        // copy that already sits in the same place with the same files inside.
        // Personal items are never deleted — only re-parented when the folder
        // they lived in was merged away.
        const { files: healedFiles, moved, removedIds } = reconcileTemplateDriveFiles(currentFiles, combinedDriveFiles);
        for (const id of removedIds) {
          await db.deleteDriveFile(userId, id).catch(() => {});
          hasFileChanges = true;
        }
        for (const move of moved) {
          await db.updateDriveFile(userId, move.id, { parentId: move.parentId }).catch(() => {});
          hasFileChanges = true;
        }
        currentFiles = healedFiles;

        // Remove drive files ONLY if the user explicitly deleted them (tombstoned).
        // The old "delete if not in template" logic was too aggressive: it wiped
        // files whenever the sync ran with a stale/incomplete template snapshot
        // (e.g. during the race between accepting an update and Supabase propagating
        // the change). Tombstones (deletedTemplateFileIds) are set in deleteFile()
        // for template-derived items, so intentional deletions are still honoured.
        const remainingFiles: DriveFile[] = [];
        for (const f of currentFiles) {
          if (f.universityTemplateId && deletedTemplateFileIds.has(f.universityTemplateId)) {
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
        // Merge: the sync took a snapshot of files at start. If the user added
        // files while the sync was running, those are in get().files but NOT in
        // currentFiles. We must not clobber them.
        const syncedIds = new Set(currentFiles.map((f: DriveFile) => f.id));
        const addedDuringSync = get().files.filter((f: DriveFile) => !syncedIds.has(f.id));
        const finalFiles = [...currentFiles, ...addedDuringSync];
        set({ files: finalFiles });
        try {
          localStorage.setItem(`unistudent_drive_files_${userId}`, JSON.stringify(finalFiles));
          localStorage.setItem(`unistudent_files_${userId}`, JSON.stringify(finalFiles));
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

export async function checkAndNotifySourceUpdate(
  userId: string,
  userEmail: string | null,
  userName: string | undefined,
  type: 'add_subject' | 'update_subject' | 'delete_subject' | 'add_file' | 'update_file' | 'delete_file' | 'update_grading_scale',
  description: string,
  data: any,
  changedFields?: Record<string, any>
) {
  try {
    const storeState = useAppStore.getState();
    const effectiveUserId = (userId || storeState.userId || '').trim();
    let effectiveEmail = (userEmail || storeState.userEmail || storeState.settings?.email || '').trim().toLowerCase();
    if (!effectiveEmail && effectiveUserId) {
      try {
        effectiveEmail = (localStorage.getItem(`unistudent_user_email_${effectiveUserId}`) || '').trim().toLowerCase();
      } catch {}
    }
    const effectiveUserName = (userName || storeState.settings?.name || '').trim();

    if (!effectiveUserId && !effectiveEmail) return;

    // Only curriculum-relevant edits deserve an admin review. Personal study
    // data (achieved marks, study status, notes...) never generates updates.
    if (type === 'update_subject') {
      const CURRICULUM_FIELDS = [
        'name',
        'code',
        'creditHours',
        'totalMarks',
        'yearIndex',
        'semesterIndex',
        'distributions',
        'includeInGpa'
      ];
      const changedKeys = Object.keys(changedFields || data || {}).filter(k => k !== 'id');
      const hasCurriculumChange = changedKeys.some(k => CURRICULUM_FIELDS.includes(k));
      if (!hasCurriculumChange) {
        return;
      }
    }

    const uniDbs = await db.getUniversityDatabases();
    if (!uniDbs || uniDbs.length === 0) return;
    
    // Find all databases where this student is the registered source user
    // or actively enrolled and designated as source
    const sourceDbs = uniDbs.filter(u => {
      const sId = (u.sourceUserId || '').trim();
      const sEmail = (u.sourceUserEmail || '').trim().toLowerCase();

      const isIdMatch = Boolean(effectiveUserId && sId && sId === effectiveUserId);
      const isEmailMatch = Boolean(effectiveEmail && sEmail && sEmail === effectiveEmail);
      
      const isLinkedAsSource = Boolean(
        (u.id === storeState.settings.universityDatabaseId || u.id === storeState.settings.specializationDatabaseId) &&
        (isIdMatch || isEmailMatch || (!sId && !sEmail))
      );

      return isIdMatch || isEmailMatch || isLinkedAsSource;
    });

    if (sourceDbs.length === 0) return;

    // Separate into specialization, cohort, and college shell databases
    const enrolledCohortDb = sourceDbs.find(d => d.id === storeState.settings.universityDatabaseId);
    const enrolledSpecDb = sourceDbs.find(d => d.id === storeState.settings.specializationDatabaseId);

    const specDb = enrolledSpecDb || sourceDbs.find(d => d.isSpecialization);
    const cohortDbs = sourceDbs.filter(d => !d.isSpecialization && d.cohortName && d.cohortName.trim() !== '');
    const collegeShellDbs = sourceDbs.filter(d => !d.isSpecialization && (!d.cohortName || d.cohortName.trim() === ''));

    // The primary general cohort database (prefer enrolled DB, then cohort DB over empty college container)
    const primaryGeneralDb = enrolledCohortDb || (cohortDbs.length > 0 ? cohortDbs[0] : (collegeShellDbs.length > 0 ? collegeShellDbs[0] : null));

    // Get specialization milestone
    const startYr = Number(
      specDb?.specializationStartYear || 
      primaryGeneralDb?.specializationStartYear || 
      2
    );
    const startSm = Number(
      specDb?.specializationStartSemester || 
      primaryGeneralDb?.specializationStartSemester || 
      1
    );

    const isYearSpecific = data?.yearIndex !== undefined && Number(data.yearIndex) > 0;
    const y = Number(data?.yearIndex || 1);
    const sm = Number(data?.semesterIndex || 1);

    const isSpecAction = isYearSpecific && (y > startYr || (y === startYr && sm >= startSm));

    // Choose EXACTLY ONE single target database per action to prevent duplicate notifications:
    let targetDb: UniversityDatabase | null = null;
    if (isSpecAction && specDb) {
      targetDb = specDb;
    } else {
      targetDb = primaryGeneralDb || specDb || sourceDbs[0];
    }

    if (!targetDb) return;

    const uniName = targetDb.universityNameAr || targetDb.universityNameEn || storeState.settings.university || '';
    const colName = targetDb.collegeNameAr || targetDb.collegeNameEn || storeState.settings.college || '';
    
    // Resolve cohort name accurately (even if targetDb is a specialization)
    let cohortName = targetDb.cohortName ? targetDb.cohortName.trim() : '';
    if (!cohortName) {
      const parentCohort = uniDbs.find(d => 
        !d.isSpecialization && 
        d.cohortName && 
        d.cohortName.trim() !== '' &&
        ((d.sourceUserId && d.sourceUserId === effectiveUserId) || 
         (effectiveEmail && d.sourceUserEmail && d.sourceUserEmail.toLowerCase() === effectiveEmail) || 
         (targetDb && d.id === targetDb.parentDatabaseId))
      );
      if (parentCohort?.cohortName) {
        cohortName = parentCohort.cohortName.trim();
      }
    }

    const isSpec = Boolean(targetDb.isSpecialization);
    const specName = targetDb.specializationNameAr || targetDb.specializationNameEn || (isSpec ? storeState.settings.specialization : '') || '';
    const scopeLabel = isSpec ? `تخصص: ${specName}` : 'عام';

    let finalDescription = description;
    if (type === 'add_subject' && data?.name) {
      finalDescription = `إضافة مادة جديدة: ${data.name} (سنة ${data.yearIndex || 1} - ترم ${data.semesterIndex || 1}) • ${cohortName ? `${cohortName} • ` : ''}${scopeLabel}`;
    } else if (type === 'update_subject' && data?.name) {
      finalDescription = `تعديل مادة: ${data.name} (سنة ${data.yearIndex || 1} - ترم ${data.semesterIndex || 1}) • ${cohortName ? `${cohortName} • ` : ''}${scopeLabel}`;
    } else if (type === 'delete_subject' && data?.name) {
      finalDescription = `حذف مادة: ${data.name} (سنة ${data.yearIndex || 1} - ترم ${data.semesterIndex || 1}) • ${cohortName ? `${cohortName} • ` : ''}${scopeLabel}`;
    } else if (type === 'add_file' && data?.name) {
      const itemKind = data.type === 'folder' ? 'مجلد' : 'ملف';
      const yearTerm = (data.yearIndex && data.semesterIndex) ? ` (سنة ${data.yearIndex} - ترم ${data.semesterIndex})` : '';
      const subInfo = data.subjectName ? ` • مادة: ${data.subjectName}` : '';
      finalDescription = `إضافة ${itemKind} بالدرايف: ${data.name}${yearTerm}${subInfo} • ${cohortName ? `${cohortName} • ` : ''}${scopeLabel}`;
    } else if (type === 'update_file' && data?.name) {
      const itemKind = data.type === 'folder' ? 'مجلد' : 'ملف';
      const yearTerm = (data.yearIndex && data.semesterIndex) ? ` (سنة ${data.yearIndex} - ترم ${data.semesterIndex})` : '';
      const subInfo = data.subjectName ? ` • مادة: ${data.subjectName}` : '';
      finalDescription = `تعديل ${itemKind} بالدرايف: ${data.name}${yearTerm}${subInfo} • ${cohortName ? `${cohortName} • ` : ''}${scopeLabel}`;
    } else if (type === 'delete_file' && data?.name) {
      const itemKind = data.type === 'folder' ? 'مجلد' : 'ملف';
      finalDescription = `حذف ${itemKind} من الدرايف: ${data.name} • ${cohortName ? `${cohortName} • ` : ''}${scopeLabel}`;
    } else if (type === 'update_grading_scale') {
      const rulesCount = (data?.gradingScale && Array.isArray(data.gradingScale)) ? data.gradingScale.length : 0;
      finalDescription = `تعديل جدول التقديرات (${rulesCount} تقدير) • ${cohortName ? `${cohortName} • ` : ''}${scopeLabel}`;
    }

    // Pin the edited item to its row in the university database before the
    // update is recorded. Approving later then targets the exact same item
    // instead of guessing from names — the guess is what used to leave a
    // duplicate behind and make the original vanish.
    let resolvedData = data;
    try {
      if (data && (type === 'add_file' || type === 'update_file' || type === 'delete_file')) {
        // The item itself: for a brand-new upload there is no template row yet
        // (the item IS the new content), so nothing is pinned — but the FOLDER it
        // lives in must be pinned, otherwise "Lectures" matches a "Lectures" of a
        // different subject and the file is filed under the wrong course.
        const item = type === 'add_file' ? null : matchDriveItemInDatabase(targetDb, data);
        const localFiles: any[] = storeState.files || [];
        const parentLocalId = data.parentId !== undefined ? data.parentId : data.previous?.parentId;
        const parentLocal = parentLocalId ? localFiles.find((f: any) => f.id === parentLocalId) : undefined;
        const parentTemplate = parentLocal
          ? matchDriveItemInDatabase(targetDb, { ...parentLocal, parentName: data.parentName })
          : null;

        const parentTemplateId = item?.parentId || parentTemplate?.id || null;

        resolvedData = {
          ...data,
          ...(item ? { universityTemplateId: item.id } : {}),
          ...(parentTemplateId ? { parentTemplateId } : {}),
          ...(item?.subjectId ? { subjectTemplateId: item.subjectId } : {})
        };
      } else if (data && (type === 'update_subject' || type === 'delete_subject')) {
        const subject = matchSubjectInDatabase(targetDb, data);
        if (subject) {
          resolvedData = { ...data, universityTemplateId: subject.id };
        }
      }
    } catch (resolveErr) {
      console.warn('checkAndNotifySourceUpdate: could not pin item identity', resolveErr);
    }

    // Record which fields the student actually changed. The approval step uses
    // this to tell a rename apart from a real move: a rename must keep the
    // admin's placement (folder/year/semester), a move must follow the student.
    if (resolvedData && changedFields && typeof changedFields === 'object' && !Array.isArray(changedFields)) {
      resolvedData = { ...resolvedData, changedFields: Object.keys(changedFields) };
    }

    await db.recordPendingUpdate({
      id: uuidv4(),
      universityDatabaseId: targetDb.id,
      universityName: uniName,
      collegeName: colName,
      cohortName: cohortName,
      isSpecialization: isSpec,
      specializationName: specName,
      parentCollegeName: colName,
      scopeType: isSpec ? 'specialization' : 'general',
      sourceUserId: effectiveUserId,
      sourceUserEmail: effectiveEmail || targetDb.sourceUserEmail || '',
      sourceUserName: effectiveUserName || targetDb.sourceUserName || '',
      type,
      description: finalDescription,
      data: resolvedData,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Error in checkAndNotifySourceUpdate:', e);
  }
}
