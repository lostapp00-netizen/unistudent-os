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
  name: string;
  size: number;
  type: 'folder' | 'file';
  parentId: string | null;
  createdAt: string;
  url?: string;
  b2FileId?: string;
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

export type FeedbackSuggestion = {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  type: 'suggestion' | 'complaint' | 'bug' | 'other';
  title: string;
  content: string;
  attachments?: { id: string; name: string; size: number; type: string; url: string }[];
  createdAt: string;
  status: 'new' | 'reviewed' | 'resolved';
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
  sourceUserId: string;
  sourceUserEmail?: string;
  sourceUserName?: string;
  totalYears: number;
  semestersPerYear: number;
  availableYears?: number[];
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
  isSpecialization?: boolean;
  specializationName?: string;
  sourceUserId: string;
  sourceUserEmail?: string;
  sourceUserName?: string;
  type: 'add_subject' | 'update_subject' | 'delete_subject' | 'add_file' | 'update_file' | 'delete_file';
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
    university_databases?: any[];
    pending_updates?: any[];
  };
  summary: {
    totalStudents: number;
    totalSubjects: number;
    totalTasks: number;
    totalNotes: number;
    totalFiles: number;
    totalSuggestions: number;
    totalUniversityDatabases?: number;
  };
};

