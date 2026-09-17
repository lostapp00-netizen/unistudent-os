import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DriveFile } from '../types';

export function selectAcademicDriveFiles(
  files: Array<DriveFile | Record<string, any>>,
  structure: { specializationStartYear?: number; specializationStartSemester?: number; totalYears?: number; semestersPerYear?: number },
  isSpecialization: boolean,
  createId: () => string = () => crypto.randomUUID()
): DriveFile[] {
  const normalized: DriveFile[] = files.filter(Boolean).map(f => ({
    id: String(f.id),
    name: f.name || '',
    size: Number(f.size || 0),
    type: f.type || 'file',
    parentId: f.parentId || ('parent_id' in f ? f.parent_id : null) || null,
    createdAt: f.createdAt || ('upload_date' in f ? f.upload_date : '') || new Date().toISOString(),
    url: f.url || '',
    b2FileId: f.b2FileId || ('b2_file_id' in f ? f.b2_file_id : undefined),
    yearIndex: Number(f.yearIndex ?? ('year_index' in f ? f.year_index : undefined)),
    semesterIndex: Number(f.semesterIndex ?? ('semester_index' in f ? f.semester_index : undefined))
  }));
  const startYear = Number(structure.specializationStartYear || 2);
  const startSemester = Number(structure.specializationStartSemester || 1);
  const selected = normalized.filter(f => {
    const year = f.yearIndex;
    const semester = f.semesterIndex;
    if (!Number.isInteger(year) || year < 1 || year > (structure.totalYears || 4) ||
        !Number.isInteger(semester) || semester < 1 || semester > (structure.semestersPerYear || 2)) return false;
    const inSpecialization = year > startYear || (year === startYear && semester >= startSemester);
    return inSpecialization === isSpecialization;
  });
  const byId = new Map(normalized.map(f => [f.id, f]));
  const included = new Map(selected.map(f => [f.id, f]));
  for (const file of selected) {
    const visited = new Set([file.id]);
    let parentId = file.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent || parent.type !== 'folder') break;
      included.set(parent.id, parent);
      parentId = parent.parentId;
    }
  }
  const idMap = new Map(Array.from(included.keys(), id => [id, createId()]));
  return Array.from(included.values(), f => {
    let parentId = f.parentId;
    const visited = new Set([f.id]);
    let ancestorId = parentId;
    while (ancestorId) {
      if (visited.has(ancestorId) || included.get(ancestorId)?.type !== 'folder') {
        parentId = null;
        break;
      }
      visited.add(ancestorId);
      ancestorId = included.get(ancestorId)?.parentId || null;
    }
    return {
      ...f,
      id: idMap.get(f.id)!,
      parentId: parentId ? idMap.get(parentId)! : null,
      yearIndex: Number.isInteger(f.yearIndex) && f.yearIndex > 0 ? f.yearIndex : undefined,
      semesterIndex: Number.isInteger(f.semesterIndex) && f.semesterIndex > 0 ? f.semesterIndex : undefined
    };
  });
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

