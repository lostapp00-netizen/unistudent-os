import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { calculateSubjectGrade } from '../../lib/academic';
import { AlertTriangle, ArrowLeft, ArrowRight, ShieldAlert, Target } from 'lucide-react';

export function AcademicWarnings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subjects, settings } = useAppStore();
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  
  const currentSubjects = subjects.filter(
    s => s.yearIndex === currentSemester?.yearIndex && s.semesterIndex === currentSemester?.semesterIndex
  );

  const warningSubjects = currentSubjects.filter(s => {
    const grade = calculateSubjectGrade(s, settings.gradingScale);
    return grade && grade.points < 2.0;
  });

  const isAr = settings.language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/academic')}
          className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <BackIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <AlertTriangle className="text-rose-500" />
            {t('warnings_improvements')}
          </h1>
          <p className="text-zinc-500 mt-1">
            {isAr ? 'نقاط الضعف والمواد التي تحتاج إلى تحسين في الفصل الحالي' : 'Weak points and subjects needing improvement this semester'}
          </p>
        </div>
      </header>

      <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 rounded-3xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/50 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-rose-900 dark:text-rose-200 mb-2">
              {isAr ? 'حالة الإنذارات الأكاديمية' : 'Academic Warnings Status'}
            </h2>
            <p className="text-rose-700 dark:text-rose-400/80 leading-relaxed">
              {isAr 
                ? 'يتم تحديد المواد كإنذار أكاديمي إذا كان معدل النقاط الخاص بها أقل من 2.0 (أقل من C). يجب التركيز على هذه المواد لتجنب انخفاض المعدل التراكمي.' 
                : 'Subjects are flagged as an academic warning if their grade points are below 2.0 (below C). You should focus on these subjects to avoid a GPA drop.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-lg mb-2">{isAr ? 'المواد المعرضة للخطر' : 'Subjects at Risk'}</h3>
        
        {warningSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {warningSubjects.map(subject => {
              const gradeInfo = calculateSubjectGrade(subject, settings.gradingScale);
              const isFinished = subject.status === 'finished';
              
              return (
                <div key={subject.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-lg text-zinc-800 dark:text-zinc-200">{subject.name}</h4>
                      <p className="text-sm text-zinc-500 mt-1">{subject.code} • {subject.creditHours} {isAr ? 'ساعات' : 'Credits'}</p>
                    </div>
                    <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center font-black text-xl">
                      {gradeInfo?.letter}
                    </div>
                  </div>
                  
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 mb-4 flex-1 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-500">{isAr ? 'الدرجة المحققة' : 'Achieved'}</span>
                      <span className="font-bold">{gradeInfo?.totalAchieved} / {subject.totalMarks}</span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                      <div 
                        className="bg-rose-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, gradeInfo?.percentage || 0)}%` }}
                      ></div>
                    </div>
                    <div className="mt-3 text-xs text-rose-600 dark:text-rose-400 font-medium text-center">
                      {isFinished 
                        ? (isAr ? 'المادة منتهية ولم يعد بالإمكان تحسين درجاتها.' : 'Subject finished, grades cannot be improved.') 
                        : (isAr ? 'لا يزال بإمكانك تحسين درجاتك في هذه المادة!' : 'You can still improve your grades in this subject!')}
                    </div>
                  </div>
                  
                  {!isFinished && (
                    <button 
                      onClick={() => navigate(`/academic/${subject.id}`)}
                      className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold transition-colors"
                    >
                      {isAr ? 'تحديث الدرجات' : 'Update Grades'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-zinc-200 dark:border-zinc-800 flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mb-4">
              <Target size={40} />
            </div>
            <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
              {isAr ? 'لا توجد أي إنذارات' : 'No Warnings'}
            </h3>
            <p className="text-zinc-500 max-w-md">
              {isAr 
                ? 'عمل رائع! جميع درجاتك الحالية فوق مستوى الإنذار الأكاديمي. استمر في هذا الأداء.' 
                : 'Great job! All your current grades are above the warning level. Keep up the good work.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
