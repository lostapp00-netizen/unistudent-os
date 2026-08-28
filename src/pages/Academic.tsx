import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store/useAppStore';
import { calculateSubjectGrade, calculateGPA } from '../lib/academic';
import { Plus, ChevronLeft, ChevronRight, AlertTriangle, Filter, Check } from 'lucide-react';

export function Academic() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subjects, settings, addSubject } = useAppStore();
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : [1]);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : [1]);
  const [showAddModal, setShowAddModal] = useState(false);
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

  const [newSubject, setNewSubject] = useState({
    code: '',
    name: '',
    creditHours: 3,
    totalMarks: 100,
    yearIndex: filterYears.length === 1 ? filterYears[0] : (currentSemester?.yearIndex || 1),
    semesterIndex: filterSemesters.length === 1 ? filterSemesters[0] : (currentSemester?.semesterIndex || 1)
  });

  const handleAddSubject = () => {
    if (!newSubject.name || !newSubject.code) return;
    
    const subject = {
      id: uuidv4(),
      ...newSubject,
      distributions: []
    };
    
    addSubject(subject);
    setShowAddModal(false);
    navigate(`/academic/${subject.id}`);
  };

  const filteredSubjects = subjects.filter(s => 
    (filterYears.length === 0 || filterYears.includes(s.yearIndex)) && 
    (filterSemesters.length === 0 || filterSemesters.includes(s.semesterIndex))
  );

  const semesterGPA = calculateGPA(subjects, settings.gradingScale, filterYears.length === 1 ? filterYears[0] : undefined, filterSemesters.length === 1 ? filterSemesters[0] : undefined);
  const totalGPA = calculateGPA(subjects, settings.gradingScale);

  // Warnings: Subjects with Grade < C (Points < 2.0)
  const warningSubjects = filteredSubjects.filter(s => {
    const grade = calculateSubjectGrade(s, settings.gradingScale);
    return grade && grade.points < 2.0;
  });

  const toggleYear = (y: number) => {
    setFilterYears(prev => prev.includes(y) ? prev.filter(yr => yr !== y) : [...prev, y]);
  };

  const toggleSemester = (s: number) => {
    setFilterSemesters(prev => prev.includes(s) ? prev.filter(sem => sem !== s) : [...prev, s]);
  };

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t('academic')}</h1>
          <p className="text-zinc-500 mt-1">{t('gpa')}: {totalGPA > 0 ? totalGPA : '--'} | الفصل المختار: {semesterGPA > 0 ? semesterGPA : '--'}</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center relative">
          <div ref={filterPopoverRef} className="relative">
            <button 
              onClick={() => setShowFilterPopover(!showFilterPopover)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                filterYears.length > 0 || filterSemesters.length > 0 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' 
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Filter size={16} />
              {t('filter')}
              {(filterYears.length > 0 || filterSemesters.length > 0) && (
                <span className="flex items-center justify-center bg-indigo-600 text-white w-5 h-5 rounded-full text-xs ml-1">
                  {filterYears.length + filterSemesters.length}
                </span>
              )}
            </button>
            
            {showFilterPopover && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-10 p-4">
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{t('year')}</h4>
                  <div className="space-y-1">
                    {Array.from({ length: settings.totalYears }).map((_, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-1.5 rounded-lg transition-colors">
                        <input 
                          type="checkbox" 
                          checked={filterYears.includes(i + 1)}
                          onChange={() => toggleYear(i + 1)}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 bg-transparent"
                        />
                        {t('year')} {i + 1}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{t('semester')}</h4>
                  <div className="space-y-1">
                    {Array.from({ length: settings.semestersPerYear }).map((_, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-1.5 rounded-lg transition-colors">
                        <input 
                          type="checkbox" 
                          checked={filterSemesters.includes(i + 1)}
                          onChange={() => toggleSemester(i + 1)}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 bg-transparent"
                        />
                        {t('semester')} {i + 1}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('add_subject')}
          </button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-lg font-bold">{t('subjects')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-medium">{t('subject_name')}</th>
                  <th className="px-6 py-4 font-medium">{t('subject_code')}</th>
                  <th className="px-6 py-4 font-medium text-center">{t('credit_hours')}</th>
                  <th className="px-6 py-4 font-medium text-center">{t('total_marks')}</th>
                  <th className="px-6 py-4 font-medium text-center">{t('current_grade')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredSubjects.map(subject => {
                  const gradeInfo = calculateSubjectGrade(subject, settings.gradingScale);
                  return (
                    <tr 
                      key={subject.id} 
                      onClick={() => navigate(`/academic/${subject.id}`)}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4 font-bold text-indigo-700 dark:text-indigo-400 group-hover:text-indigo-800 dark:group-hover:text-indigo-300">
                        {subject.name}
                      </td>
                      <td className="px-6 py-4 text-zinc-500">{subject.code}</td>
                      <td className="px-6 py-4 text-center">{subject.creditHours}</td>
                      <td className="px-6 py-4 text-center">{subject.totalMarks}</td>
                      <td className="px-6 py-4 text-center font-bold">
                        {gradeInfo ? (
                          <span className={gradeInfo.points >= 3.0 ? 'text-emerald-600' : gradeInfo.points >= 2.0 ? 'text-amber-500' : 'text-rose-500'}>
                            {gradeInfo.letter} ({gradeInfo.totalAchieved})
                          </span>
                        ) : (
                          <span className="text-zinc-400">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredSubjects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">
                      لا توجد مواد مضافة في هذا الفصل الدراسي.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:col-span-4 flex flex-col gap-6">
          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-3xl p-6 border border-amber-100 dark:border-amber-900/30">
            <div className="flex items-center gap-3 mb-4 text-amber-800 dark:text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-lg">{t('academic_warnings')}</h3>
            </div>
            {warningSubjects.length > 0 ? (
              <ul className="space-y-3">
                {warningSubjects.map(s => {
                  const g = calculateSubjectGrade(s, settings.gradingScale);
                  return (
                    <li key={s.id} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 text-sm">
                      <span className="font-bold block mb-1">{s.name}</span>
                      <span className="text-zinc-500">التقدير الحالي: {g?.letter}. تحتاج لخطة تعويض للوصول لمعدل آمن.</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-amber-700 dark:text-amber-600/70 text-sm">لا توجد إنذارات أكاديمية. أداؤك مستقر!</p>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-2xl font-bold mb-6">{t('add_subject')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('subject_name')}</label>
                <input type="text" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('subject_code')}</label>
                <input type="text" value={newSubject.code} onChange={e => setNewSubject({...newSubject, code: e.target.value})} className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('credit_hours')}</label>
                  <input type="number" min="1" value={newSubject.creditHours} onChange={e => setNewSubject({...newSubject, creditHours: Number(e.target.value)})} className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('total_marks')}</label>
                  <input type="number" min="1" value={newSubject.totalMarks} onChange={e => setNewSubject({...newSubject, totalMarks: Number(e.target.value)})} className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                {t('cancel')}
              </button>
              <button onClick={handleAddSubject} className="flex-1 px-4 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors font-medium">
                {t('add_subject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
