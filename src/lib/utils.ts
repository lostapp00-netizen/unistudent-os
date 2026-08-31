import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

