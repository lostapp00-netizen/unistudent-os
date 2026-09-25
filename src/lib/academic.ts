import { Subject, GradeRule, GraduationGradeRule, BonusPointEntry } from '../types';

export function sanitizeGradingScale(scale?: GradeRule[]): GradeRule[] {
  if (!Array.isArray(scale)) return [];
  return scale.filter(g => 
    g && 
    !String(g.id || '').startsWith('__') && 
    typeof g.letter === 'string' &&
    (typeof g.points === 'number' || !isNaN(Number(g.points)))
  ).map(g => ({
    ...g,
    points: Number(g.points || 0),
    minPercentage: Number(g.minPercentage || 0),
    maxPercentage: Number(g.maxPercentage || 100)
  }));
}

export function calculateSubjectGrade(subject: Subject, gradingScale: GradeRule[]) {
  const cleanScale = sanitizeGradingScale(gradingScale);
  if (cleanScale.length === 0 || subject.totalMarks === 0) return null;

  let totalAchieved = 0;
  let hasAnyAchievement = false;

  subject.distributions.forEach(dist => {
    if (dist.achievedMarks !== null) {
      totalAchieved += dist.achievedMarks;
      hasAnyAchievement = true;
    }
  });

  if (!hasAnyAchievement) return null;

  const percentage = (totalAchieved / subject.totalMarks) * 100;
  const matchedGrade = matchGradeRuleByPercentage(percentage, cleanScale);

  return {
    totalAchieved,
    percentage,
    letter: matchedGrade?.letter || 'F',
    points: typeof matchedGrade?.points === 'number' ? matchedGrade.points : 0
  };
}

/**
 * The grade rule a percentage falls into. Shared by the per-subject grade and
 * the overall (تقدير) calculation so both always pick the same rule.
 */
export function matchGradeRuleByPercentage(percentage: number, gradingScale: GradeRule[]): GradeRule | undefined {
  const cleanScale = sanitizeGradingScale(gradingScale);
  if (cleanScale.length === 0) return undefined;

  const sortedScale = [...cleanScale].sort((a, b) => b.minPercentage - a.minPercentage);

  const grade = sortedScale.find((g, idx) => {
    if (percentage < g.minPercentage) return false;

    // Determine operator for upper bound
    const isMaxInclusive = g.maxOperator
      ? g.maxOperator === '<='
      : (g.maxPercentage >= 100 || idx === 0);

    return isMaxInclusive ? percentage <= g.maxPercentage : percentage < g.maxPercentage;
  });

  // If not found in scale with strict upper bounds, fallback to finding by minPercentage or lowest grade
  return grade || sortedScale.find(g => percentage >= g.minPercentage) || sortedScale[sortedScale.length - 1];
}

/**
 * A subject's grade from its entered marks, falling back to its manual final
 * letter when no marks were entered at all. Used by every automated calculation
 * (overall grade, points, warnings) so they never disagree with each other.
 */
export function resolveSubjectGrade(subject: Subject, gradingScale: GradeRule[]) {
  const scale = sanitizeGradingScale(gradingScale);
  const fromMarks = calculateSubjectGrade(subject, scale);
  if (fromMarks) return fromMarks;

  if (subject.finalGradeLetter) {
    const rule = getMatchingGradeRuleByLetter(subject.finalGradeLetter, scale);
    if (rule) {
      return {
        totalAchieved: Number(((rule.minPercentage / 100) * (Number(subject.totalMarks) || 0)).toFixed(2)),
        percentage: rule.minPercentage,
        letter: rule.letter,
        points: rule.points
      };
    }
  }
  return null;
}

/** Subjects honouring an optional year/semester filter. */
export function filterBySemester<T extends { yearIndex: number; semesterIndex: number }>(
  list: T[],
  opts?: { years?: number[]; semesters?: number[] }
): T[] {
  if (!opts) return list;
  const years = opts.years || [];
  const semesters = opts.semesters || [];
  return list.filter(s =>
    (years.length === 0 || years.includes(Number(s.yearIndex))) &&
    (semesters.length === 0 || semesters.includes(Number(s.semesterIndex)))
  );
}

/**
 * The overall التقدير (تقدير عام) across the given subjects: symbol, Arabic/
 * English name and the percentage it was derived from. This is what replaces the
 * GPA badge in the points system, and sits next to it in the GPA system.
 *
 * Subjects are weighted by their total marks, so a 200-mark course counts twice
 * a 100-mark one — the same weighting the percentage of the whole record uses.
 */
