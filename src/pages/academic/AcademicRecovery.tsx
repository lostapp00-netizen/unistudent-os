import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { calculateGPA, calculateSubjectGrade } from '../../lib/academic';
import { ArrowLeft, Target, AlertTriangle, TrendingUp, CheckCircle2, Sparkles, Award, BarChart3, HelpCircle } from 'lucide-react';
import { Subject, GradeRule } from '../../types';

export function AcademicRecovery() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subjects, settings } = useAppStore();
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  
  const [calculationMode, setCalculationMode] = useState<'cumulative' | 'semester'>('cumulative');
  const [targetGPA, setTargetGPA] = useState<string>('3.50');

  const isAr = settings.language === 'ar';
  const numTargetGPA = Number(targetGPA);

  // Active semester subjects
  const semesterSubjects = useMemo(() => {
    if (!currentSemester) return subjects;
    return subjects.filter(s => s.yearIndex === currentSemester.yearIndex && s.semesterIndex === currentSemester.semesterIndex);
  }, [subjects, currentSemester]);

  // Current GPAs
  const semesterGPA = calculateGPA(subjects, settings.gradingScale, currentSemester?.yearIndex, currentSemester?.semesterIndex);
  const cumulativeGPA = calculateGPA(
    subjects,
    settings.gradingScale,
    undefined,
    undefined,
    settings.initialCumulativeGpa,
    settings.initialCompletedCreditHours
  );

  const activeCurrentGPA = calculationMode === 'cumulative' ? cumulativeGPA : semesterGPA;

  // Analysis & Scenario Generator
  const recoveryAnalysis = useMemo(() => {
    if (isNaN(numTargetGPA) || numTargetGPA <= 0 || settings.gradingScale.length === 0) return null;

    const sortedScale = [...settings.gradingScale].sort((a, b) => b.points - a.points);
    const maxGradeRule = sortedScale[0];
    const lowestGradeRule = sortedScale[sortedScale.length - 1];

    // Relevant subjects for calculation
    const relevantSubjects = calculationMode === 'cumulative' ? subjects : semesterSubjects;

    // Separate finished vs unfinished
    const finishedSubjects = relevantSubjects.filter(s => s.status === 'finished');
    const unfinishedSubjects = relevantSubjects.filter(s => s.status !== 'finished');

    // Baseline finished credits & points
    let baseCredits = 0;
    let basePoints = 0;

    if (calculationMode === 'cumulative' && settings.initialCumulativeGpa && settings.initialCompletedCreditHours) {
      baseCredits += settings.initialCompletedCreditHours;
      basePoints += settings.initialCumulativeGpa * settings.initialCompletedCreditHours;
    }

    finishedSubjects.forEach(s => {
      const grade = calculateSubjectGrade(s, settings.gradingScale);
      const points = grade?.points || 0;
      basePoints += points * s.creditHours;
      baseCredits += s.creditHours;
    });

    const unfinishedCredits = unfinishedSubjects.reduce((acc, s) => acc + s.creditHours, 0);
    const totalCredits = baseCredits + unfinishedCredits;

    if (totalCredits === 0) {
      return { status: 'no_credits' as const };
    }

    // Target quality points total
    const totalPointsNeeded = numTargetGPA * totalCredits;
    const requiredUnfinishedPoints = totalPointsNeeded - basePoints;

    // Check max possible points
    const maxAttainableUnfinishedPoints = unfinishedSubjects.reduce((acc, sub) => {
      const currentGradeInfo = calculateSubjectGrade(sub, settings.gradingScale);
      const currentAchieved = currentGradeInfo?.totalAchieved || 0;
      
      // Mutable distributions: only status === 'current' AND (achieved < max)
      const mutableDists = sub.distributions.filter(d => d.status === 'current' && (d.achievedMarks || 0) < d.maxMarks);
      const availableGains = mutableDists.reduce((sum, d) => sum + (d.maxMarks - (d.achievedMarks || 0)), 0);
      const maxPossibleMarks = currentAchieved + availableGains;
      const maxPercentage = sub.totalMarks > 0 ? (maxPossibleMarks / sub.totalMarks) * 100 : 0;
      
      const bestPossibleGrade = sortedScale.find(g => maxPercentage >= g.minPercentage) || lowestGradeRule;
      return acc + (bestPossibleGrade.points * sub.creditHours);
    }, 0);

    const maxAttainableGPA = Number(((basePoints + maxAttainableUnfinishedPoints) / totalCredits).toFixed(2));
    const isImpossible = requiredUnfinishedPoints > maxAttainableUnfinishedPoints;

    // Inspect each unfinished subject and its room for growth
    interface SubjectPlan {
      subject: Subject;
      currentAchieved: number;
      currentPercentage: number;
      currentGradeRule: GradeRule;
      targetGradeRule: GradeRule;
      availableGains: number;
      maxPossibleMarks: number;
      targetTotalMarks: number;
      neededMarks: number;
      isMaxed: boolean;
      mutableDists: Array<{
        id: string;
        name: string;
        maxMarks: number;
        achievedMarks: number;
        availableGain: number;
        targetAchievedMarks: number;
        neededMarks: number;
      }>;
    }

    let subjectPlans: SubjectPlan[] = unfinishedSubjects.map(sub => {
      const currentGradeInfo = calculateSubjectGrade(sub, settings.gradingScale);
      const currentAchieved = currentGradeInfo?.totalAchieved || 0;
      const currentPercentage = sub.totalMarks > 0 ? (currentAchieved / sub.totalMarks) * 100 : 0;
      const currentGradeRule = sortedScale.find(g => currentPercentage >= g.minPercentage) || lowestGradeRule;

      // Filter mutable items: MUST NOT be final and MUST NOT be already maxed out
      const validMutableDists = sub.distributions.filter(d => 
        d.status === 'current' && ((d.achievedMarks === null || d.achievedMarks === undefined) || d.achievedMarks < d.maxMarks)
      );

      const availableGains = validMutableDists.reduce((sum, d) => sum + (d.maxMarks - (d.achievedMarks || 0)), 0);
      const maxPossibleMarks = currentAchieved + availableGains;

      return {
        subject: sub,
        currentAchieved,
        currentPercentage,
        currentGradeRule,
        targetGradeRule: currentGradeRule, // start at current grade
        availableGains,
        maxPossibleMarks,
        targetTotalMarks: currentAchieved,
        neededMarks: 0,
        isMaxed: availableGains === 0,
        mutableDists: validMutableDists.map(d => ({
          id: d.id,
          name: d.name,
          maxMarks: d.maxMarks,
          achievedMarks: d.achievedMarks || 0,
          availableGain: d.maxMarks - (d.achievedMarks || 0),
          targetAchievedMarks: d.achievedMarks || 0,
          neededMarks: 0,
        }))
      };
    });

    let currentSumPoints = subjectPlans.reduce((acc, p) => acc + (p.targetGradeRule.points * p.subject.creditHours), 0);

    // Iteratively elevate grades of subjects that have available room until required points are met
    while (currentSumPoints < requiredUnfinishedPoints) {
      let bestUpgradeIndex = -1;
      let bestNextGrade: GradeRule | null = null;
      let minCostRatio = Infinity;

      for (let i = 0; i < subjectPlans.length; i++) {
        const plan = subjectPlans[i];
        if (plan.isMaxed) continue;

        // Find next higher grade
        const currIndexInScale = sortedScale.findIndex(g => g.letter === plan.targetGradeRule.letter);
        if (currIndexInScale <= 0) continue; // Already at top grade

        const nextGrade = sortedScale[currIndexInScale - 1];
        const nextTargetMarks = (nextGrade.minPercentage / 100) * plan.subject.totalMarks;
        const requiredMarksForNextGrade = Math.max(0, nextTargetMarks - plan.currentAchieved);

        if (requiredMarksForNextGrade <= plan.availableGains) {
          const pointGain = (nextGrade.points - plan.targetGradeRule.points) * plan.subject.creditHours;
          if (pointGain > 0) {
            const costRatio = requiredMarksForNextGrade / pointGain;
            if (costRatio < minCostRatio) {
              minCostRatio = costRatio;
              bestUpgradeIndex = i;
              bestNextGrade = nextGrade;
            }
          }
        }
      }

      if (bestUpgradeIndex === -1 || !bestNextGrade) {
        break; // Reached maximum achievable upgrade
      }

      const oldPoints = subjectPlans[bestUpgradeIndex].targetGradeRule.points;
      subjectPlans[bestUpgradeIndex].targetGradeRule = bestNextGrade;
      currentSumPoints += (bestNextGrade.points - oldPoints) * subjectPlans[bestUpgradeIndex].subject.creditHours;
    }

    // Now calculate exact needed marks and distribute to mutable distribution items
    let totalNeededMarksAcrossAllSubjects = 0;

    subjectPlans = subjectPlans.map(plan => {
      const targetTotalMarks = Math.min(
        plan.maxPossibleMarks,
        (plan.targetGradeRule.minPercentage / 100) * plan.subject.totalMarks
      );
      const neededMarksInSubject = Math.max(0, Math.ceil(targetTotalMarks - plan.currentAchieved));
      totalNeededMarksAcrossAllSubjects += neededMarksInSubject;

      // Distribute needed marks across mutable distributions
      let distributedSoFar = 0;
      const updatedDists = plan.mutableDists.map((d, dIdx) => {
        if (plan.availableGains === 0 || neededMarksInSubject === 0) {
          return { ...d, neededMarks: 0, targetAchievedMarks: d.achievedMarks };
        }

        // Proportional allocation with integer ceiling
        let distNeeded = 0;
        if (dIdx === plan.mutableDists.length - 1) {
          distNeeded = Math.min(d.availableGain, neededMarksInSubject - distributedSoFar);
        } else {
          const share = Math.round(neededMarksInSubject * (d.availableGain / plan.availableGains));
          distNeeded = Math.min(d.availableGain, share);
        }
        
        distNeeded = Math.max(0, distNeeded);
        distributedSoFar += distNeeded;

        return {
          ...d,
          neededMarks: distNeeded,
          targetAchievedMarks: d.achievedMarks + distNeeded
        };
      });

      return {
        ...plan,
        targetTotalMarks,
        neededMarks: neededMarksInSubject,
        mutableDists: updatedDists
      };
    });

    const isTargetAlreadyAchieved = activeCurrentGPA >= numTargetGPA;

    return {
      status: 'ready' as const,
      isImpossible,
      isTargetAlreadyAchieved,
      maxAttainableGPA,
      totalCredits,
      unfinishedCredits,
      totalNeededMarksAcrossAllSubjects,
      requiredUnfinishedPoints: Math.max(0, requiredUnfinishedPoints),
      subjectPlans
    };
  }, [numTargetGPA, subjects, semesterSubjects, settings, calculationMode, activeCurrentGPA]);

  return (
    <div className="flex flex-col min-h-full gap-6 pb-12">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/academic')}
            className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <ArrowLeft size={20} className={isAr ? "rotate-180" : ""} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
              <span className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Target size={26} />
              </span>
              {isAr ? 'خطة رفع واستعادة المعدل' : 'GPA Recovery Plan'}
            </h1>
            <p className="text-xs md:text-sm text-zinc-500 mt-1">
              {isAr ? 'حدد المعدل المطلوب وسيحسب لك التطبيق الدرجات المتبقية بدقة وتوزيعها على كل تقييم' : 'Set your target GPA and get a precise breakdown of marks needed for each evaluation.'}
            </p>
          </div>
        </div>

        {/* Calculation Scope Switch */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 shadow-inner">
          <button
            onClick={() => setCalculationMode('cumulative')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              calculationMode === 'cumulative'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            {isAr ? 'المعدل التراكمي الكلي' : 'Cumulative GPA'}
          </button>
          <button
            onClick={() => setCalculationMode('semester')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              calculationMode === 'semester'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            {isAr ? 'معدل الفصل الحالي' : 'Current Semester'}
          </button>
        </div>
      </header>

      {/* Target & GPA Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              {calculationMode === 'cumulative' ? (isAr ? 'المعدل التراكمي الحالي' : 'Current Cumulative GPA') : (isAr ? 'معدل الفصل الحالي' : 'Current Semester GPA')}
            </p>
            <div className="text-3xl font-black text-zinc-800 dark:text-zinc-100">
              {activeCurrentGPA > 0 ? activeCurrentGPA.toFixed(2) : '--'}
            </div>
          </div>
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-500">
            <BarChart3 size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              {isAr ? 'المعدل المستهدف' : 'Target GPA'}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max={settings.gradingScale[0]?.points || 4.0}
                step="0.05"
                value={targetGPA}
                onChange={(e) => setTargetGPA(e.target.value)}
                className="w-28 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 rounded-xl px-3 py-1.5 text-2xl font-black outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <Award size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              {isAr ? 'إجمالي الدرجات المطلوب جمعها' : 'Total Raw Marks Needed'}
            </p>
            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
              {recoveryAnalysis?.status === 'ready' && !recoveryAnalysis.isTargetAlreadyAchieved && !recoveryAnalysis.isImpossible
                ? `+${recoveryAnalysis.totalNeededMarksAcrossAllSubjects} ${isAr ? 'درجة' : 'marks'}`
                : recoveryAnalysis?.isTargetAlreadyAchieved ? '0' : '--'}
            </div>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Sparkles size={24} />
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {recoveryAnalysis && (
        <div className="space-y-6">
          {/* Status Banners */}
          {recoveryAnalysis.isTargetAlreadyAchieved ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-6 rounded-3xl flex items-start gap-4">
              <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 mt-1 flex-shrink-0" size={24} />
              <div>
                <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-200">
                  {isAr ? 'أنت بالفعل تحقق هذا المعدل أو تتجاوزه!' : 'You have already met or exceeded this target!'}
                </h3>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                  {isAr 
                    ? `معدلك الحالي (${activeCurrentGPA.toFixed(2)}) أعلى من أو يساوي المعدل المطلوب (${numTargetGPA.toFixed(2)}). يمكنك تجربة وضع هدف أعلى لاكتشاف إمكاناتك.` 
                    : `Your current GPA (${activeCurrentGPA.toFixed(2)}) meets or exceeds your goal (${numTargetGPA.toFixed(2)}).`}
                </p>
              </div>
            </div>
          ) : recoveryAnalysis.isImpossible ? (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 p-6 rounded-3xl flex items-start gap-4">
              <AlertTriangle className="text-rose-600 dark:text-rose-400 mt-1 flex-shrink-0" size={24} />
              <div>
                <h3 className="font-bold text-lg text-rose-900 dark:text-rose-200">
                  {isAr ? 'المعدل المستهدف غير قابل للتحقيق في هذه المواد' : 'Target GPA is mathematically unreachable'}
                </h3>
                <p className="text-sm text-rose-700 dark:text-rose-400 mt-1 leading-relaxed">
                  {isAr 
                    ? `حتى لو حصلت على الدرجة النهائية كاملة في جميع التقييمات المتبقية، فإن أقصى معدل يمكنك الوصول إليه هو (${recoveryAnalysis.maxAttainableGPA.toFixed(2)}). جرب ضبط الهدف على قيمة أقل من أو تساوي هذا الرقم.` 
                    : `Even with maximum possible scores on all remaining assignments, the maximum attainable GPA is (${recoveryAnalysis.maxAttainableGPA.toFixed(2)}).`}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 rounded-3xl shadow-md flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp size={22} />
                  {isAr ? 'خطة العمل الموصى بها للوصول للهدف' : 'Recommended Action Plan'}
                </h3>
                <p className="text-xs md:text-sm text-emerald-50 mt-1 leading-relaxed">
                  {isAr 
                    ? `للوصول إلى معدل ${numTargetGPA.toFixed(2)}، تم حساب الدرجات المستهدفة لكل مادة وتقسيمها على التقييمات القابلة للزيادة فقط (أعمال السنة، الفاينال، إلخ).` 
                    : `To hit ${numTargetGPA.toFixed(2)}, focus on collecting the following points across your active subjects:`}
                </p>
              </div>
            </div>
          )}

          {/* Subject Breakdown Cards */}
          {recoveryAnalysis.status === 'ready' && !recoveryAnalysis.isTargetAlreadyAchieved && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                {isAr ? 'تفصيل المواد والتقييمات المطلوبة' : 'Subject & Evaluation Breakdown'}
              </h2>

              <div className="grid grid-cols-1 gap-6">
                {recoveryAnalysis.subjectPlans.map((plan) => {
                  return (
                    <div 
                      key={plan.subject.id}
                      className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all space-y-4"
                    >
                      {/* Subject Header */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-extrabold text-zinc-800 dark:text-zinc-100">{plan.subject.name}</h3>
                            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-500 font-mono">
                              {plan.subject.code}
                            </span>
                            <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md font-bold">
                              {plan.subject.creditHours} {isAr ? 'ساعات' : 'credits'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                            <span>{isAr ? `الدرجة الحالية: ${plan.currentAchieved} / ${plan.subject.totalMarks}` : `Current: ${plan.currentAchieved} / ${plan.subject.totalMarks}`}</span>
                            <span>&bull;</span>
                            <span>{isAr ? `الدرجات المتبقية المتاحة: ${plan.availableGains}` : `Available Gains: ${plan.availableGains}`}</span>
                          </div>
                        </div>

                        {/* Subject Grade Badge */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[11px] font-bold text-zinc-400 block">{isAr ? 'التقدير المطلوب' : 'Target Grade'}</span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {plan.targetTotalMarks.toFixed(0)} / {plan.subject.totalMarks} ({plan.targetGradeRule.minPercentage}%)
                            </span>
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-black text-xl flex items-center justify-center shadow-inner">
                            {plan.targetGradeRule.letter}
                          </div>
                        </div>
                      </div>

                      {/* Required Marks in Subject Banner */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {isAr ? 'إجمالي الدرجات المطلوب إضافتها في هذه المادة:' : 'Total marks to add in this course:'}
                        </span>
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                          {plan.neededMarks > 0 ? `+${plan.neededMarks} ${isAr ? 'درجة' : 'marks'}` : (isAr ? 'لا تحتاج لزيادة' : 'No marks needed')}
                        </span>
                      </div>

                      {/* Mutable Distribution Items Breakdown */}
                      {plan.mutableDists.length > 0 ? (
                        <div className="space-y-2 pt-2">
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                            {isAr ? 'توزيع الدرجات على التقييمات القابلة للزيادة' : 'Evaluation Target Breakdown'}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {plan.mutableDists.map((dist) => (
                              <div 
                                key={dist.id}
                                className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 shadow-sm flex flex-col justify-between gap-2"
                              >
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{dist.name}</span>
                                  <span className="text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-md">
                                    {isAr ? `من ${dist.maxMarks}` : `/ ${dist.maxMarks}`}
                                  </span>
                                </div>

                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between text-zinc-500">
                                    <span>{isAr ? 'الدرجة الحالية:' : 'Current score:'}</span>
                                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{dist.achievedMarks}</span>
                                  </div>
                                  <div className="flex justify-between text-zinc-500">
                                    <span>{isAr ? 'الدرجة المستهدفة:' : 'Target score:'}</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{dist.targetAchievedMarks}</span>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700/60 flex justify-between items-center text-xs">
                                  <span className="text-zinc-500 font-medium">{isAr ? 'المطلوب جمعه:' : 'Required gain:'}</span>
                                  <span className={`font-black px-2 py-0.5 rounded-md ${
                                    dist.neededMarks > 0 
                                      ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300' 
                                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500'
                                  }`}>
                                    +{dist.neededMarks} {isAr ? 'درجة' : 'pts'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-400 italic p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl text-center">
                          {isAr ? 'جميع تقييمات هذه المادة إما تم إغلاقها نهائياً أو مقفلة الدرجة كاملة.' : 'All evaluations for this subject are finalized or fully scored.'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

