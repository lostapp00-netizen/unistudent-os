import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DriveFile } from '../types';

export function selectAcademicDriveFiles(
  files: Array<DriveFile | Record<string, any>>,
  structure: { specializationStartYear?: number; specializationStartSemester?: number; totalYears?: number; semestersPerYear?: number },
  isSpecialization: boolean,
  createId: () => string = () => crypto.randomUUID(),
  subjectIdMap?: Map<string, string>
): DriveFile[] {
  if (!files || !Array.isArray(files) || files.length === 0) return [];

  const parseNum = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    const n = Number(val);
    return !isNaN(n) && n > 0 ? n : undefined;
  };

  const normalized: DriveFile[] = files.filter(Boolean).map(f => ({
    id: String(f.id || createId()),
    name: f.name || '',
    size: Number(f.size || 0),
    type: f.type || 'file',
    parentId: f.parentId || ('parent_id' in f ? f.parent_id : null) || null,
    createdAt: f.createdAt || ('upload_date' in f ? f.upload_date : '') || new Date().toISOString(),
    url: f.url || '',
    b2FileId: f.b2FileId || ('b2_file_id' in f ? f.b2_file_id : undefined),
    yearIndex: parseNum(f.yearIndex !== undefined ? f.yearIndex : ('year_index' in f ? f.year_index : undefined)),
    semesterIndex: parseNum(f.semesterIndex !== undefined ? f.semesterIndex : ('semester_index' in f ? f.semester_index : undefined)),
    subjectId: f.subjectId || ('subject_id' in f ? f.subject_id : undefined)
  }));

  const startYear = Number(structure.specializationStartYear || 2);
  const startSemester = Number(structure.specializationStartSemester || 1);

  // Determine if a file or folder belongs to the specialization phase
  const isSpecializationItem = (f: DriveFile): boolean => {
    // 1. If linked to a subject mapped in the current pull map
    if (f.subjectId && subjectIdMap && subjectIdMap.has(f.subjectId)) {
      return isSpecialization;
    }
    // 2. If year and semester are explicitly set
    if (f.yearIndex !== undefined && f.yearIndex > 0) {
      const y = f.yearIndex;
      const sem = f.semesterIndex || 1;
      return y > startYear || (y === startYear && sem >= startSemester);
    }
    // 3. Unassigned / general files belong to general cohort database
    return false;
  };

  const byId = new Map(normalized.map(f => [f.id, f]));
  const included = new Map<string, DriveFile>();

  // 1. Add matching files
  normalized.forEach(f => {
    if (f.type === 'file') {
      const itemIsSpec = isSpecializationItem(f);
      if (isSpecialization ? itemIsSpec : !itemIsSpec) {
        included.set(f.id, f);
      }
    }
  });

  // 2. Add matching folders or general folders
  normalized.forEach(f => {
    if (f.type === 'folder') {
      if (f.yearIndex !== undefined && f.yearIndex > 0) {
        const folderIsSpec = (f.yearIndex > startYear || (f.yearIndex === startYear && (f.semesterIndex || 1) >= startSemester));
        if (folderIsSpec === isSpecialization) {
          included.set(f.id, f);
        }
      } else if (!isSpecialization) {
        // General unassigned folders belong to general cohort database
        included.set(f.id, f);
      }
    }
  });

  // 3. Ensure all parent ancestor folders of included items are also included
  for (const item of Array.from(included.values())) {
    let parentId = item.parentId;
    const visited = new Set<string>([item.id]);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      included.set(parent.id, parent);
      parentId = parent.parentId;
    }
  }

  // 4. Map IDs to fresh IDs and remap parentId & subjectId
  const idMap = new Map(Array.from(included.keys(), id => [id, createId()]));

  return Array.from(included.values(), f => {
    let parentId = f.parentId;
    if (parentId && !included.has(parentId)) {
      parentId = null;
    }
    const mappedSubjectId = f.subjectId ? (subjectIdMap?.get(f.subjectId) || f.subjectId) : undefined;
    return {
      ...f,
      id: idMap.get(f.id) || createId(),
      parentId: parentId ? (idMap.get(parentId) || null) : null,
      yearIndex: f.yearIndex,
      semesterIndex: f.semesterIndex,
      subjectId: mappedSubjectId
    };
  });
}

