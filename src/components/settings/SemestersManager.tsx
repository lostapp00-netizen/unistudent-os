import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { RefreshCw, Calculator, BookPlus, Info, CheckCircle2 } from 'lucide-react';
import { SemesterInfo } from '../../types';

import { useAppStore } from '../../store/useAppStore';

interface Props {
  semesters: SemesterInfo[];
  totalYears: number;
  semestersPerYear: number;
  onChange: (newSemesters: SemesterInfo[]) => void;
  initialCumulativeGpa?: number | null;
  initialCompletedCreditHours?: number | null;
  setupMode?: 'initial_gpa' | 'manual_subjects';
  onInitialGpaChange?: (gpa: number | null, credits: number | null, mode: 'initial_gpa' | 'manual_subjects') => void;
}

export function SemestersManager({
  semesters,
  totalYears,
  semestersPerYear,
  onChange,
  initialCumulativeGpa,
  initialCompletedCreditHours,
  setupMode = 'initial_gpa',
  onInitialGpaChange
}: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings, subjects } = useAppStore();

  const isAr = i18n.language === 'ar' || settings.language === 'ar';

  const handleGenerate = () => {
    const newSemesters: SemesterInfo[] = [];
    let isCurrentFound = false;

    for (let y = 1; y <= totalYears; y++) {
      for (let s = 1; s <= semestersPerYear; s++) {
        const existing = semesters.find(ex => ex.yearIndex === y && ex.semesterIndex === s);
        
        if (existing) {
          if (existing.isCurrent) isCurrentFound = true;
          newSemesters.push(existing);
        } else {
          newSemesters.push({ 
            id: uuidv4(), 
            yearIndex: y, 
            semesterIndex: s, 
            startDate: '', 
            endDate: '', 
            isCurrent: false 
          });
        }
      }
    }
    
    // Ensure at least one is current if possible
    if (!isCurrentFound && newSemesters.length > 0) {
      newSemesters[0].isCurrent = true;
    }

    onChange(newSemesters);
  };

  const updateSemester = (id: string, field: keyof SemesterInfo, value: string | boolean) => {
    let newSemesters = [...semesters];

    if (field === 'isCurrent' && value === true) {
      // Unset isCurrent for all others
      newSemesters = newSemesters.map(s => ({ ...s, isCurrent: false }));
    }

    newSemesters = newSemesters.map(s => s.id === id ? { ...s, [field]: value } : s);
    onChange(newSemesters);
  };

  const currentSemester = semesters.find(s => s.isCurrent);
  const isBeyondFirstSemester = currentSemester && !(currentSemester.yearIndex === 1 && currentSemester.semesterIndex === 1);
  const hasRegisteredCoursesInFirstTerm = subjects.some(s => s.yearIndex === 1 && s.semesterIndex === 1);
  const shouldShowPastAcademicSetup = isBeyondFirstSemester && !hasRegisteredCoursesInFirstTerm;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold">{t('semesters_management')}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isAr ? 'حدد الفصل الدراسي الحالي لتخصيص حسابات المعدل والتنبيهات.' : 'Select your active semester to tailor GPA calculations.'}
          </p>
        </div>
        <button 
          onClick={handleGenerate}
          className="flex items-center gap-2 text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-xl transition-colors font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          {t('generate_semesters')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left rtl:text-right whitespace-nowrap">
          <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
            <tr>
              <th className="pb-3 px-2 font-medium">{t('year')}</th>
              <th className="pb-3 px-2 font-medium">{t('semester')}</th>
              <th className="pb-3 px-2 font-medium">{t('start_date')}</th>
              <th className="pb-3 px-2 font-medium">{t('end_date')}</th>
              <th className="pb-3 px-2 font-medium text-center">{t('current_semester')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {semesters.map((sem) => (
              <tr key={sem.id} className={`transition-colors ${sem.isCurrent ? 'bg-indigo-50/70 dark:bg-indigo-900/20 font-medium' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                <td className="py-3 px-2 text-zinc-800 dark:text-zinc-200">
                  {t('year')} {sem.yearIndex}
                </td>
                <td className="py-3 px-2 text-zinc-800 dark:text-zinc-200">
                  {t('semester')} {sem.semesterIndex}
                </td>
                <td className="py-2 px-1">
                  <input 
                    type="date" 
                    value={sem.startDate}
                    onChange={(e) => updateSemester(sem.id, 'startDate', e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent outline-none"
                  />
                </td>
                <td className="py-2 px-1">
                  <input 
                    type="date" 
                    value={sem.endDate}
                    onChange={(e) => updateSemester(sem.id, 'endDate', e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent outline-none"
                  />
                </td>
                <td className="py-2 px-1 text-center">
                  <input 
                    type="radio" 
                    name="currentSemester"
                    checked={sem.isCurrent}
                    onChange={() => updateSemester(sem.id, 'isCurrent', true)}
                    className="w-4 h-4 text-indigo-600 border-zinc-300 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 cursor-pointer"
                  />
                </td>
              </tr>
            ))}
            {semesters.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-6 text-zinc-400">
                  {isAr ? 'قم بتحديث الفصول الدراسية للبدء.' : 'Generate semesters to begin.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Past Academic Setup Options (Shown only when active semester is beyond Year 1 Sem 1 AND student has no subjects in Year 1 Sem 1) */}
      {shouldShowPastAcademicSetup && currentSemester && (
        <div className="mt-6 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-zinc-900 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {isAr ? 'إعداد السجل الأكاديمي للفصول السابقة' : 'Past Academic Records Setup'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {isAr 
                  ? `بما أنك في (السنة ${currentSemester.yearIndex} - الفصل ${currentSemester.semesterIndex})، يمكنك إما تسجيل معدلك التراكمي السابق مباشرة لحساب المعدل التراكمي الكلي، أو إضافة موادك السابقة يدوياً:`
                  : `Since your active semester is (Year ${currentSemester.yearIndex} - Semester ${currentSemester.semesterIndex}), choose how you want to handle prior academic history:`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Option A: Quick Initial GPA */}
            <div 
              onClick={() => onInitialGpaChange && onInitialGpaChange(initialCumulativeGpa ?? null, initialCompletedCreditHours ?? null, 'initial_gpa')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                setupMode === 'initial_gpa'
                  ? 'border-indigo-500 bg-white dark:bg-zinc-800 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/40 hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                  <Calculator size={16} className="text-indigo-600 dark:text-indigo-400" />
                  {isAr ? '1. إضافة معدلك التراكمي السابق' : '1. Enter Previous GPA'}
                </span>
                {setupMode === 'initial_gpa' && (
                  <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                {isAr 
                  ? 'سجل معدلك السابق وعدد الساعات وسيقوم التطبيق بالبناء عليه وإضافة موادك الحالية عليه تلقائياً.'
                  : 'Enter your prior GPA and completed credit hours; new courses will blend with it.'}
              </p>

              {setupMode === 'initial_gpa' && (
                <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-700/60" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                      {isAr ? 'المعدل التراكمي السابق (من 4.0 أو نظامك)' : 'Previous Cumulative GPA'}
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      max="5"
                      placeholder="e.g. 3.45"
                      value={initialCumulativeGpa ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        onInitialGpaChange && onInitialGpaChange(val, initialCompletedCreditHours ?? null, 'initial_gpa');
                      }}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                      {isAr ? 'إجمالي الساعات المكتسبة السابقة' : 'Previous Completed Credit Hours'}
                    </label>
                    <input 
                      type="number"
                      step="1"
                      min="0"
                      placeholder="e.g. 30"
                      value={initialCompletedCreditHours ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        onInitialGpaChange && onInitialGpaChange(initialCumulativeGpa ?? null, val, 'initial_gpa');
                      }}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Option B: Add Old Subjects Manually */}
            <div 
              onClick={() => onInitialGpaChange && onInitialGpaChange(initialCumulativeGpa ?? null, initialCompletedCreditHours ?? null, 'manual_subjects')}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                setupMode === 'manual_subjects'
                  ? 'border-indigo-500 bg-white dark:bg-zinc-800 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/40 hover:border-zinc-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <BookPlus size={16} className="text-indigo-600 dark:text-indigo-400" />
                    {isAr ? '2. إضافة موادك القديمة يدوياً' : '2. Add Old Subjects Manually'}
                  </span>
                  {setupMode === 'manual_subjects' && (
                    <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 mb-4">
                  {isAr 
                    ? 'إذا كنت تفضل إدخال المواد القديمة مادة بمادة وتقدير كل مادة بنفسك في سجل المواد.'
                    : 'If you prefer entering all past courses and their grades manually.'}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInitialGpaChange && onInitialGpaChange(null, null, 'manual_subjects');
                  navigate('/academic/subjects');
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors border border-indigo-200 dark:border-indigo-800"
              >
                <BookPlus size={14} />
                {isAr ? 'الانتقال لصفحة المواد لإضافة المواد القديمة' : 'Go to Subjects Page to Add Past Courses'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
