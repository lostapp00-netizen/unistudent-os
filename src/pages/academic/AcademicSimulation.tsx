import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { calculateGPA, calculateSubjectGrade } from '../../lib/academic';
import { ArrowLeft, Calculator, Save, RefreshCw } from 'lucide-react';
import { Subject, GradeRule } from '../../types';

export function AcademicSimulation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subjects, settings } = useAppStore();
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  
  // Create a deep copy of subjects for the current semester to simulate
  const [simulatedSubjects, setSimulatedSubjects] = useState<Subject[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (currentSemester) {
      const currentSubjects = subjects.filter(
        s => s.yearIndex === currentSemester.yearIndex && s.semesterIndex === currentSemester.semesterIndex
      );
      // Deep copy to allow independent edits
      setSimulatedSubjects(JSON.parse(JSON.stringify(currentSubjects)));
    }
  }, [subjects, currentSemester]);

  const updateSimulatedMarks = (subjectId: string, distId: string, value: string) => {
    const numValue = value === '' ? null : Number(value);
    setSimulatedSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      const newDists = sub.distributions.map(d => 
        d.id === distId ? { ...d, achievedMarks: numValue } : d
      );
      return { ...sub, distributions: newDists };
    }));
  };

  const resetSimulation = () => {
    if (currentSemester) {
      const currentSubjects = subjects.filter(
        s => s.yearIndex === currentSemester.yearIndex && s.semesterIndex === currentSemester.semesterIndex
      );
      setSimulatedSubjects(JSON.parse(JSON.stringify(currentSubjects)));
    }
  };

  const simulatedGPA = calculateGPA(simulatedSubjects, settings.gradingScale, currentSemester?.yearIndex, currentSemester?.semesterIndex);
  
  const isAr = settings.language === 'ar';

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/academic')}
          className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft size={20} className={isAr ? "rotate-180" : ""} />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Calculator className="text-indigo-600" />
            {isAr ? 'محاكاة المعدل (GPA)' : 'GPA Simulation'}
          </h1>
          <p className="text-zinc-500 mt-1">
            {isAr ? 'قم بتجربة درجات مختلفة لترى تأثيرها على المعدل التراكمي للفصل الحالي' : 'Experiment with different grades to see their impact on your semester GPA'}
          </p>
        </div>
      </header>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-1">
            {isAr ? 'المعدل المتوقع للفصل' : 'Expected Semester GPA'}
          </p>
          <div className="text-5xl font-black text-indigo-600 dark:text-indigo-400">
            {simulatedGPA > 0 ? simulatedGPA.toFixed(2) : '--'}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <input 
              type="checkbox" 
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium">{isAr ? 'إظهار كل المواد (بما فيها المنتهية)' : 'Show all subjects (including finished)'}</span>
          </label>
          <button 
            onClick={resetSimulation}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors font-medium"
          >
            <RefreshCw size={18} />
            {isAr ? 'إعادة ضبط' : 'Reset'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {simulatedSubjects.filter(s => {
          const isFullyLocked = s.status === 'finished' || (s.distributions.length > 0 && s.distributions.every(d => d.status === 'final'));
          return showAll || !isFullyLocked;
        }).map(subject => {
          const gradeInfo = calculateSubjectGrade(subject, settings.gradingScale);
          const isFinished = subject.status === 'finished';
          return (
            <div key={subject.id} className={`bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border ${isFinished ? 'border-emerald-200 dark:border-emerald-900/50 opacity-80' : 'border-zinc-200 dark:border-zinc-800'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{subject.name}</h3>
                  <p className="text-sm text-zinc-500 flex items-center gap-2">
                    <span>{subject.creditHours} {isAr ? 'ساعات' : 'Credits'}</span>
                    {isFinished && (
                      <>
                        <span>&bull;</span>
                        <span className="text-emerald-500 font-bold">{isAr ? 'مغلقة' : 'Locked'}</span>
                      </>
                    )}
                  </p>
                </div>
                {gradeInfo && (
                  <div className="flex flex-col items-end">
                    <span className={`text-2xl font-black ${isFinished ? 'text-emerald-600' : 'text-indigo-600'}`}>{gradeInfo.letter}</span>
                    <span className="text-xs font-bold text-zinc-400">{gradeInfo.percentage.toFixed(1)}%</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {subject.distributions.map(dist => (
                  <div key={dist.id} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{dist.name}</span>
                      <span className="text-zinc-500">{dist.maxMarks} {isAr ? 'درجة' : 'marks'} {dist.status === 'final' && <span className="text-emerald-500 text-xs mr-2">(نهائي)</span>}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={dist.maxMarks}
                        disabled={isFinished || dist.status === 'final'}
                        value={dist.achievedMarks !== null && dist.achievedMarks !== undefined ? dist.achievedMarks : ''}
                        onChange={(e) => updateSimulatedMarks(subject.id, dist.id, e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder={isAr ? 'الدرجة...' : 'Mark...'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {simulatedSubjects.filter(s => showAll || s.status !== 'finished').length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          {isAr ? 'لا توجد مواد مضافة في الفصل الدراسي الحالي لمحاكاتها.' : 'No subjects added in the current semester to simulate.'}
        </div>
      )}
    </div>
  );
}
