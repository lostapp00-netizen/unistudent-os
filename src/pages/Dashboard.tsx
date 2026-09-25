import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { calculateGPA, calculateSubjectGrade, getWarningThreshold, isSubjectAtWarningRisk, calculateGraduationEstimate, calculateOverallGrade, getPointsSummary, getWarningThresholdPercentage, isSubjectAtPercentageRisk } from '../lib/academic';
import { BookOpen, AlertTriangle, CheckCircle, Clock, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../components/ui/UnifiedSemesterFilter';

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, subjects, tasks, files } = useAppStore();

  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const totalGPA = calculateGPA(subjects, settings.gradingScale, undefined, undefined, settings.initialCumulativeGpa, settings.initialCompletedCreditHours);
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);

  // Re-sync the default filter whenever the CURRENT SEMESTER changes (e.g.
  // after a university-database restore) so stats always reflect the latest
  // subjects instead of staying frozen at the mount-time semester.
  useEffect(() => {
    setFilterYears(currentSemester ? [currentSemester.yearIndex] : []);
    setFilterSemesters(currentSemester ? [currentSemester.semesterIndex] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSemester?.yearIndex, currentSemester?.semesterIndex]);

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
  
  const driveFilesOnly = files.filter(f => f.type !== 'folder');
  const totalFileSize = driveFilesOnly.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
  const totalFileSizeMB = (totalFileSize / (1024 * 1024)).toFixed(1);

  const isAr = settings.language === 'ar';
  // نظام الحساب: GPA أو النقط. الحسابات المشتركة (الدرجات) واحدة في الحالتين.
  const gradingSystem = settings.gradingSystem === 'points' ? 'points' : 'gpa';
  const overallGrade = calculateOverallGrade(subjects, settings.gradingScale);
  const pointsSummary = getPointsSummary(settings, subjects, { years: filterYears, semesters: filterSemesters });

  const threshold = getWarningThreshold(settings);
  const warningThresholdPercentage = getWarningThresholdPercentage(settings);
  const warningSubjects = gradingSystem === 'points'
    ? filteredSubjects.filter(s => isSubjectAtPercentageRisk(s, settings.gradingScale, warningThresholdPercentage))
    : filteredSubjects.filter(s => isSubjectAtWarningRisk(s, settings.gradingScale, threshold.points));

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
            {t('welcome', { name: settings.name || 'Student' })}
          </h2>
          <div className="mt-1.5 flex items-center gap-2">
            <UnifiedFilterBadge 
              filterYears={filterYears} 
              filterSemesters={filterSemesters} 
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <UnifiedSemesterFilter
            filterYears={filterYears}
            filterSemesters={filterSemesters}
            setFilterYears={setFilterYears}
            setFilterSemesters={setFilterSemesters}
          />

          {/* نظام الحساب: GPA أو النقط */}
          {gradingSystem === 'points' ? (
            <>
              {/* النقط التراكمية */}
              <div
                onClick={() => navigate('/academic')}
                className="bg-emerald-600 dark:bg-emerald-900 text-white p-3 px-4 rounded-2xl shadow-sm cursor-pointer hover:opacity-95 transition-opacity text-center min-w-[130px]"
                title={isAr ? 'النقط التراكمية المجمعة' : 'Cumulative points'}
              >
                <p className="text-[11px] text-emerald-100 uppercase font-bold tracking-wider">{isAr ? 'النقط التراكمية' : 'Points'}</p>
                <p className="text-xl font-black">
                  {pointsSummary ? pointsSummary.points.toFixed(1) : '--'}
                  {pointsSummary && pointsSummary.totalPoints > 0 && (
                    <span className="text-xs font-bold text-emerald-100"> / {pointsSummary.totalPoints}</span>
                  )}
                </p>
              </div>

              {/* النقط الفصلية */}
              <div
                onClick={() => navigate('/academic')}
                className="bg-white dark:bg-zinc-900 p-3 px-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-center min-w-[110px]"
                title={isAr ? 'نقط الفصل المحدد بالفلتر' : 'Selected term points'}
              >
                <p className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider">{isAr ? 'نقط الفصل' : 'Term'}</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {pointsSummary ? pointsSummary.termPoints.toFixed(1) : '--'}
                </p>
              </div>

              {/* المتبقي للتوتال */}
              {pointsSummary && pointsSummary.totalPoints > 0 && (
                <div
                  onClick={() => navigate('/academic')}
                  className="bg-white dark:bg-zinc-900 p-3 px-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-center min-w-[110px]"
                  title={isAr ? 'النقط المتبقية للتوتال' : 'Points left to the total'}
                >
                  <p className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider">{isAr ? 'المتبقي' : 'Left'}</p>
                  <p className="text-xl font-black text-zinc-700 dark:text-zinc-200">
                    {pointsSummary.remainingPoints.toFixed(1)}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
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
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 px-4 rounded-2xl shadow-md shadow-blue-500/20 cursor-pointer hover:opacity-95 transition-opacity text-center min-w-[110px]"
                    title={isAr ? 'تقدير التخرج التراكمي' : 'Graduation Estimate'}
                  >
                    <p className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">{isAr ? 'تقدير التخرج' : 'Graduation'}</p>
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
            </>
          )}

          {/* التقدير الحالي العام: الرمز + الاسم + النسبة المئوية */}
          <div
            onClick={() => navigate('/academic')}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-3 px-4 rounded-2xl shadow-sm cursor-pointer hover:opacity-95 transition-opacity text-center min-w-[130px]"
            title={isAr ? 'التقدير الحالي العام (كل السنوات)' : 'Current overall grade'}
          >
            <p className="text-[10px] text-amber-100 uppercase font-bold tracking-wider">{isAr ? 'التقدير العام' : 'Overall Grade'}</p>
            <p className="text-lg font-black leading-tight flex items-center justify-center gap-1.5">
              <span>{overallGrade ? overallGrade.letter : '--'}</span>
              {overallGrade && (
                <span className="text-[10px] font-bold text-amber-100">
                  {overallGrade.percentage.toFixed(1)}%
                </span>
              )}
            </p>
            <p className="text-[10px] font-bold text-amber-100 truncate max-w-[120px]">
              {overallGrade ? (isAr ? overallGrade.nameAr : (overallGrade.nameEn || overallGrade.nameAr)) : (isAr ? 'لا توجد درجات بعد' : 'No grades yet')}
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
                    {gradingSystem === 'points' ? (() => {
                      const subGrade = calculateSubjectGrade(sub, settings.gradingScale);
                      const perPoint = Number(pointsSummary?.marksPerPoint || 0);
                      return (
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {subGrade && perPoint > 0 ? `${(subGrade.totalAchieved / perPoint).toFixed(1)} ${settings.language === 'ar' ? 'نقطة' : 'pts'}` : '--'}
                          <span className="block text-[10px] font-bold text-zinc-400">
                            {subGrade ? `${subGrade.totalAchieved} / ${sub.totalMarks}` : (settings.language === 'ar' ? 'لا درجات' : 'no marks')}
                          </span>
                        </p>
                      );
                    })() : (
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{sub.creditHours} {settings.language === 'ar' ? 'ساعات' : 'Hrs'}</p>
                    )}
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
              {driveFilesOnly.length} {settings.language === 'ar' ? 'ملفات' : 'files'}
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
                      <span className="text-[9px] font-bold opacity-80">
                        {gradingSystem === 'points'
                          ? `${(gradeInfo?.percentage || 0).toFixed(1)}%`
                          : `${(gradeInfo?.points || 0).toFixed(1)} GPA`}
                      </span>
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