export function matchesDriveItem(file: DriveFile, template: DriveFile, parentId: string | null): boolean {
  if ((file.parentId || null) !== parentId || file.type !== template.type ||
      file.name.trim().toLowerCase() !== template.name.trim().toLowerCase()) return false;
  if (Number(file.yearIndex || 0) !== Number(template.yearIndex || 0) ||
      Number(file.semesterIndex || 0) !== Number(template.semesterIndex || 0)) return false;
  if (file.type === 'folder') return true;
  return Boolean((file.b2FileId && file.b2FileId === template.b2FileId) ||
    (file.url && file.url === template.url));
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Cohorts (الدفعات الدراسية) helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a name for group-key comparisons (college / university names).
 * Trim, lowercase, collapse whitespace, strip Arabic tatweel and diacritics.
 */
export function normalizeGroupName(value?: string | null): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Stable group key identifying one college (inside one university) across all
 * its cohort database rows. Display-grouping only — data linking stays id-based.
 */
export function collegeGroupKey(
  universityNameAr?: string | null,
  universityNameEn?: string | null,
  collegeNameAr?: string | null,
  collegeNameEn?: string | null
): string {
  const uni = normalizeGroupName(universityNameAr) || normalizeGroupName(universityNameEn) || 'unknown-university';
  const col = normalizeGroupName(collegeNameAr) || normalizeGroupName(collegeNameEn) || 'unknown-college';
  return `${uni}::${col}`;
}

/** Current academic year range — the academic year starts in August. */
export function currentAcademicYearRange(): { start: number; end: number } {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return { start, end: start + 1 };
}

/** Auto cohort name for a given academic year range, e.g. 'دفعة 2026 - 2027'. */
export function autoCohortName(start?: number, end?: number): string {
  const range = start && end ? { start, end } : currentAcademicYearRange();
  return `دفعة ${range.start} - ${range.end}`;
}

/** Cohort display label with the academic year, e.g. 'دفعة 2026 - 2027 • سنة دراسية 2026 - 2027'. */
export function cohortLabel(
  cohort: { cohortName?: string; academicYearStart?: number; academicYearEnd?: number } | null | undefined,
  isAr: boolean = true
): string {
  const name = cohort?.cohortName?.trim() || (isAr ? 'الدفعة الحالية' : 'Current Cohort');
  if (cohort?.academicYearStart && cohort?.academicYearEnd) {
    return isAr
      ? `${name} • سنة دراسية ${cohort.academicYearStart} - ${cohort.academicYearEnd}`
      : `${name} • Academic year ${cohort.academicYearStart} - ${cohort.academicYearEnd}`;
  }
  return name;
}

/** Number of general/foundation subjects (before the specialization milestone). */
export function foundationSubjectsCount(db: {
  subjects?: Array<{ yearIndex?: number; semesterIndex?: number }>;
  specializationStartYear?: number;
  specializationStartSemester?: number;
}): number {
  const startYear = Number(db.specializationStartYear || 2);
  const startSem = Number(db.specializationStartSemester || 1);
  return (db.subjects || []).filter(s => {
    const y = Number(s.yearIndex || 1);
    const sem = Number(s.semesterIndex || 1);
    return y < startYear || (y === startYear && sem < startSem);
  }).length;
}

/**
 * Safely format date and time without throwing Invalid option: timeStyle errors
 */
export function formatDateTime(dateInput: string | number | Date | null | undefined, isAr: boolean = true): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(isAr ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    try {
      return new Date(dateInput as any).toLocaleDateString();
    } catch {
      return String(dateInput);
    }
  }
}

/**
 * Helper to get Arabic/English academic evaluation (تقدير عام) based on CGPA
 */
export function getAcademicEvaluation(cgpa: number, isAr: boolean = true): string {
  if (cgpa >= 3.65) return isAr ? 'امتياز مع مرتبة الشرف' : 'Excellent with Honors';
  if (cgpa >= 3.5) return isAr ? 'امتياز' : 'Excellent';
  if (cgpa >= 3.0) return isAr ? 'جيد جداً' : 'Very Good';
  if (cgpa >= 2.5) return isAr ? 'جيد' : 'Good';
  if (cgpa >= 2.0) return isAr ? 'مقبول' : 'Pass';
  if (cgpa > 0) return isAr ? 'ضعيف (إنذار)' : 'Weak / Warning';
  return isAr ? 'غير محدد' : 'N/A';
}

