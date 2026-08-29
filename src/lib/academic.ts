import { Subject, GradeRule } from '../types';

export function calculateSubjectGrade(subject: Subject, gradingScale: GradeRule[]) {
  if (gradingScale.length === 0 || subject.totalMarks === 0) return null;

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
  
  // Find grade by percentage (descending order sort to match highest first just in case)
  const sortedScale = [...gradingScale].sort((a, b) => b.minPercentage - a.minPercentage);
  const grade = sortedScale.find(g => percentage >= g.minPercentage);
  
  // If not found in scale, default to the lowest grade or F
  const matchedGrade = grade || sortedScale[sortedScale.length - 1];

  return {
    totalAchieved,
    percentage,
    letter: matchedGrade?.letter || 'F',
    points: matchedGrade?.points || 0
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
    let gradeObj = calculateSubjectGrade(subject, gradingScale);
    
    // If no distributions but has a manual finalGradeLetter
    if (!gradeObj && subject.finalGradeLetter) {
      const g = gradingScale.find(rule => rule.letter === subject.finalGradeLetter);
      if (g) {
        gradeObj = {
          totalAchieved: 0,
          percentage: g.minPercentage,
          letter: g.letter,
          points: g.points
        };
      }
    }

    if (gradeObj && subject.includeInGpa !== false) {
      totalPointsAndHours += gradeObj.points * subject.creditHours;
      totalCreditHours += subject.creditHours;
    }
  });

  if (totalCreditHours === 0) return 0;
  return Number((totalPointsAndHours / totalCreditHours).toFixed(2));
}

export function getMatchingGradeRuleByLetter(letter: string, scale: GradeRule[]): GradeRule | undefined {
  if (!scale || scale.length === 0) return undefined;
  return scale.find(r => r.letter.trim().toLowerCase() === letter.trim().toLowerCase());
}

export function getMatchingGradeRuleByPoints(points: number, scale: GradeRule[]): GradeRule | undefined {
  if (!scale || scale.length === 0) return undefined;
  
  // Sort descending by points
  const sorted = [...scale].sort((a, b) => b.points - a.points);
  
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
  const scale = settings.gradingScale || [];
  
  if (settings.warningGpaPoints !== undefined && settings.warningGpaPoints !== null) {
    const points = Number(settings.warningGpaPoints);
    const rule = getMatchingGradeRuleByPoints(points, scale);
    return {
      points,
      letter: settings.warningGradeLetter || rule?.letter || 'C',
      rule
    };
  }

  if (settings.warningGradeLetter) {
    const rule = getMatchingGradeRuleByLetter(settings.warningGradeLetter, scale);
    if (rule) {
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
    points: defaultRule ? defaultRule.points : 2.0,
    letter: defaultRule ? defaultRule.letter : 'C',
    rule: defaultRule
  };
}

export function isSubjectAtWarningRisk(subject: Subject, scale: GradeRule[], thresholdPoints: number): boolean {
  let gradeObj = calculateSubjectGrade(subject, scale);
  if (!gradeObj && subject.finalGradeLetter) {
    const rule = getMatchingGradeRuleByLetter(subject.finalGradeLetter, scale);
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

