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
