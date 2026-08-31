import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { calculateGPA, calculateSubjectGrade, getWarningThreshold, isSubjectAtWarningRisk, calculateGraduationEstimate } from '../lib/academic';
import { BookOpen, AlertTriangle, CheckCircle, Clock, Filter, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, subjects, tasks, files } = useAppStore();

  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const totalGPA = calculateGPA(subjects, settings.gradingScale, undefined, undefined, settings.initialCumulativeGpa, settings.initialCompletedCreditHours);
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

  const toggleYear = (y: number) => {
    setFilterYears(prev => prev.includes(y) ? prev.filter(yr => yr !== y) : [...prev, y]);
  };

  const toggleSemester = (s: number) => {
    setFilterSemesters(prev => prev.includes(s) ? prev.filter(sem => sem !== s) : [...prev, s]);
  };

  const filteredSubjects = subjects.filter(s => 
    (filterYears.length === 0 || filterYears.includes(s.yearIndex)) &&
    (filterSemesters.length === 0 || filterSemesters.includes(s.semesterIndex))
  );

  const hasFilteredGrades = filteredSubjects.some(s => {
    const grade = calculateSubjectGrade(s, settings.gradingScale);
    return (grade && grade.totalAchieved > 0) || !!s.finalGradeLetter;
  });

  const semesterGPA = calculateGPA(
    filteredSubjects, 
    settings.gradingScale
  );

  const pendingTasks = tasks.filter(t => !t.isCompleted);
  
  const totalFileSize = files.reduce((acc, f) => acc + f.size, 0);
  const totalFileSizeMB = (totalFileSize / (1024 * 1024)).toFixed(1);

  const threshold = getWarningThreshold(settings);
  const warningSubjects = filteredSubjects.filter(s => 
    isSubjectAtWarningRisk(s, settings.gradingScale, threshold.points)
  );

  const isAr = settings.language === 'ar';

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-extrabold">{t('welcome', { name: settings.name || 'Student' })}</h2>
          <p className="text-zinc-500 mt-1">
            {filterYears.length === 1 && filterSemesters.length === 1
               ? `${isAr ? 'السنة' : 'Year'} ${filterYears[0]} | ${isAr ? 'الفصل' : 'Semester'} ${filterSemesters[0]}`
               : (filterYears.length === 0 && filterSemesters.length === 0 ? (isAr ? 'جميع الفصول' : 'All Semesters') : (isAr ? 'فصول متعددة' : 'Multiple Semesters'))}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div ref={filterPopoverRef} className="relative z-20">
            <button 
              onClick={() => setShowFilterPopover(!showFilterPopover)}
              className={`h-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium transition-colors border shadow-sm ${
                filterYears.length > 0 || filterSemesters.length > 0 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' 
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Filter size={18} />
              {(filterYears.length > 0 || filterSemesters.length > 0) && (
                <span className="flex items-center justify-center bg-indigo-600 text-white w-5 h-5 rounded-full text-xs ml-1">
                  {filterYears.length + filterSemesters.length}
                </span>
              )}
            </button>
            
            {showFilterPopover && (
              <div className="absolute top-full right-0 rtl:right-auto rtl:left-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-4">
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

          {/* cGPA (المعدل التراكمي الكلي) */}
          <div 
            onClick={() => navigate('/academic')}
            className="bg-indigo-600 dark:bg-indigo-900 text-white p-3 px-4 rounded-2xl shadow-sm cursor-pointer hover:opacity-95 transition-opacity text-center min-w-[95px]"
            title={isAr ? 'المعدل التراكمي الكلي' : 'Cumulative GPA'}
          >
            <p className="text-[11px] text-indigo-200 uppercase font-bold tracking-wider">{isAr ? 'التراكمي cGPA' : 'cGPA'}</p>
            <p className="text-xl font-black">{totalGPA > 0 ? totalGPA.toFixed(2) : '--'}</p>
          </div>

          {/* Graduation Estimate Badge if Enabled */}
          {settings.enableGraduationScale && settings.graduationGradingScale && settings.graduationGradingScale.length > 0 && totalGPA > 0 && (() => {
            const est = calculateGraduationEstimate(totalGPA, undefined, settings.graduationGradingScale);
            if (!est) return null;
            return (
              <div
                onClick={() => navigate('/academic')}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-3 px-4 rounded-2xl shadow-sm cursor-pointer hover:opacity-95 transition-opacity text-center min-w-[110px]"
                title={isAr ? 'تقدير التخرج التراكمي' : 'Graduation Estimate'}
              >
                <p className="text-[10px] text-purple-200 uppercase font-bold tracking-wider">{isAr ? 'تقدير التخرج' : 'Graduation'}</p>
                <p className="text-xs sm:text-sm font-black truncate">{isAr ? est.nameAr : (est.nameEn || est.nameAr)}</p>
              </div>
            );
          })()}

          {/* GPA (معدل الفصل المختار) */}
          <div 
            onClick={() => navigate('/academic')}
            className="bg-white dark:bg-zinc-900 p-3 px-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-center min-w-[95px]"
            title={isAr ? 'معدل الفصل المختار' : 'Semester GPA'}
          >
            <p className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider">{isAr ? 'الفصل GPA' : 'GPA'}</p>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {hasFilteredGrades && semesterGPA > 0 ? semesterGPA.toFixed(2) : (hasFilteredGrades ? '0.00' : '--')}
            </p>
          </div>

          {/* Pending Tasks */}
          <div className="bg-white dark:bg-zinc-900 p-3 px-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center min-w-[85px] cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors" onClick={() => navigate('/productivity')}>
            <p className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider">{isAr ? 'المهام' : 'Tasks'}</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{pendingTasks.length}</p>
          </div>
        </div>
      </header>

      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4">
        {/* Academic/Subjects Card */}
        <div className="md:col-span-8 md:row-span-3 bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">{t('academic')} ({filteredSubjects.length})</h3>
            <button onClick={() => navigate('/academic')} className="text-xs bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              {settings.language === 'ar' ? 'عرض الكل' : 'View All'}
            </button>
          </div>
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2">
            {filteredSubjects.length > 0 ? (
              filteredSubjects.map(sub => (
                <div key={sub.id} onClick={() => navigate(`/academic/${sub.id}`)} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{sub.name}</p>
                      <p className="text-[10px] text-zinc-500">{sub.code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{sub.creditHours} {settings.language === 'ar' ? 'ساعات' : 'Hrs'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
                {settings.language === 'ar' ? 'لا توجد مواد مضافة لهذا الفصل.' : 'No subjects added for this semester.'}
              </div>
            )}
          </div>
        </div>

        {/* Urgent Tasks Card */}
        <div className="md:col-span-4 md:row-span-4 bg-indigo-600 dark:bg-zinc-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col cursor-pointer hover:shadow-2xl transition-all" onClick={() => navigate('/productivity')}>
          <div className="relative z-10 flex flex-col h-full">
            <h3 className="font-bold text-lg mb-4">{settings.language === 'ar' ? 'المهام العاجلة' : 'Urgent Tasks'}</h3>
            <div className="flex-1 flex flex-col gap-3">
              {pendingTasks.slice(0, 3).length > 0 ? pendingTasks.slice(0, 3).map(task => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/5">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'high' ? 'bg-red-400' : task.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-white/50 truncate flex items-center gap-1 mt-0.5">
                      <Clock size={12} /> {task.date || 'No date'}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="flex-1 flex flex-col items-center justify-center text-white/50 text-sm">
                  <CheckCircle size={32} className="mb-2 opacity-50" />
                  {settings.language === 'ar' ? 'تم إنجاز كل المهام!' : 'All caught up!'}
                </div>
              )}
            </div>
          </div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 dark:bg-indigo-500/20 blur-3xl rounded-full"></div>
        </div>

        {/* Storage/Drive Card */}
        <div className="md:col-span-4 md:row-span-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl p-6 border border-indigo-100 dark:border-indigo-500/30 flex flex-col cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors" onClick={() => navigate('/productivity')}>
          <h3 className="font-bold text-lg mb-2 text-indigo-900 dark:text-indigo-300">{settings.language === 'ar' ? 'مساحة التخزين' : 'Storage'}</h3>
          <div className="flex-1 flex flex-col justify-center text-center">
            <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400 mb-1">{totalFileSizeMB} <span className="text-lg">MB</span></div>
            <p className="text-xs text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-4">
              {settings.language === 'ar' ? 'مستخدم محلياً' : 'Local Usage'}
            </p>
            <div className="text-xs font-medium bg-white/50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 py-1.5 px-3 rounded-full inline-block mx-auto">
              {files.length} {settings.language === 'ar' ? 'عناصر' : 'items'}
            </div>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="md:col-span-4 md:row-span-3 bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col cursor-pointer hover:bg-zinc-50 transition-colors" onClick={() => navigate('/productivity')}>
          <h3 className="font-bold text-lg mb-4">{settings.language === 'ar' ? 'الجدول الزمني' : 'Timeline'}</h3>
          <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm flex-col">
            <Clock size={32} className="mb-2 opacity-30 text-indigo-500" />
            {settings.language === 'ar' ? 'التقويم قيد العمل' : 'Check your schedule'}
          </div>
        </div>

        {/* Advice Card */}
        <div className="md:col-span-4 md:row-span-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl p-6 border border-emerald-100 dark:border-emerald-500/30 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">{settings.language === 'ar' ? 'نصيحة أكاديمية' : 'Academic Advice'}</h3>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed italic">
            {filteredSubjects.length === 0
              ? (settings.language === 'ar' ? 'قم بإضافة المواد الدراسية للفصل الحالي للبدء في تتبع درجاتك.' : 'Add subjects for the current semester to start tracking grades.')
              : warningSubjects.length > 0 
              ? (settings.language === 'ar' ? 'لديك مواد معرضة للخطر الأكاديمي، يرجى التركيز عليها هذا الفصل.' : 'You have subjects at academic risk, please focus on them.')
              : pendingTasks.length > 0
              ? (settings.language === 'ar' ? 'أداؤك يبدو مستقراً. لديك مهام معلقة تحتاج إلى إنجازها!' : 'Your performance is on track. You have pending tasks to complete!')
              : (settings.language === 'ar' ? 'أداؤك يبدو مستقراً. احرص على تدوين الدرجات أولاً بأول للحصول على إحصائيات دقيقة.' : 'Your performance looks stable. Keep logging grades for accurate stats.')
            }
          </p>
        </div>

        {/* Warnings Card */}
        {warningSubjects.length > 0 && (
          <div className="md:col-span-8 md:row-span-2 bg-rose-50 dark:bg-rose-900/10 rounded-3xl p-6 border border-rose-200 dark:border-rose-900/30 flex flex-col cursor-pointer transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/20" onClick={() => navigate('/academic/warnings')}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <h3 className="font-bold text-sm text-rose-800 dark:text-rose-300">{settings.language === 'ar' ? 'إنذارات أكاديمية' : 'Academic Warnings'}</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 flex-1 items-center hide-scrollbar">
              {warningSubjects.map(sub => {
                let gradeInfo = calculateSubjectGrade(sub, settings.gradingScale);
                if (!gradeInfo && sub.finalGradeLetter) {
                  const rule = settings.gradingScale.find(r => r.letter === sub.finalGradeLetter);
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
                  <div key={sub.id} className="bg-white dark:bg-zinc-900 border border-rose-100 dark:border-rose-900/50 rounded-2xl p-3 min-w-[210px] flex items-center justify-between shadow-sm flex-shrink-0">
                    <div>
                      <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate max-w-[125px]">{sub.name}</p>
                      <p className="text-[10px] text-zinc-500">{sub.code}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                      <span className="font-black text-sm leading-tight">{gradeInfo?.letter || 'F'}</span>
                      <span className="text-[9px] font-bold opacity-80">{(gradeInfo?.points || 0).toFixed(1)} GPA</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
