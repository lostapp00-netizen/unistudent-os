
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { calculateGPA, calculateSubjectGrade, getWarningThreshold, isSubjectAtWarningRisk, calculateGraduationEstimate } from '../../lib/academic';
import { AlertTriangle, Filter, Library, Target, BookOpen, GraduationCap, TrendingDown, ArrowRight, Award } from 'lucide-react';

export function AcademicDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subjects, settings } = useAppStore();
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setShowFilterPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleYear = (y: number) => setFilterYears(prev => prev.includes(y) ? prev.filter(yr => yr !== y) : [...prev, y]);
  const toggleSemester = (s: number) => setFilterSemesters(prev => prev.includes(s) ? prev.filter(sem => sem !== s) : [...prev, s]);

  const filteredSubjects = subjects.filter(s => 
    (filterYears.length === 0 || filterYears.includes(s.yearIndex)) &&
    (filterSemesters.length === 0 || filterSemesters.includes(s.semesterIndex))
  );

  const semesterGPA = calculateGPA(subjects, settings.gradingScale, filterYears.length === 1 ? filterYears[0] : undefined, filterSemesters.length === 1 ? filterSemesters[0] : undefined);
  const totalGPA = calculateGPA(subjects, settings.gradingScale, undefined, undefined, settings.initialCumulativeGpa, settings.initialCompletedCreditHours);
  
  const hasFilteredGrades = filteredSubjects.some(s => {
    const grade = calculateSubjectGrade(s, settings.gradingScale);
    return (grade && grade.totalAchieved > 0) || !!s.finalGradeLetter;
  });

  const threshold = getWarningThreshold(settings);
  const warningSubjects = filteredSubjects.filter(s => 
    isSubjectAtWarningRisk(s, settings.gradingScale, threshold.points)
  );

  const isAr = settings.language === 'ar';

  const gradEstimate = settings.enableGraduationScale && settings.graduationGradingScale && settings.graduationGradingScale.length > 0 && totalGPA > 0
    ? calculateGraduationEstimate(totalGPA, undefined, settings.graduationGradingScale)
    : null;

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t('academic_dashboard')}</h1>
          <p className="text-zinc-500 mt-1">
            {isAr ? 'نظرة عامة على أدائك الأكاديمي' : 'Overview of your academic performance'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center relative">
          <div ref={filterPopoverRef} className="relative z-20">
            <button 
              onClick={() => setShowFilterPopover(!showFilterPopover)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all border shadow-xs ${
                filterYears.length > 0 || filterSemesters.length > 0 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-300' 
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Filter size={16} />
              <span>{t('filter')}</span>
              {(filterYears.length > 0 || filterSemesters.length > 0) && (
                <span className="flex items-center justify-center bg-indigo-600 text-white w-5 h-5 rounded-full text-xs font-bold mr-1 rtl:mr-0 rtl:ml-1">
                  {filterYears.length + filterSemesters.length}
                </span>
              )}
            </button>
            
            {showFilterPopover && (
              <div className="absolute top-full mt-2 w-72 max-w-[calc(100vw-2rem)] right-0 rtl:right-auto rtl:left-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-4">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="font-bold text-sm text-zinc-900 dark:text-white">{t('filter')}</span>
                  {(filterYears.length > 0 || filterSemesters.length > 0) && (
                    <button 
                      onClick={() => { setFilterYears([]); setFilterSemesters([]); }}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {t('clear_all') || (isAr ? 'مسح الكل' : 'Clear All')}
                    </button>
                  )}
                </div>

                <div className="mb-4">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{t('year')}</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Array.from({ length: settings.totalYears }).map((_, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-1.5 rounded-lg transition-colors">
                        <input 
                          type="checkbox" 
                          checked={filterYears.includes(i + 1)} 
                          onChange={() => toggleYear(i + 1)} 
                          className="rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700 bg-transparent" 
                        />
                        <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{t('year')} {i + 1}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{t('semester')}</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Array.from({ length: settings.semestersPerYear }).map((_, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-1.5 rounded-lg transition-colors">
                        <input 
                          type="checkbox" 
                          checked={filterSemesters.includes(i + 1)} 
                          onChange={() => toggleSemester(i + 1)} 
                          className="rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700 bg-transparent" 
                        />
                        <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{t('semester')} {i + 1}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Overview Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${gradEstimate ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-5`}>
        {/* cGPA Card */}
        <div className="bg-indigo-600 dark:bg-indigo-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-indigo-100 font-medium mb-1">{isAr ? 'المعدل التراكمي (cGPA)' : 'Cumulative GPA (cGPA)'}</h3>
            <div className="text-4xl font-black">{totalGPA > 0 ? totalGPA.toFixed(2) : '--'}</div>
          </div>
          <GraduationCap className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-20" />
        </div>

        {/* Graduation Estimate Card (When Enabled) */}
        {gradEstimate && (
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="relative z-10 space-y-1">
              <h3 className="text-purple-100 font-medium text-xs sm:text-sm">{isAr ? 'تقدير التخرج المتوقع' : 'Graduation Estimate'}</h3>
              <div className="text-2xl sm:text-3xl font-black">{isAr ? gradEstimate.nameAr : (gradEstimate.nameEn || gradEstimate.nameAr)}</div>
              <p className="text-xs text-purple-200 font-bold">{gradEstimate.letter}</p>
            </div>
            <Award className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-20" />
          </div>
        )}
        
        {/* GPA Card */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-zinc-500 font-medium mb-1">{isAr ? 'معدل الفصل المختار (GPA)' : 'Selected Semester (GPA)'}</h3>
              <div className="text-3xl font-black text-zinc-800 dark:text-zinc-100">
                {hasFilteredGrades && semesterGPA > 0 ? semesterGPA.toFixed(2) : (hasFilteredGrades ? '0.00' : '--')}
              </div>
            </div>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400">
              <BookOpen size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-zinc-500 font-medium mb-1">{t('subjects')}</h3>
              <div className="text-3xl font-black text-zinc-800 dark:text-zinc-100">{filteredSubjects.length}</div>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Library size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-zinc-500 font-medium mb-1">{isAr ? 'نقاط الضعف' : 'Weak Points'}</h3>
              <div className="text-3xl font-black text-zinc-800 dark:text-zinc-100">{warningSubjects.length}</div>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400">
              <TrendingDown size={24} />
            </div>
          </div>
        </div>
        
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Subjects Summary */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Library className="text-indigo-500" size={20} />
              {isAr ? 'ملخص المواد' : 'Subjects Summary'}
            </h2>
            <button onClick={() => navigate('/academic/subjects')} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              {isAr ? 'عرض الكل' : 'View All'}
            </button>
          </div>
          
          <div className="space-y-4">
            {filteredSubjects.slice(0, 4).map(subject => {
              const gradeInfo = calculateSubjectGrade(subject, settings.gradingScale);
              const isFinished = subject.status === 'finished';
              return (
                <div key={subject.id} onClick={() => navigate(`/academic/${subject.id}`)} className="group flex items-center justify-between p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-indigo-800/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer transition-all">
                  <div>
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{subject.name}</h3>
                    <p className="text-xs text-zinc-500 flex gap-2 mt-1">
                      <span>{subject.code}</span>
                      <span>&bull;</span>
                      <span className={isFinished ? 'text-emerald-500' : 'text-amber-500'}>{isFinished ? (isAr ? 'منتهية' : 'Finished') : (isAr ? 'حالية' : 'Current')}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    {gradeInfo ? (
                      <div>
                        <div className={`font-black text-lg ${gradeInfo.points >= 3.0 ? 'text-emerald-600 dark:text-emerald-400' : gradeInfo.points >= 2.0 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {gradeInfo.letter}
                        </div>
                        <div className="text-xs font-medium text-zinc-400">{gradeInfo.percentage.toFixed(0)}%</div>
                      </div>
                    ) : (
                      <span className="text-zinc-400">--</span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredSubjects.length === 0 && (
              <div className="text-center py-8 text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
                {isAr ? 'لا توجد مواد مضافة في هذا الفصل.' : 'No subjects added in this semester.'}
              </div>
            )}
          </div>
        </div>

        {/* Warnings and Improvements */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="text-rose-500" size={20} />
              {isAr ? 'الإنذارات ونقاط الضعف' : 'Warnings & Weak Points'}
            </h2>
            <button onClick={() => navigate('/academic/warnings')} className="text-sm font-medium text-rose-600 dark:text-rose-400 hover:underline">
              {isAr ? 'التفاصيل' : 'Details'}
            </button>
          </div>
          
          <div className="flex-1 space-y-4">
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
                <div key={subject.id} className="flex items-center gap-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30">
                  <div className="flex flex-col items-center justify-center p-2 min-w-[52px] rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex-shrink-0">
                    <span className="font-black text-lg leading-tight">{gradeInfo?.letter || 'F'}</span>
                    <span className="text-[10px] font-bold opacity-80">{(gradeInfo?.points || 0).toFixed(1)} GPA</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-rose-900 dark:text-rose-200">{subject.name}</h3>
                    <p className="text-xs text-rose-700 dark:text-rose-400/80 mt-0.5">
                      {isAr 
                        ? `معدل النقات (${(gradeInfo?.points || 0).toFixed(2)}) ضمن حد الإنذار (${threshold.points.toFixed(2)} - ${threshold.letter}).` 
                        : `Grade points (${(gradeInfo?.points || 0).toFixed(2)}) is at or below warning threshold (${threshold.points.toFixed(2)} - ${threshold.letter}).`}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {warningSubjects.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-8 text-emerald-600 dark:text-emerald-400">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-3">
                  <Target size={32} />
                </div>
                <p className="font-bold">{isAr ? 'أداؤك ممتاز!' : 'Excellent Performance!'}</p>
                <p className="text-sm mt-1 opacity-80">
                  {isAr 
                    ? `لا توجد إنذارات أو مواد بمعدل ${threshold.points.toFixed(2)} (${threshold.letter}) أو أقل.` 
                    : `No warnings or subjects at or below ${threshold.letter} (${threshold.points.toFixed(2)}).`}
                </p>
              </div>
            )}
          </div>
          
          {/* Recovery Plan Shortcut */}
          <div className="mt-6">
            <button onClick={() => navigate('/academic/recovery')} className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 transition-colors shadow-md">
              <div className="flex items-center gap-3">
                <Target size={20} />
                <span className="font-bold">{isAr ? 'توليد خطة تحسين (Recovery Plan)' : 'Generate Recovery Plan'}</span>
              </div>
              <ArrowRight className={isAr ? 'rotate-180' : ''} size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
