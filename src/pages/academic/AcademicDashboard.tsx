import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { 
  calculateGPA, 
  calculateSubjectGrade, 
  getWarningThreshold, 
  isSubjectAtWarningRisk, 
  calculateGraduationEstimate 
} from '../../lib/academic';
import { 
  AlertTriangle, 
  Library, 
  Target, 
  BookOpen, 
  GraduationCap, 
  TrendingDown, 
  ArrowRight, 
  Award, 
  Sparkles, 
  CheckCircle, 
  TrendingUp, 
  ChevronRight, 
  Layers,
  Compass
} from 'lucide-react';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../../components/ui/UnifiedSemesterFilter';

export function AcademicDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subjects, settings } = useAppStore();
  const isAr = settings.language === 'ar';

  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);

  const filteredSubjects = subjects.filter(s => 
    (filterYears.length === 0 || filterYears.includes(s.yearIndex)) &&
    (filterSemesters.length === 0 || filterSemesters.includes(s.semesterIndex))
  );

  const semesterGPA = calculateGPA(
    subjects, 
    settings.gradingScale, 
    filterYears.length === 1 ? filterYears[0] : undefined, 
    filterSemesters.length === 1 ? filterSemesters[0] : undefined
  );

  const totalGPA = calculateGPA(
    subjects, 
    settings.gradingScale, 
    undefined, 
    undefined, 
    settings.initialCumulativeGpa, 
    settings.initialCompletedCreditHours
  );
  
  const hasFilteredGrades = filteredSubjects.some(s => {
    const grade = calculateSubjectGrade(s, settings.gradingScale);
    return (grade && grade.totalAchieved > 0) || !!s.finalGradeLetter;
  });

  const threshold = getWarningThreshold(settings);
  const warningSubjects = filteredSubjects.filter(s => 
    isSubjectAtWarningRisk(s, settings.gradingScale, threshold.points)
  );

  const gradEstimate = settings.enableGraduationScale && settings.graduationGradingScale && settings.graduationGradingScale.length > 0 && totalGPA > 0
    ? calculateGraduationEstimate(totalGPA, undefined, settings.graduationGradingScale)
    : null;

  // Total credit hours in filtered semester
  const totalFilteredCreditHours = filteredSubjects.reduce((acc, s) => acc + (Number(s.creditHours) || 0), 0);
  const finishedFilteredSubjects = filteredSubjects.filter(s => s.status === 'finished');
  const finishedFilteredCredits = finishedFilteredSubjects.reduce((acc, s) => acc + (Number(s.creditHours) || 0), 0);

  // Helper for GPA Performance Label
  const getGpaTier = (gpa: number) => {
    if (gpa >= 3.5) return { label: isAr ? 'ممتاز مرتفع' : 'Excellent', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-400/30' };
    if (gpa >= 3.0) return { label: isAr ? 'جيد جداً' : 'Very Good', color: 'text-blue-400 bg-blue-500/20 border-blue-400/30' };
    if (gpa >= 2.5) return { label: isAr ? 'جيد' : 'Good', color: 'text-amber-400 bg-amber-500/20 border-amber-400/30' };
    if (gpa >= 2.0) return { label: isAr ? 'مقبول' : 'Pass', color: 'text-orange-400 bg-orange-500/20 border-orange-400/30' };
    return { label: isAr ? 'تحت الملاحظة' : 'At Risk', color: 'text-rose-400 bg-rose-500/20 border-rose-400/30' };
  };

  const cumulativeTier = getGpaTier(totalGPA);

  return (
    <div className="flex flex-col min-h-full gap-6 pb-12">
      {/* Top Header Bar */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <GraduationCap className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <span>{t('academic_dashboard')}</span>
          </h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <UnifiedFilterBadge 
              filterYears={filterYears} 
              filterSemesters={filterSemesters} 
            />
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
              {filteredSubjects.length} {isAr ? 'مواد دراسية' : 'courses'} • {totalFilteredCreditHours} {isAr ? 'ساعات معتمدة' : 'credit hours'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2.5 items-center">
          <UnifiedSemesterFilter
            filterYears={filterYears}
            filterSemesters={filterSemesters}
            setFilterYears={setFilterYears}
            setFilterSemesters={setFilterSemesters}
          />
          <button
            onClick={() => navigate('/academic/subjects')}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
          >
            <BookOpen size={16} />
            <span>{isAr ? 'إدارة المواد' : 'Manage Courses'}</span>
          </button>
        </div>
      </header>

      {/* 4 Interactive Statistics Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* 1. Cumulative GPA Card */}
        <div 
          onClick={() => navigate('/academic/subjects')}
          className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{isAr ? 'المعدل التراكمي (cGPA)' : 'Cumulative GPA'}</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                {totalGPA > 0 ? totalGPA.toFixed(2) : '--'}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <GraduationCap size={24} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{isAr ? 'المعدل الكلي لجميع السنوات' : 'All-time cumulative'}</span>
            <ChevronRight size={16} className={`text-zinc-400 group-hover:text-indigo-600 transition-transform ${isAr ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* 2. Term GPA Card */}
        <div 
          onClick={() => navigate('/academic/subjects')}
          className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{isAr ? 'معدل الفصل المختار' : 'Term GPA'}</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                {hasFilteredGrades && semesterGPA > 0 ? semesterGPA.toFixed(2) : (hasFilteredGrades ? '0.00' : '--')}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen size={24} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{isAr ? 'حسب المواد المحددة بالفلتر' : 'Calculated for selected filter'}</span>
            <ChevronRight size={16} className={`text-zinc-400 group-hover:text-blue-600 transition-transform ${isAr ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* 3. Subjects Count Card */}
        <div 
          onClick={() => navigate('/academic/subjects')}
          className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('subjects')}</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                {filteredSubjects.length}
                <span className="text-xs font-bold text-zinc-400 ms-1.5 font-sans">
                  ({finishedFilteredSubjects.length} {isAr ? 'منتهية' : 'done'})
                </span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Library size={24} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{totalFilteredCreditHours} {isAr ? 'ساعة معتمدة بالفصل' : 'total credit hours'}</span>
            <ChevronRight size={16} className={`text-zinc-400 group-hover:text-emerald-600 transition-transform ${isAr ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* 4. Warnings & At Risk Card */}
        <div 
          onClick={() => navigate('/academic/warnings')}
          className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md hover:border-rose-300 dark:hover:border-rose-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{isAr ? 'نقاط الضعف والإنذارات' : 'Warnings & Risk'}</p>
              <h3 className={`text-3xl font-black mt-1 ${warningSubjects.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-white'}`}>
                {warningSubjects.length}
              </h3>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${
              warningSubjects.length > 0 ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
            }`}>
              <AlertTriangle size={24} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{isAr ? `حد الإنذار: ${threshold.letter} (${Number(threshold.points || 0).toFixed(1)})` : `Threshold: ${threshold.letter}`}</span>
            <ChevronRight size={16} className={`text-zinc-400 group-hover:text-rose-600 transition-transform ${isAr ? 'rotate-180' : ''}`} />
          </div>
        </div>

      </div>

      {/* Main Content Grid: Subjects Summary & Warnings Alert Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Recent Subjects Performance Overview */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Library size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  {isAr ? 'أداء المواد الدراسية' : 'Course Performance'}
                </h3>
                <p className="text-[11px] text-zinc-400">{isAr ? 'استعراض سريع للدرجات والتقديرات' : 'Grades & achievement overview'}</p>
              </div>
            </div>

            <button 
              onClick={() => navigate('/academic/subjects')} 
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{isAr ? 'عرض الكل' : 'View All'}</span>
              <ChevronRight size={14} className={isAr ? 'rotate-180' : ''} />
            </button>
          </div>

          <div className="space-y-3">
            {filteredSubjects.slice(0, 5).map(subject => {
              const gradeInfo = calculateSubjectGrade(subject, settings.gradingScale);
              const isFinished = subject.status === 'finished';
              const points = gradeInfo?.points || 0;
              const percentage = gradeInfo?.percentage || 0;

              return (
                <div 
                  key={subject.id} 
                  onClick={() => navigate(`/academic/${subject.id}`)} 
                  className="group p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {subject.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                        <span>{subject.code}</span>
                        <span>•</span>
                        <span>{subject.creditHours} {isAr ? 'ساعات' : 'credits'}</span>
                        <span>•</span>
                        <span className={isFinished ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
                          {isFinished ? (isAr ? 'منتهية' : 'Finished') : (isAr ? 'قيد الدراسة' : 'In Progress')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      {gradeInfo ? (
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                            points >= 3.0 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' :
                            points >= 2.0 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' :
                            'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}>
                            {gradeInfo.letter} ({points.toFixed(1)})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 font-bold">--</span>
                      )}
                    </div>
                  </div>

                  {/* Subject Progress Bar */}
                  {gradeInfo && (
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700/60 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          percentage >= 80 ? 'bg-emerald-500' : percentage >= 65 ? 'bg-indigo-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, percentage))}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {filteredSubjects.length === 0 && (
              <div className="text-center py-12 text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/20 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <Library size={36} className="mx-auto mb-2 opacity-30 text-indigo-500" />
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {isAr ? 'لا توجد مواد مضافة في هذا الفصل.' : 'No subjects added in this semester.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Warnings & Academic Health Hub */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                    {isAr ? 'مركز الإنذارات ونقاط الضعف' : 'Academic Health & Warnings'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">{isAr ? 'المواد التي تحتاج تدخلاً وتعويضاً سريعاً' : 'Courses needing immediate attention'}</p>
                </div>
              </div>

              <button 
                onClick={() => navigate('/academic/warnings')} 
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{isAr ? 'التفاصيل' : 'Details'}</span>
                <ChevronRight size={14} className={isAr ? 'rotate-180' : ''} />
              </button>
            </div>

            <div className="space-y-3">
              {warningSubjects.slice(0, 3).map(subject => {
                let gradeInfo = calculateSubjectGrade(subject, settings.gradingScale);
                if (!gradeInfo && subject.finalGradeLetter) {
                  const rule = settings.gradingScale.find(r => r.letter === subject.finalGradeLetter);
                  if (rule) {
                    gradeInfo = {
                      totalAchieved: 0,
                      percentage: rule.minPercentage,
                      letter: rule.letter,
                      points: rule.points
                    };
                  }
                }
                return (
                  <div key={subject.id} className="flex items-center gap-3.5 p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                    <div className="flex flex-col items-center justify-center p-2 min-w-[50px] rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0">
                      <span className="font-black text-lg leading-tight">{gradeInfo?.letter || 'F'}</span>
                      <span className="text-[10px] font-bold opacity-90">{(gradeInfo?.points || 0).toFixed(1)} GPA</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-rose-950 dark:text-rose-200 truncate">{subject.name}</h4>
                      <p className="text-xs text-rose-700 dark:text-rose-400/90 mt-0.5 leading-relaxed">
                        {isAr 
                          ? `النقاط (${(gradeInfo?.points || 0).toFixed(2)}) ضمن حد الإنذار (${Number(threshold.points || 0).toFixed(2)} - ${threshold.letter}).` 
                          : `Grade points (${(gradeInfo?.points || 0).toFixed(2)}) is at or below threshold.`}
                      </p>
                    </div>
                  </div>
                );
              })}

              {warningSubjects.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-10 text-emerald-600 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-900/40 p-6">
                  <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-3 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={28} />
                  </div>
                  <p className="font-black text-sm">{isAr ? 'أداؤك الأكاديمي ممتاز ومستقر!' : 'Excellent Performance!'}</p>
                  <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300/80">
                    {isAr 
                      ? `لا توجد أي إنذارات أو مواد أقل من حد التحذير (${Number(threshold.points || 0).toFixed(2)} - ${threshold.letter}).` 
                      : `No courses at or below warning threshold.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recovery Plan Action Button */}
          <div className="pt-2">
            <button 
              onClick={() => navigate('/academic/recovery')} 
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition-all shadow-md cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <Target size={20} className="group-hover:rotate-12 transition-transform" />
                <div className="text-start">
                  <p className="font-bold text-xs sm:text-sm">{isAr ? 'توليد خطة تحسين أكاديمي (Recovery Plan)' : 'Generate Academic Recovery Plan'}</p>
                  <p className="text-[10px] text-emerald-100">{isAr ? 'اقتراح درجات المواد القادمة لرفع المعدل' : 'Simulate future grades to boost your GPA'}</p>
                </div>
              </div>
              <ArrowRight className={`group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform ${isAr ? 'rotate-180' : ''}`} size={18} />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
