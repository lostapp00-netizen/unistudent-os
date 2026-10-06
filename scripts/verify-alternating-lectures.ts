/**
 * Behaviour checks for the alternating lectures and the 12-hour clock.
 *
 * Alternating lectures: two lectures take turns appearing in the schedule from
 * a start date, swapping every N days. Before the start date both stay visible,
 * pausing a pair brings both back, and a lecture that is in no pair is never
 * touched. Times stay stored as 24-hour "HH:mm" everywhere — only the display
 * and the pickers use 12-hour form.
 *
 * Run:
 *   npx tsx scripts/verify-alternating-lectures.ts
 */
import {
  resolveAlternatingVisibility,
  isItemHiddenOnDate,
  nextVisibleDate,
  describeInterval,
  daysBetween,
  toCalendarDate
} from '../src/lib/alternatingLectures';
import { formatTime12, formatTimeRange12, to24HourTime, parseTimeToParts } from '../src/lib/utils';
import type { AlternatingLecture } from '../src/types';

let failures = 0;
function check(label: string, condition: boolean, extra?: any) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}`, extra !== undefined ? JSON.stringify(extra) : '');
  }
}

/** A weekly pair starting 2026-10-01 with lecture A showing first. */
function pair(overrides: Partial<AlternatingLecture> = {}): AlternatingLecture {
  return {
    id: 'alt-1',
    itemAId: 'lec-a',
    itemBId: 'lec-b',
    startItemId: 'lec-a',
    startDate: '2026-10-01',
    intervalDays: 7,
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides
  };
}

console.log('\n1) Before the start date both lectures stay visible');
{
  const weeks = [pair()];
  check('resolve is null before the start', resolveAlternatingVisibility(weeks[0], '2026-09-30') === null);
  check('A is not hidden', isItemHiddenOnDate('lec-a', '2026-09-30', weeks) === false);
  check('B is not hidden', isItemHiddenOnDate('lec-b', '2026-09-30', weeks) === false);
  check('on the start day the swap begins', resolveAlternatingVisibility(weeks[0], '2026-10-01')?.visibleId === 'lec-a');
}

console.log('\n2) Even cycle shows the starting lecture, odd cycle shows the other');
{
  const weeks = [pair()];
  check('day 0 (cycle 0) -> A', resolveAlternatingVisibility(weeks[0], '2026-10-01')?.visibleId === 'lec-a');
  check('day 6 (cycle 0) -> A', resolveAlternatingVisibility(weeks[0], '2026-10-07')?.visibleId === 'lec-a');
  check('day 7 (cycle 1) -> B', resolveAlternatingVisibility(weeks[0], '2026-10-08')?.visibleId === 'lec-b');
  check('day 13 (cycle 1) -> B', resolveAlternatingVisibility(weeks[0], '2026-10-14')?.visibleId === 'lec-b');
  check('day 14 (cycle 2) -> A', resolveAlternatingVisibility(weeks[0], '2026-10-15')?.visibleId === 'lec-a');
  check('day 21 (cycle 3) -> B', resolveAlternatingVisibility(weeks[0], '2026-10-22')?.visibleId === 'lec-b');

  check('A is hidden in week 2', isItemHiddenOnDate('lec-a', '2026-10-08', weeks) === true);
  check('B is hidden in week 1', isItemHiddenOnDate('lec-b', '2026-10-01', weeks) === true);
  check('B shows in week 2', isItemHiddenOnDate('lec-b', '2026-10-08', weeks) === false);
}

console.log('\n3) The pair can start with either lecture');
{
  const startsWithB = pair({ startItemId: 'lec-b' });
  check('first cycle -> B', resolveAlternatingVisibility(startsWithB, '2026-10-01')?.visibleId === 'lec-b');
  check('second cycle -> A', resolveAlternatingVisibility(startsWithB, '2026-10-08')?.visibleId === 'lec-a');
  check('A hidden in the first week', isItemHiddenOnDate('lec-a', '2026-10-01', [startsWithB]) === true);
}

console.log('\n4) Any interval length works (not only a week)');
{
  const everyThreeDays = pair({ intervalDays: 3 });
  check('day 0 -> A', resolveAlternatingVisibility(everyThreeDays, '2026-10-01')?.visibleId === 'lec-a');
  check('day 2 -> A', resolveAlternatingVisibility(everyThreeDays, '2026-10-03')?.visibleId === 'lec-a');
  check('day 3 -> B', resolveAlternatingVisibility(everyThreeDays, '2026-10-04')?.visibleId === 'lec-b');
  check('day 5 -> B', resolveAlternatingVisibility(everyThreeDays, '2026-10-06')?.visibleId === 'lec-b');
  check('day 6 -> A', resolveAlternatingVisibility(everyThreeDays, '2026-10-07')?.visibleId === 'lec-a');
}

console.log('\n5) Pausing or deleting a pair brings both lectures back');
{
  const paused = [pair({ active: false })];
  check('paused -> not hidden', isItemHiddenOnDate('lec-a', '2026-10-08', paused) === false);
  check('paused -> resolve is null', resolveAlternatingVisibility(paused[0], '2026-10-08') === null);

  const deleted: AlternatingLecture[] = [];
  check('deleted -> A visible', isItemHiddenOnDate('lec-a', '2026-10-08', deleted) === false);
  check('deleted -> B visible', isItemHiddenOnDate('lec-b', '2026-10-08', deleted) === false);
  check('no pairs at all -> visible', isItemHiddenOnDate('lec-a', '2026-10-08', undefined) === false);
}

console.log('\n6) Lectures outside any pair are untouched');
{
  const weeks = [pair()];
  check('unrelated lecture stays', isItemHiddenOnDate('lec-other', '2026-10-08', weeks) === false);
  check('unknown id stays', isItemHiddenOnDate('', '2026-10-08', weeks) === false);
}

console.log('\n7) Broken pair data never hides anything');
{
  check('same lecture twice', resolveAlternatingVisibility(pair({ itemAId: 'x', itemBId: 'x' }), '2026-10-08') === null);
  check('interval 0', resolveAlternatingVisibility(pair({ intervalDays: 0 }), '2026-10-08') === null);
  check('interval NaN', resolveAlternatingVisibility(pair({ intervalDays: Number.NaN }), '2026-10-08') === null);
  check('invalid start date', resolveAlternatingVisibility(pair({ startDate: 'not-a-date' }), '2026-10-08') === null);
  check('invalid start date hides nothing', isItemHiddenOnDate('lec-a', '2026-10-08', [pair({ startDate: '' })]) === false);
}

console.log('\n8) Next visible date for the hidden lecture');
{
  const weeks = [pair()];
  const next = nextVisibleDate('lec-b', weeks[0], '2026-10-01');
  check('B returns on 2026-10-08', next?.getFullYear() === 2026 && next?.getMonth() === 9 && next?.getDate() === 8, next);
  const alreadyVisible = nextVisibleDate('lec-a', weeks[0], '2026-10-01');
  check('A is visible today', alreadyVisible?.getDate() === 1, alreadyVisible);
}

console.log('\n9) Day counting is calendar-based (survives DST and time of day)');
{
  check('7 days apart', daysBetween(toCalendarDate('2026-10-01'), toCalendarDate('2026-10-08')) === 7);
  check('26 days apart', daysBetween(toCalendarDate('2026-10-01'), toCalendarDate('2026-10-27')) === 26);
  check('same day -> 0', daysBetween(toCalendarDate('2026-10-01'), toCalendarDate('2026-10-01')) === 0);
  check(
    'date with a time part is read as a calendar day',
    daysBetween(toCalendarDate('2026-10-01'), toCalendarDate(new Date(2026, 9, 8, 23, 59))) === 7
  );
}

console.log('\n10) Interval wording');
{
  check('weekly (ar)', describeInterval(7, true) === 'كل أسبوع', describeInterval(7, true));
  check('weekly (en)', describeInterval(7, false) === 'Every week', describeInterval(7, false));
  check('custom days', describeInterval(3, true) === 'كل 3 يوم', describeInterval(3, true));
  check('daily', describeInterval(1, true) === 'كل يوم', describeInterval(1, true));
}

console.log('\n11) 12-hour display of stored times');
{
  check('08:00 ar', formatTime12('08:00', 'ar') === '8:00 ص', formatTime12('08:00', 'ar'));
  check('13:30 ar', formatTime12('13:30', 'ar') === '1:30 م', formatTime12('13:30', 'ar'));
  check('00:15 ar', formatTime12('00:15', 'ar') === '12:15 ص', formatTime12('00:15', 'ar'));
  check('12:05 ar', formatTime12('12:05', 'ar') === '12:05 م', formatTime12('12:05', 'ar'));
  check('13:30 en', formatTime12('13:30', 'en') === '1:30 PM', formatTime12('13:30', 'en'));
  check('09:05 en', formatTime12('09:05', 'en') === '9:05 AM', formatTime12('09:05', 'en'));
  check('12:00 en', formatTime12('12:00', 'en') === '12:00 PM', formatTime12('12:00', 'en'));
  check('range', formatTimeRange12('08:00', '10:30', 'ar') === '8:00 ص - 10:30 ص', formatTimeRange12('08:00', '10:30', 'ar'));
  check('empty stays empty', formatTime12('', 'ar') === '');
  check('missing stays empty', formatTime12(null, 'ar') === '');
}

console.log('\n12) 12-hour picker converts back to the stored 24-hour value');
{
  check('8 am -> 08:00', to24HourTime(8, 0, 'am') === '08:00', to24HourTime(8, 0, 'am'));
  check('1:30 pm -> 13:30', to24HourTime(1, 30, 'pm') === '13:30', to24HourTime(1, 30, 'pm'));
  check('12 am -> 00:00', to24HourTime(12, 0, 'am') === '00:00', to24HourTime(12, 0, 'am'));
  check('12 pm -> 12:00', to24HourTime(12, 0, 'pm') === '12:00', to24HourTime(12, 0, 'pm'));
  check('minutes are padded', to24HourTime(9, 5, 'am') === '09:05', to24HourTime(9, 5, 'am'));

  const stored = ['00:00', '07:45', '08:00', '12:00', '13:30', '23:59'];
  const roundTrip = stored.every(value => {
    const parts = parseTimeToParts(value);
    return Boolean(parts) && to24HourTime(parts!.hour12, parts!.minute, parts!.meridiem) === value;
  });
  check('round trip 24h -> 12h -> 24h keeps the value', roundTrip);
  check('07:45 parses as morning', parseTimeToParts('07:45')?.meridiem === 'am');
  check('19:45 parses as evening', parseTimeToParts('19:45')?.meridiem === 'pm');
  check('garbage parses to null', parseTimeToParts('بعد الظهر') === null);
}

console.log('\n13) A pair keeps working across a month boundary');
{
  const monthly = pair({ intervalDays: 30, startDate: '2026-10-01' });
  check('month 1 -> A', resolveAlternatingVisibility(monthly, '2026-10-20')?.visibleId === 'lec-a');
  check('month 2 -> B', resolveAlternatingVisibility(monthly, '2026-10-31')?.visibleId === 'lec-b');
  check('month 3 -> A', resolveAlternatingVisibility(monthly, '2026-12-01')?.visibleId === 'lec-a');
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
