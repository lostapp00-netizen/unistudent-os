import { ProductivityFilterState } from '../components/productivity/ProductivityFilter';
import { SemesterInfo, Subject } from '../types';

/**
 * Checks whether an item (Task, Note, Appointment, ScheduleItem, etc.) matches the selected semester & year filter.
 * 
 * Rules:
 * 1. If no filter is applied (all years and terms selected) -> Returns true.
 * 2. If the item is linked to a subject belonging to the selected year & semester -> Returns true.
 * 3. If the item has a date, checks if that date falls between the startDate and endDate (inclusive)
 *    of ANY semester that matches the active filter in Settings.
 * 4. If the item has a date or linked subjects, but does NOT match the active filter -> Returns false.
 * 5. If the item has neither date nor linked subjects -> Returns true.
 */
export function isItemMatchingSemesterFilter(
  itemDate: string | undefined,
  linkedSubjectIds: string[] | undefined,
  filterYears: number[],
  filterSemesters: number[],
  allSemesters: SemesterInfo[] = [],
  allSubjects: { id: string; yearIndex: number; semesterIndex: number }[] = []
): boolean {
  // If no year and no semester is selected -> All items match
  if (filterYears.length === 0 && filterSemesters.length === 0) {
    return true;
  }

  // 1. Check matching linked subjects
  if (linkedSubjectIds && linkedSubjectIds.length > 0 && allSubjects.length > 0) {
    const hasMatchingSubject = linkedSubjectIds.some(sid => {
      const sub = allSubjects.find(s => s.id === sid);
      if (!sub) return false;
      const yearMatch = filterYears.length === 0 || filterYears.includes(sub.yearIndex);
      const semMatch = filterSemesters.length === 0 || filterSemesters.includes(sub.semesterIndex);
      return yearMatch && semMatch;
    });

    if (hasMatchingSubject) return true;
  }

  // 2. Check date range against matching configured semesters
  if (itemDate && allSemesters && allSemesters.length > 0) {
    const cleanDate = itemDate.includes('T') ? itemDate.split('T')[0] : itemDate.trim();

    if (cleanDate && /^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      const matchingSemesters = allSemesters.filter(sem => {
        const yearMatch = filterYears.length === 0 || filterYears.includes(sem.yearIndex);
        const semMatch = filterSemesters.length === 0 || filterSemesters.includes(sem.semesterIndex);
        return yearMatch && semMatch;
      });

      const isInsideSemesterRange = matchingSemesters.some(sem => {
        if (!sem.startDate || !sem.endDate) return false;
        const start = sem.startDate.includes('T') ? sem.startDate.split('T')[0] : sem.startDate.trim();
        const end = sem.endDate.includes('T') ? sem.endDate.split('T')[0] : sem.endDate.trim();
        return cleanDate >= start && cleanDate <= end;
      });

      if (isInsideSemesterRange) return true;
    }
  }

  // If item has a date or linked subject, but neither matched the filter
  if (itemDate || (linkedSubjectIds && linkedSubjectIds.length > 0)) {
    return false;
  }

  // Fallback for items with no date and no linked subject
  return true;
}

export function isDateMatchingFilter(
  dateString: string | undefined, 
  filter: ProductivityFilterState, 
  currentSemester: { startDate: string; endDate: string } | undefined
): boolean {
  if (filter.type === 'all') return true;
  if (!dateString) return false;
  
  const cleanDate = dateString.includes('T') ? dateString.split('T')[0] : dateString;
  const d = new Date(cleanDate);
  if (isNaN(d.getTime())) return false; // Invalid date

  if (filter.type === 'today') {
    const today = new Date().toISOString().split('T')[0];
    return cleanDate === today;
  } 
  
  if (filter.type === 'month') {
    const today = new Date();
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  } 
  
  if (filter.type === 'semester' && currentSemester) {
    const sStart = currentSemester.startDate ? (currentSemester.startDate.includes('T') ? currentSemester.startDate.split('T')[0] : currentSemester.startDate) : '';
    const sEnd = currentSemester.endDate ? (currentSemester.endDate.includes('T') ? currentSemester.endDate.split('T')[0] : currentSemester.endDate) : '';
    if (sStart && sEnd) {
      return cleanDate >= sStart && cleanDate <= sEnd;
    }
    return true;
  }
  
  if (filter.type === 'custom') {
    if (filter.from && cleanDate < filter.from) return false;
    if (filter.to && cleanDate > filter.to) return false;
    return true;
  }

  return true;
}

