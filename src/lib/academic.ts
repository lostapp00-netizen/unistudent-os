import { Subject, GradeRule, GraduationGradeRule } from '../types';

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
  
  // Find grade by percentage (descending order sort to match highest first)
  const sortedScale = [...cleanScale].sort((a, b) => b.minPercentage - a.minPercentage);
  
  const grade = sortedScale.find((g, idx) => {
    if (percentage < g.minPercentage) return false;
    
    // Determine operator for upper bound
    const isMaxInclusive = g.maxOperator 
      ? g.maxOperator === '<=' 
      : (g.maxPercentage >= 100 || idx === 0);
      
    if (isMaxInclusive) {
      return percentage <= g.maxPercentage;
    } else {
      return percentage < g.maxPercentage;
    }
  });
  
  // If not found in scale with strict upper bounds, fallback to finding by minPercentage or lowest grade
  const matchedGrade = grade || sortedScale.find(g => percentage >= g.minPercentage) || sortedScale[sortedScale.length - 1];

  return {
    totalAchieved,
    percentage,
    letter: matchedGrade?.letter || 'F',
    points: typeof matchedGrade?.points === 'number' ? matchedGrade.points : 0
  };
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