export function calculateOverallGrade(
  subjects: Subject[],
  gradingScale: GradeRule[],
  opts?: { years?: number[]; semesters?: number[] }
): {
  totalAchieved: number;
  totalMarks: number;
  percentage: number;
  letter: string;
  nameAr: string;
  nameEn: string;
  rule?: GradeRule;
} | null {
  const list = filterBySemester(subjects || [], opts);
  let weightedMarks = 0;
  let totalMarks = 0;

  list.forEach(subject => {
    if (subject.includeInGpa === false) return;
    const grade = resolveSubjectGrade(subject, gradingScale);
    if (!grade) return;
    const marks = Number(subject.totalMarks) || 0;
    if (marks <= 0) return;
    weightedMarks += (grade.percentage / 100) * marks;
    totalMarks += marks;
  });

  if (totalMarks <= 0) return null;

  const percentage = (weightedMarks / totalMarks) * 100;
  const rule = matchGradeRuleByPercentage(percentage, gradingScale);

  return {
    totalAchieved: Number(weightedMarks.toFixed(2)),
    totalMarks,
    percentage,
    letter: rule?.letter || 'F',
    nameAr: rule?.nameAr || '',
    nameEn: rule?.nameEn || '',
    rule
  };
}

/** Marks a subject contributes to the record (0 when it has no grade yet). */
export function subjectMarksContribution(subject: Subject, gradingScale: GradeRule[]): number {
  const grade = resolveSubjectGrade(subject, gradingScale);
  return grade ? grade.totalAchieved : 0;
}

/** Marks collected across the given subjects (all of them when no filter). */
export function calculateAccumulatedMarks(
  subjects: Subject[],
  gradingScale: GradeRule[],
  opts?: { years?: number[]; semesters?: number[] }
): number {
  return filterBySemester(subjects || [], opts).reduce(
    (acc, subject) => acc + subjectMarksContribution(subject, gradingScale),
    0
  );
}

export type PointsSummary = {
  /** Every how many marks one point is earned. */
  marksPerPoint: number;
  /** The full points total the student is heading towards. */
  totalPoints: number;
  /** Marks carried over from before using the app. */
  previousMarks: number;
  /** All collected marks, previous ones included. */
  accumulatedMarks: number;
  /** النقط المحسوبة من الدرجات = accumulatedMarks ÷ marksPerPoint. */
  marksPoints: number;
  /** مجموع النقط الإضافية اللي الطالب سجّلها بنفسه (بونص/أنشطة). */
  bonusPoints: number;
  /** عدد الإضافات المسجّلة. */
  bonusCount: number;
  /**
   * إجمالي النقط المُحصَّلة = marksPoints + bonusPoints.
   * النقط الإضافية بتزوّد المُحصَّل بس، والتوتال (totalPoints) ما بيتغيّرش.
   */
  points: number;
  /** What is left of the total (0 when it was already passed). */
  remainingPoints: number;
  /** How much of the total has been collected, in percent. */
  percentOfTotal: number;
  /** Marks collected inside the given (current) filter only. */
  termMarks: number;
  /** النقط الفصلية — the filtered part of the points. */
  termPoints: number;
};

/**
 * The points-system equivalent of calculateGPA: how many points the student has
 * collected so far, out of the configured total, and how many are left.
 *
 * النقط الإضافية (`settings.bonusPoints`) بتتضاف على المُحصَّل فقط — التوتال
 * المحدد في الإعدادات بيفضل زي ما هو، فالزيادة بتقرّب الطالب من التوتال.
 */
export function getPointsSummary(
  settings: {
    marksPerPoint?: number | null;
    totalPoints?: number | null;
    initialAccumulatedMarks?: number | null;
    bonusPoints?: BonusPointEntry[];
    gradingScale?: GradeRule[];
  },
  subjects: Subject[],
  opts?: { years?: number[]; semesters?: number[] }
): PointsSummary | null {
  const marksPerPoint = Number(settings?.marksPerPoint || 0);
  const totalPoints = Number(settings?.totalPoints || 0);
  if (!Number.isFinite(marksPerPoint) || marksPerPoint <= 0) return null;

  const scale = sanitizeGradingScale(settings?.gradingScale);
  const previousMarks = Number(settings?.initialAccumulatedMarks || 0);
  const termMarks = calculateAccumulatedMarks(subjects, scale, opts);
  // التراكمي = درجات كل المواد (بدون فلتر) + الدرجات السابقة المجمعة.
  const accumulatedMarks = calculateAccumulatedMarks(subjects, scale) + (Number.isFinite(previousMarks) ? previousMarks : 0);

  const bonusEntries = Array.isArray(settings?.bonusPoints) ? settings.bonusPoints : [];
  const bonusPointsTotal = bonusEntries.reduce((acc, entry) => acc + (Number(entry?.points) || 0), 0);

  const marksPoints = accumulatedMarks / marksPerPoint;
  const points = marksPoints + bonusPointsTotal;
  const termPoints = termMarks / marksPerPoint;

  return {
    marksPerPoint,
    totalPoints,
    previousMarks: previousMarks || 0,
    accumulatedMarks,
    marksPoints,
    bonusPoints: bonusPointsTotal,
    bonusCount: bonusEntries.length,
    points,
    remainingPoints: totalPoints > 0 ? Math.max(0, totalPoints - points) : 0,
    percentOfTotal: totalPoints > 0 ? (points / totalPoints) * 100 : 0,
    termMarks,
    termPoints
  };
}

