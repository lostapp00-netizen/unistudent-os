import { ProductivityFilterState } from '../components/productivity/ProductivityFilter';

export function isDateMatchingFilter(
  dateString: string | undefined, 
  filter: ProductivityFilterState, 
  currentSemester: { startDate: string; endDate: string } | undefined
): boolean {
  if (filter.type === 'all') return true;
  if (!dateString) return false;
  
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return false; // Invalid date

  if (filter.type === 'today') {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  } 
  
  if (filter.type === 'month') {
    const today = new Date();
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  } 
  
  if (filter.type === 'semester' && currentSemester) {
    const sStart = new Date(currentSemester.startDate);
    const sEnd = new Date(currentSemester.endDate);
    return d >= sStart && d <= sEnd;
  }
  
  if (filter.type === 'custom') {
    if (filter.from && d < new Date(filter.from)) return false;
    if (filter.to && d > new Date(filter.to)) return false;
    return true;
  }

  return true;
}
