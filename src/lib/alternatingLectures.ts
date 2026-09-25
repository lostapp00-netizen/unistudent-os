import type { AlternatingLecture } from '../types';

// ---------------------------------------------------------------------------
// المحاضرات التبادلية — logic
// ---------------------------------------------------------------------------
// A pair of lectures takes turns: from `startDate` the two swap every
// `intervalDays`, beginning with `startItemId`. Before `startDate` both are
// visible, and removing the pair restores both immediately.

/** Parse 'yyyy-MM-dd' (or a Date) as a local calendar date at midnight. */
export function toCalendarDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Whole days between two calendar dates (ignores time and DST shifts). */
export function daysBetween(from: Date, to: Date): number {
  const a = toCalendarDate(from).getTime();
  const b = toCalendarDate(to).getTime();
  return Math.round((b - a) / 86400000);
}

/** Which of the pair is visible on a given date, or null when both are. */
export function resolveAlternatingVisibility(
  pair: AlternatingLecture,
  date: string | Date
): { visibleId: string; hiddenId: string } | null {
  if (!pair || !pair.active) return null;
  if (!pair.itemAId || !pair.itemBId || pair.itemAId === pair.itemBId) return null;

  const interval = Number(pair.intervalDays);
  if (!Number.isFinite(interval) || interval < 1) return null;

  const start = toCalendarDate(pair.startDate);
  if (Number.isNaN(start.getTime())) return null;

  const target = toCalendarDate(date);
  if (Number.isNaN(target.getTime())) return null;

  const elapsed = daysBetween(start, target);
  // Before the start date the pair is not swapping yet: both stay visible.
  if (elapsed < 0) return null;

  const first = pair.startItemId === pair.itemBId ? pair.itemBId : pair.itemAId;
  const second = first === pair.itemAId ? pair.itemBId : pair.itemAId;

  const cycle = Math.floor(elapsed / interval);
  const visibleId = cycle % 2 === 0 ? first : second;
  const hiddenId = visibleId === pair.itemAId ? pair.itemBId : pair.itemAId;

  return { visibleId, hiddenId };
}

/**
 * Should this schedule item be hidden on this date? An item is hidden only when
 * an active pair names it as the one that is currently standing down.
 */
export function isItemHiddenOnDate(
  itemId: string,
  date: string | Date,
  pairs?: AlternatingLecture[]
): boolean {
  if (!pairs || pairs.length === 0) return false;
  for (const pair of pairs) {
    if (!pair || !pair.active) continue;
    if (pair.itemAId !== itemId && pair.itemBId !== itemId) continue;
    const resolved = resolveAlternatingVisibility(pair, date);
    if (resolved && resolved.hiddenId === itemId) return true;
  }
  return false;
}

/** The pair an item belongs to, if any. */
export function findPairForItem(
  itemId: string,
  pairs?: AlternatingLecture[]
): AlternatingLecture | undefined {
  return (pairs || []).find(p => p && (p.itemAId === itemId || p.itemBId === itemId));
}

/** The next date this item becomes visible, for a "next swap" hint. */
export function nextVisibleDate(
  itemId: string,
  pair: AlternatingLecture,
  from: string | Date
): Date | null {
  if (!pair || !pair.active) return null;
  const interval = Number(pair.intervalDays);
  if (!Number.isFinite(interval) || interval < 1) return null;
  const start = toCalendarDate(pair.startDate);
  if (Number.isNaN(start.getTime())) return null;

  const cursor = toCalendarDate(from);
  const searchEnd = new Date(cursor);
  searchEnd.setDate(searchEnd.getDate() + interval * 2 + 1);

  for (let day = cursor; day <= searchEnd; day.setDate(day.getDate() + 1)) {
    const resolved = resolveAlternatingVisibility(pair, day);
    if (resolved && resolved.visibleId === itemId) {
      return new Date(day.getFullYear(), day.getMonth(), day.getDate());
    }
  }
  return null;
}

/** Human-readable label for an interval, e.g. 7 -> "كل أسبوع". */
export function describeInterval(intervalDays: number, isAr: boolean): string {
  const days = Number(intervalDays);
  if (days === 1) return isAr ? 'كل يوم' : 'Every day';
  if (days === 7) return isAr ? 'كل أسبوع' : 'Every week';
  if (days === 14) return isAr ? 'كل أسبوعين' : 'Every 2 weeks';
  if (days === 30) return isAr ? 'كل شهر' : 'Every month';
  return isAr ? `كل ${days} يوم` : `Every ${days} days`;
}
