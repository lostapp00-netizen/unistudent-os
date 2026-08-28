export type GradeRule = {
  id: string;
  letter: string; // e.g., A+
  nameAr: string; // e.g., امتياز مرتفع
  nameEn: string; // e.g., High Distinction
  minPercentage: number;
  maxPercentage: number;
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
  groupId?: string;
  attachments?: EntityAttachment[];
};

export type UserSettings = {
  name: string;
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
  groupId?: string;
  attachments?: EntityAttachment[];
};

export type Group = {
  id: string;
  name: string;
  color?: string;
};
