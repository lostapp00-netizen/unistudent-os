import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store/useAppStore';
import { calculateSubjectGrade, calculateGPA, getWarningThreshold, isSubjectAtWarningRisk } from '../lib/academic';
import { Subject } from '../types';
import { Plus, ChevronLeft, ChevronRight, AlertTriangle, Filter, Check, Edit2, Trash2, X } from 'lucide-react';

export function Academic() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subjects, settings, addSubject, updateSubject, deleteSubject } = useAppStore();
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : [1]);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : [1]);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
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

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    creditHours: 3,
    totalMarks: 100,
    yearIndex: filterYears.length === 1 ? filterYears[0] : (currentSemester?.yearIndex || 1),
    semesterIndex: filterSemesters.length === 1 ? filterSemesters[0] : (currentSemester?.semesterIndex || 1)
  });

  const handleOpenAdd = () => {
    setEditingSubject(null);
    setFormData({
      code: '',
      name: '',
      creditHours: 3,
      totalMarks: 100,
      yearIndex: filterYears.length === 1 ? filterYears[0] : (currentSemester?.yearIndex || 1),
      semesterIndex: filterSemesters.length === 1 ? filterSemesters[0] : (currentSemester?.semesterIndex || 1)
    });
    setShowModal(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, subject: Subject) => {
    e.stopPropagation();
    setEditingSubject(subject);
    setFormData({
      code: subject.code,
      name: subject.name,
      creditHours: subject.creditHours,
      totalMarks: subject.totalMarks,
      yearIndex: subject.yearIndex,
      semesterIndex: subject.semesterIndex
    });
    setShowModal(true);
  };

  const handleDelete = (e: React.MouseEvent, subjectId: string) => {
    e.stopPropagation();
    if (window.confirm(settings.language === 'ar' ? 'هل أنت متأكد من حذف هذه المادة؟ سيتم حذف كافة التقييمات المرتبطة بها.' : 'Are you sure you want to delete this subject? All associated grade distributions will be removed.')) {
      deleteSubject(subjectId);
    }
  };

  const handleSaveSubject = () => {
    if (!formData.name.trim() || !formData.code.trim()) return;
    
    if (editingSubject) {
      updateSubject(editingSubject.id, {
        name: formData.name.trim(),
        code: formData.code.trim(),
        creditHours: Number(formData.creditHours),
        totalMarks: Number(formData.totalMarks),
        yearIndex: Number(formData.yearIndex),
        semesterIndex: Number(formData.semesterIndex)
      });
      setShowModal(false);
    } else {
      const newSubId = uuidv4();
      const subject: Subject = {
        id: newSubId,
        name: formData.name.trim(),
        code: formData.code.trim(),
        creditHours: Number(formData.creditHours),
        totalMarks: Number(formData.totalMarks),
        yearIndex: Number(formData.yearIndex),
        semesterIndex: Number(formData.semesterIndex),
        distributions: []
      };
      addSubject(subject);
      setShowModal(false);
      navigate(`/academic/${newSubId}`);
    }
  };

  const filteredSubjects = subjects.filter(s => 
    (filterYears.length === 0 || filterYears.includes(s.yearIndex)) && 
    (filterSemesters.length === 0 || filterSemesters.includes(s.semesterIndex))
  );

  const semesterGPA = calculateGPA(subjects, settings.gradingScale, filterYears.length === 1 ? filterYears[0] : undefined, filterSemesters.length === 1 ? filterSemesters[0] : undefined);
  const totalGPA = calculateGPA(subjects, settings.gradingScale);

  const threshold = getWarningThreshold(settings);
  const warningSubjects = filteredSubjects.filter(s => 
    isSubjectAtWarningRisk(s, settings.gradingScale, threshold.points)
  );

  const toggleYear = (y: number) => {
    setFilterYears(prev => prev.includes(y) ? prev.filter(yr => yr !== y) : [...prev, y]);
  };

  const toggleSemester = (s: number) => {
    setFilterSemesters(prev => prev.includes(s) ? prev.filter(sem => sem !== s) : [...prev, s]);
  };

  const isAr = settings.language === 'ar';

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
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div 
                  ref={filterPopoverRef}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-200"
                >
                  <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Filter size={18} className="text-indigo-600 dark:text-indigo-400" />
                      <span className="font-bold text-base text-zinc-900 dark:text-white">{t('filter')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(filterYears.length > 0 || filterSemesters.length > 0) && (
                        <button 
                          onClick={() => { setFilterYears([]); setFilterSemesters([]); }}
                          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1"
                        >
                          {t('clear_all') || (isAr ? 'مسح الكل' : 'Clear All')}
                        </button>
                      )}
                      <button
                        onClick={() => setShowFilterPopover(false)}
                        className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">{t('year')}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: settings.totalYears }).map((_, i) => (
                          <label key={i} className="flex items-center gap-2.5 text-sm cursor-pointer bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 transition-colors">
                            <input 
                              type="checkbox" 
                              checked={filterYears.includes(i + 1)} 
                              onChange={() => toggleYear(i + 1)} 
                              className="rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700 bg-transparent w-4 h-4" 
                            />
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{t('year')} {i + 1}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">{t('semester')}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: settings.semestersPerYear }).map((_, i) => (
                          <label key={i} className="flex items-center gap-2.5 text-sm cursor-pointer bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 transition-colors">
                            <input 
                              type="checkbox" 
                              checked={filterSemesters.includes(i + 1)} 
                              onChange={() => toggleSemester(i + 1)} 
                              className="rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700 bg-transparent w-4 h-4" 
                            />
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{t('semester')} {i + 1}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setShowFilterPopover(false)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all text-center"
                    >
                      {isAr ? 'تطبيق الفلتر' : 'Apply Filter'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleOpenAdd} 
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
                  <th className="px-6 py-4 font-medium text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
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
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleOpenEdit(e, subject)}
                            className="p-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all shadow-xs"
                            title={isAr ? 'تعديل المادة' : 'Edit Subject'}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, subject.id)}
                            className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-xs"
                            title={isAr ? 'حذف المادة' : 'Delete Subject'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredSubjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-400">
                      {isAr ? 'لا توجد مواد مضافة في هذا الفصل الدراسي.' : 'No subjects added for this semester.'}
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
                  let g = calculateSubjectGrade(s, settings.gradingScale);
                  if (!g && s.finalGradeLetter) {
                    const rule = settings.gradingScale.find(r => r.letter === s.finalGradeLetter);
                    if (rule) {
                      g = {
                        totalAchieved: 0,
                        percentage: rule.minPercentage,
                        letter: rule.letter,
                        points: rule.points
                      };
                    }
                  }
                  return (
                    <li key={s.id} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 text-sm flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold block text-zinc-900 dark:text-zinc-100">{s.name}</span>
                        <span className="text-xs text-zinc-500">{isAr ? `المعدل: ${(g?.points || 0).toFixed(2)} • الحد: ${threshold.points.toFixed(2)} (${threshold.letter})` : `GPA: ${(g?.points || 0).toFixed(2)} • Threshold: ${threshold.points.toFixed(2)} (${threshold.letter})`}</span>
                      </div>
                      <div className="flex flex-col items-center justify-center px-2 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold text-xs">
                        <span>{g?.letter || 'F'}</span>
                        <span className="text-[9px] opacity-80">{(g?.points || 0).toFixed(1)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-amber-700 dark:text-amber-600/70 text-sm">{isAr ? 'لا توجد إنذارات أكاديمية. أداؤك مستقر!' : 'No academic warnings. Performance is stable!'}</p>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-2xl font-bold mb-6">
              {editingSubject ? (isAr ? 'تعديل المادة' : 'Edit Subject') : t('add_subject')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('subject_name')}</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder={isAr ? 'مثال: الرياضيات المتقدمة' : 'e.g. Advanced Math'}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('subject_code')}</label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value})} 
                  placeholder={isAr ? 'مثال: MATH101' : 'e.g. MATH101'}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('year')}</label>
                  <select 
                    value={formData.yearIndex} 
                    onChange={e => setFormData({...formData, yearIndex: Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: settings.totalYears }).map((_, i) => (
                      <option key={i} value={i + 1}>{t('year')} {i + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('semester')}</label>
                  <select 
                    value={formData.semesterIndex} 
                    onChange={e => setFormData({...formData, semesterIndex: Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: settings.semestersPerYear }).map((_, i) => (
                      <option key={i} value={i + 1}>{t('semester')} {i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('credit_hours')}</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={formData.creditHours} 
                    onChange={e => setFormData({...formData, creditHours: Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('total_marks')}</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={formData.totalMarks} 
                    onChange={e => setFormData({...formData, totalMarks: Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setShowModal(false)} 
                className="flex-1 px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSaveSubject} 
                className="flex-1 px-4 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors font-medium"
              >
                {editingSubject ? (isAr ? 'حفظ التعديل' : 'Save Changes') : t('add_subject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
