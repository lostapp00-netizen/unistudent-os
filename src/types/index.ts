export type GradeRule = {
  id: string;
  letter: string; // e.g., A+
  nameAr: string; // e.g., امتياز مرتفع
  nameEn: string; // e.g., High Distinction
  minPercentage: number;
  maxPercentage: number;
  maxOperator?: '<' | '<='; // '<' means 'up to less than', '<=' means 'up to and including'
  points: number;
};

export type SemesterInfo = {
  id: string;
  yearIndex: number;
  semesterIndex: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export type GradeDistributionItem = {
  id: string;
  name: string;
  maxMarks: number;
  achievedMarks: number | null;
  status: 'current' | 'final'; // 'current' means editable/can be increased, 'final' means locked
};

export type Subject = {
  id: string;
  // Identifies the approved university-template subject this personal copy
  // came from. It lets future approved edits match even after a name changes.
  universityTemplateId?: string;
  code: string;
  name: string;
  creditHours: number;
  totalMarks: number;
  yearIndex: number;
  semesterIndex: number;
  distributions: GradeDistributionItem[];
  status?: 'current' | 'finished';
  finalGradeLetter?: string; // e.g. A, B+ (computed or manually overridden if no distributions)
  includeInGpa?: boolean; // toggle to manually exclude from GPA if needed
};

export type Priority = 'low' | 'medium' | 'high';

export type EntityAttachment = {
  id: string;
  name: string;
  size: number;
  url: string;
  b2FileId?: string;
};

export type DriveFile = {
  id: string;
  // Stable link to the source item in the approved university template.
  universityTemplateId?: string;
  // Original database row id this item was pulled from. Ids are regenerated on
  // every pull, so this is the only durable link back to the source row.
  originId?: string;
  name: string;
  size: number;
  type: 'folder' | 'file';
  parentId: string | null;
  createdAt: string;
  url?: string;
  b2FileId?: string;
  // Academic phase this file belongs to (drives general-vs-spec routing)
  yearIndex?: number;
  semesterIndex?: number;
  subjectId?: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  date: string;
  priority: Priority;
  linkedTaskIds?: string[];
  linkedFileIds?: string[];
  linkedSubjectIds?: string[];
  linkedAppointmentIds?: string[];
  linkedScheduleItemIds?: string[];
  groupId?: string;
  attachments?: EntityAttachment[];
};

export type Task = {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  isCompleted: boolean;
  priority: Priority;
  type: 'task' | 'event';
  linkedNoteIds?: string[];
  linkedFileIds?: string[];
  linkedSubjectIds?: string[];
  linkedAppointmentIds?: string[];
  linkedScheduleItemIds?: string[];
  groupId?: string;
  attachments?: EntityAttachment[];
};

export type GraduationGradeRule = {
  id: string;
  letter: string; // e.g. 'A+' or 'EX'
  nameAr: string; // e.g. 'ممتاز مع مرتبة الشرف'
  nameEn: string; // e.g. 'Excellent with Honors'
  minPercentage: number;
  maxPercentage: number;
  maxOperator?: '<' | '<=';
  minGpa: number; // e.g. 3.50
  maxGpa: number; // e.g. 4.00
  gpaOperator?: '<' | '<=';
};

export type UserSettings = {
  name: string;
  email?: string;
  university: string;
  college: string;
  enrollmentDate: string;
  totalYears: number;
  semestersPerYear: number;
  gradingScale: GradeRule[];
  semesters: SemesterInfo[];
  theme: 'light' | 'dark';
  language: 'ar' | 'en';
  initialCumulativeGpa?: number | null;
  initialCompletedCreditHours?: number | null;
  setupMode?: 'initial_gpa' | 'manual_subjects';
  /**
   * How the student's record is accounted for:
   *  - 'gpa'    → credit hours + grade points (the classic GPA).
   *  - 'points' → كل نقطة = `marksPerPoint` درجة، والتوتال = `totalPoints` نقطة.
   * Only the presentation/calculation changes; the marks in the distributions
   * are the single source of truth for both systems.
   */
  gradingSystem?: GradingSystem;
  /** Marks that make up one point in the points system (e.g. 12). */
  marksPerPoint?: number | null;
  /** The full points total the student is working towards. */
  totalPoints?: number | null;
  /** Marks already collected before using the app (points-system equivalent
   *  of initialCumulativeGpa + initialCompletedCreditHours). */
  initialAccumulatedMarks?: number | null;
  /** نقط إضافية حصل عليها الطالب: بتزوّد المجموع المُحصَّل، ومش بتغيّر التوتال. */
  bonusPoints?: BonusPointEntry[];
  warningGradeLetter?: string;
  warningGpaPoints?: number;
  enableGraduationScale?: boolean;
  graduationGradingScale?: GraduationGradeRule[];
  universityDatabaseId?: string;
  deletedSubjectNames?: string[];
  specialization?: string;
  specializationStartYear?: number;
  specializationStartSemester?: number;
  specializationDatabaseId?: string;
  alternatingLectures?: AlternatingLecture[];
};

/** Accounting system: GPA (ساعات معتمدة + نقاط) أو نظام النقط. */
export type GradingSystem = 'gpa' | 'points';

/**
 * نقط حصل عليها الطالب خارج درجات المواد (نقط بونص، أنشطة، درجات خارجية…).
 * بتتضاف على النقط المُحصَّلة، لكن **مش** بتغيّر التوتال الكلي المحدد في الإعدادات.
 */
export type BonusPointEntry = {
  id: string;
  /** عدد النقط المضافة. */
  points: number;
  /** سبب أو ملاحظة اختيارية (مثال: نقط بونص، نشاط). */
  note?: string;
  /** تاريخ الحصول عليها 'yyyy-MM-dd'. */
  date: string;
  createdAt: string;
};

export type Appointment = {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  priority: Priority;
  linkedNoteIds?: string[];
  linkedTaskIds?: string[];
  linkedFileIds?: string[];
  linkedSubjectIds?: string[];
  linkedAppointmentIds?: string[];
  linkedScheduleItemIds?: string[];
  groupId?: string;
  attachments?: EntityAttachment[];
  type?: string;
  location?: string;
  doctorName?: string;
  notes?: string;
  isCompleted?: boolean;
};

export type ScheduleItem = {
  id: string;
  subjectId: string;
  dayOfWeek: number; // 0-6 (0 = Sunday)
  startTime: string;
  endTime: string;
  location: string;
  type: 'lecture' | 'tutorial' | 'lab';
  instructor?: string;
  doctorName?: string;
  priority?: Priority;
  linkedNoteIds?: string[];
  linkedTaskIds?: string[];
  linkedFileIds?: string[];
  linkedAppointmentIds?: string[];
  linkedScheduleItemIds?: string[];
  groupId?: string;
  attachments?: EntityAttachment[];
};

export type Group = {
  id: string;
  name: string;
  color?: string;
};

/**
 * A pair of lectures that take turns appearing in the schedule. From
 * `startDate` onwards the two swap every `intervalDays`, starting with
 * `startItemId`; the other one stays hidden for that period.
 */
export type AlternatingLecture = {
  id: string;
  itemAId: string;
  itemBId: string;
  /** Which of the two shows first (must equal itemAId or itemBId). */
  startItemId: string;
  /** 'yyyy-MM-dd' — the day the swapping begins. */
  startDate: string;
  /** How often the two swap, in days (7 = every week). */
  intervalDays: number;
  active: boolean;
  createdAt: string;
};

export type FeedbackMessage = {
  id: string;
  sender: 'student' | 'admin';
  senderName?: string;
  senderEmail?: string;
  content: string;
  attachments?: { id: string; name: string; size: number; type: string; url: string; b2FileId?: string }[];
  createdAt: string;
};

export type FeedbackSuggestion = {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  type: 'suggestion' | 'complaint' | 'bug' | 'inquiry' | 'other';
  title: string;
  content: string;
  attachments?: { id: string; name: string; size: number; type: string; url: string; b2FileId?: string }[];
  createdAt: string;
  status: 'new' | 'reviewed' | 'resolved';
  messages?: FeedbackMessage[];
  closedAt?: string;
  closedBy?: 'student' | 'admin';
  adminNotes?: string;
};

export type EmailBackupConfig = {
  enabled: boolean;
  targetEmail: string;
  senderEmail?: string;
  appPassword?: string;
  frequency: 'thursday' | 'daily' | 'weekly' | 'monthly' | 'custom_hours';
  customHours?: number;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  lastSentAt?: string;
  status?: 'active' | 'paused' | 'error';
};

export type UniversityDatabase = {
  id: string;
  universityNameAr: string;
  universityNameEn: string;
  collegeNameAr: string;
  collegeNameEn: string;
  // Cohort (الدفعة الدراسية) metadata — set on general college rows only.
  // A cohort IS a full independent university_databases row; specialization
  // rows inherit their cohort from their parent via parentDatabaseId.
  cohortName?: string;          // e.g. 'دفعة 2026 - 2027'
  academicYearStart?: number;   // e.g. 2026
  academicYearEnd?: number;     // e.g. 2027
  cohortNotes?: string;
  sourceUserId: string;
  sourceUserEmail?: string;
  sourceUserName?: string;
  totalYears: number;
  semestersPerYear: number;
  availableYears?: number[];
  /**
   * نظام الحساب المعتمد للجامعة/الكلية: بيتسحب من الطالب المصدر وقت الإنشاء،
   * وبيتطبَّق على الطالب وقت الاسترداد، والأدمن يقدر يعدّله من قاعدة البيانات.
   */
  gradingSystem?: GradingSystem;
  /** كل نقطة بكام درجة (نظام النقط) على مستوى قاعدة البيانات. */
  marksPerPoint?: number | null;
  /** التوتال كام نقطة (نظام النقط) على مستوى قاعدة البيانات. */
  totalPoints?: number | null;
  subjects: Subject[];
  driveFiles: DriveFile[];
  gradingScale?: GradeRule[];
  isVisible?: boolean;
  isSpecialization?: boolean;
  parentDatabaseId?: string;
  specializationNameAr?: string;
  specializationNameEn?: string;
  specializationStartYear?: number;
  specializationStartSemester?: number;
  createdAt: string;
  updatedAt: string;
};

export type RegisteredUniversity = {
  key: string;
  nameAr: string;
  nameEn: string;
  isVisible?: boolean;
  createdAt: string;
};

export type UniversityPendingUpdate = {
  id: string;
  universityDatabaseId: string;
  universityName?: string;
  collegeName?: string;
  cohortName?: string;
  isSpecialization?: boolean;
  specializationName?: string;
  parentCollegeName?: string;
  scopeType?: 'general' | 'specialization';
  sourceUserId: string;
  sourceUserEmail?: string;
  sourceUserName?: string;
  type: 'add_subject' | 'update_subject' | 'delete_subject' | 'add_file' | 'update_file' | 'delete_file' | 'update_grading_scale';
  description: string;
  data: any;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
};

export type DatabaseBackup = {
  version: string;
  timestamp: string;
  environment: string;
  /** What this snapshot contains — lets an old backup be recognised as partial. */
  includedTables?: string[];
  data: {
    settings: any[];
    subjects: any[];
    tasks: any[];
    notes: any[];
    appointments: any[];
    schedule_items: any[];
    groups: any[];
    drive_files: any[];
    suggestions: any[];
    /** قواعد بيانات الجامعات/الكليات/الدفعات/التخصصات — تشمل نظام الحساب لكل قاعدة. */
    university_databases?: any[];
    /** طلبات التعديل المعتمدة/المعلّقة على قواعد البيانات. */
    university_pending_updates?: any[];
    /** legacy alias kept so old backups still import */
    pending_updates?: any[];
    /** الجامعات المسجّلة على المنصة. */
    registered_universities?: any[];
    /** روابط الطلاب بقواعد البيانات المصدر. */
    database_restore_links?: any[];
    /** حسابات الدخول (من الـ Edge Function بالـ service role) — للقراءة فقط. */
    auth_users?: any[];
  };
  summary: {
    totalStudents: number;
    totalSubjects: number;
    totalTasks: number;
    totalNotes: number;
    totalFiles: number;
    totalSuggestions: number;
    totalUniversityDatabases?: number;
    totalPendingUpdates?: number;
    totalRegisteredUniversities?: number;
    totalRestoreLinks?: number;
    totalAuthUsers?: number;
    totalAppointments?: number;
    totalSchedule?: number;
    totalGroups?: number;
  };
};