/** Is the subject at or below the warning threshold, judged by percentage? */
export function isSubjectAtPercentageRisk(
  subject: Subject,
  gradingScale: GradeRule[],
  thresholdMinPercentage: number
): boolean {
  if (subject.status === 'finished') return false; // Finished / locked subjects cannot be improved
  const grade = resolveSubjectGrade(subject, gradingScale);
  if (!grade) return false;
  return grade.percentage <= thresholdMinPercentage;
}

export function calculateGPA(
  subjects: Subject[],
  gradingScale: GradeRule[],
  yearIndex?: number,
  semesterIndex?: number,
  initialCumulativeGpa?: number | null,
  initialCompletedCreditHours?: number | null
) {
  const cleanScale = sanitizeGradingScale(gradingScale);
  let filteredSubjects = subjects;
  const isSingleSemester = yearIndex !== undefined || semesterIndex !== undefined;
  
  if (yearIndex) {
    filteredSubjects = filteredSubjects.filter(s => s.yearIndex === yearIndex);
  }
  if (semesterIndex) {
    filteredSubjects = filteredSubjects.filter(s => s.semesterIndex === semesterIndex);
  }

  let totalPointsAndHours = 0;
  let totalCreditHours = 0;

  // If this is a cumulative calculation and the user set an initial GPA & completed hours:
  if (!isSingleSemester && initialCumulativeGpa != null && initialCompletedCreditHours != null && initialCompletedCreditHours > 0) {
    totalPointsAndHours += initialCumulativeGpa * initialCompletedCreditHours;
    totalCreditHours += initialCompletedCreditHours;
  }

  filteredSubjects.forEach(subject => {
    if (subject.includeInGpa === false) return;

    let gradeObj = calculateSubjectGrade(subject, cleanScale);

    // If no distributions but has a manual finalGradeLetter
    if (!gradeObj && subject.finalGradeLetter) {
      const g = cleanScale.find(rule => rule.letter.trim().toLowerCase() === (subject.finalGradeLetter || '').trim().toLowerCase());
      if (g) {
        gradeObj = {
          totalAchieved: 0,
          percentage: g.minPercentage,
          letter: g.letter,
          points: g.points
        };
      }
    }

    // GPA is inclusive: subjects without any entered grades count as 0 points
    // but their credit hours still count — so a fully-ungraded semester shows
    // 0.00 and partial grades average the ungraded ones as zero.
    totalPointsAndHours += (gradeObj?.points ?? 0) * subject.creditHours;
    totalCreditHours += subject.creditHours;
  });

  if (totalCreditHours === 0) return 0;
  return Number((totalPointsAndHours / totalCreditHours).toFixed(2));
}

export function getMatchingGradeRuleByLetter(letter: string, scale: GradeRule[]): GradeRule | undefined {
  const cleanScale = sanitizeGradingScale(scale);
  if (cleanScale.length === 0) return undefined;
  return cleanScale.find(r => r.letter.trim().toLowerCase() === letter.trim().toLowerCase());
}

export function getMatchingGradeRuleByPoints(points: number, scale: GradeRule[]): GradeRule | undefined {
  const cleanScale = sanitizeGradingScale(scale);
  if (cleanScale.length === 0) return undefined;
  
  // Sort descending by points
  const sorted = [...cleanScale].sort((a, b) => b.points - a.points);
  
  // 1. Exact match
  const exact = sorted.find(r => Math.abs(r.points - points) < 0.01);
  if (exact) return exact;

  // 2. Find the rule with highest points <= given points
  const lowerOrEqual = sorted.find(r => r.points <= points);
  if (lowerOrEqual) return lowerOrEqual;

  // 3. Fallback to the lowest rule (e.g. F)
  return sorted[sorted.length - 1];
}

