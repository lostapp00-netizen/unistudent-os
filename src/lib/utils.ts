import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