export function getWarningThreshold(settings: {
  warningGradeLetter?: string;
  warningGpaPoints?: number;
  gradingScale?: GradeRule[];
}): { points: number; letter: string; rule?: GradeRule } {
  const scale = sanitizeGradingScale(settings.gradingScale);
  
  if (settings.warningGpaPoints !== undefined && settings.warningGpaPoints !== null) {
    const points = Number(settings.warningGpaPoints);
    if (!isNaN(points)) {
      const rule = getMatchingGradeRuleByPoints(points, scale);
      return {
        points,
        letter: settings.warningGradeLetter || rule?.letter || 'C',
        rule
      };
    }
  }

  if (settings.warningGradeLetter) {
    const rule = getMatchingGradeRuleByLetter(settings.warningGradeLetter, scale);
    if (rule && typeof rule.points === 'number') {
      return {
        points: rule.points,
        letter: rule.letter,
        rule
      };
    }
  }

  // Default to 2.0 / C
  const defaultRule = getMatchingGradeRuleByPoints(2.0, scale) || getMatchingGradeRuleByLetter('C', scale);
  return {
    points: (defaultRule && typeof defaultRule.points === 'number') ? defaultRule.points : 2.0,
    letter: defaultRule ? defaultRule.letter : 'C',
    rule: defaultRule
  };
}

export function isSubjectAtWarningRisk(subject: Subject, scale: GradeRule[], thresholdPoints: number): boolean {
  if (subject.status === 'finished') return false; // Finished / locked subjects cannot be improved
  
  const cleanScale = sanitizeGradingScale(scale);
  let gradeObj = calculateSubjectGrade(subject, cleanScale);
  if (!gradeObj && subject.finalGradeLetter) {
    const rule = getMatchingGradeRuleByLetter(subject.finalGradeLetter, cleanScale);
    if (rule) {
      gradeObj = {
        totalAchieved: 0,
        percentage: rule.minPercentage,
        letter: rule.letter,
        points: rule.points
      };
    }
  }
  if (!gradeObj) return false;
  return gradeObj.points <= thresholdPoints;
}

/**
 * The warning threshold expressed as a percentage, for the points system where
 * no grade points exist. Falls back to the threshold letter's floor, then to 60%.
 */
export function getWarningThresholdPercentage(settings: {
  warningGradeLetter?: string;
  warningGpaPoints?: number;
  gradingScale?: GradeRule[];
}): number {
  const threshold = getWarningThreshold(settings);
  const rule = threshold.rule || getMatchingGradeRuleByLetter(threshold.letter, settings.gradingScale || []);
  if (rule && Number.isFinite(Number(rule.minPercentage))) return Number(rule.minPercentage);
  return 60;
}

export function calculateGraduationEstimate(
  cgpa: number,
  percentage: number = 0,
  graduationScale?: GraduationGradeRule[]
): { letter: string; nameAr: string; nameEn: string; rule?: GraduationGradeRule } | null {
  if (!graduationScale || graduationScale.length === 0) {
    // Default fallback graduation estimate
    if (cgpa >= 3.75) return { letter: 'A+', nameAr: 'ممتاز مع مرتبة الشرف', nameEn: 'Excellent with High Honors' };
    if (cgpa >= 3.5) return { letter: 'A', nameAr: 'ممتاز', nameEn: 'Excellent' };
    if (cgpa >= 3.0) return { letter: 'B+', nameAr: 'جيد جداً مرتفع', nameEn: 'Very Good High' };
    if (cgpa >= 2.5) return { letter: 'B', nameAr: 'جيد جداً', nameEn: 'Very Good' };
    if (cgpa >= 2.0) return { letter: 'C', nameAr: 'جيد', nameEn: 'Good' };
    if (cgpa >= 1.5) return { letter: 'D', nameAr: 'مقبول', nameEn: 'Pass' };
    return { letter: 'F', nameAr: 'راسب', nameEn: 'Fail' };
  }

  // Sort descending by minGpa
  const sorted = [...graduationScale].sort((a, b) => b.minGpa - a.minGpa);

  const matched = sorted.find((rule, idx) => {
    if (cgpa < rule.minGpa) return false;
    const isMaxInclusive = rule.gpaOperator ? rule.gpaOperator === '<=' : (rule.maxGpa >= 4.0 || idx === 0);
    if (isMaxInclusive) {
      return cgpa <= rule.maxGpa;
    } else {
      return cgpa < rule.maxGpa;
    }
  }) || sorted.find(r => cgpa >= r.minGpa) || sorted[sorted.length - 1];

  if (matched) {
    return {
      letter: matched.letter,
      nameAr: matched.nameAr,
      nameEn: matched.nameEn,
      rule: matched
    };
  }

  return null;
}


