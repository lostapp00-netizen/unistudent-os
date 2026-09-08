import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store/useAppStore';
import { calculateSubjectGrade, calculateGPA, getWarningThreshold, isSubjectAtWarningRisk } from '../lib/academic';
import { Subject } from '../types';
import { Plus, AlertTriangle, Edit2, Trash2, X } from 'lucide-react';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../components/ui/UnifiedSemesterFilter';
import { ConfirmModal } from '../components/ui/CustomModal';

export function Academic() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subjects, settings, addSubject, updateSubject, deleteSubject } = useAppStore();
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : [1]);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : [1]);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    creditHours: number | '';
    totalMarks: number | '';
    yearIndex: number;
    semesterIndex: number;
  }>({
    code: '',
    name: '',
    creditHours: 3,
    totalMarks: 100,
    yearIndex: currentSemester?.yearIndex || 1,
    semesterIndex: currentSemester?.semesterIndex || 1
  });

  const handleOpenAdd = () => {
    setEditingSubject(null);
    setFormData({
      code: '',
      name: '',
      creditHours: 3,
      totalMarks: 100,
      yearIndex: currentSemester?.yearIndex || 1,
      semesterIndex: currentSemester?.semesterIndex || 1
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

  const handleDelete = (e: React.MouseEvent, subject: Subject) => {
    e.stopPropagation();
    setSubjectToDelete(subject);
  };

  const handleSaveSubject = () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      alert(isAr ? 'يرجى إدخال اسم المادة وكود المادة.' : 'Please enter subject name and code.');
      return;
    }
    if (formData.creditHours === '' || isNaN(Number(formData.creditHours)) || Number(formData.creditHours) <= 0) {
      alert(isAr ? 'يرجى إدخال عدد الساعات المعتمدة بشكل صحيح (أكبر من 0).' : 'Please enter valid credit hours.');
      return;
    }
    if (formData.totalMarks === '' || isNaN(Number(formData.totalMarks)) || Number(formData.totalMarks) <= 0) {
      alert(isAr ? 'يرجى إدخال الدرجة الكلية للمادة بشكل صحيح (أكبر من 0).' : 'Please enter valid total marks.');
      return;
    }
    
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

  const isAr = settings.language === 'ar';

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t('academic')}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
             <UnifiedFilterBadge 
              filterYears={filterYears} 
              filterSemesters={filterSemesters} 
            />
            <p className="text-zinc-500">{t('gpa')}: {totalGPA > 0 ? totalGPA.toFixed(2) : '--'} | {t('semester')}: {semesterGPA > 0 ? semesterGPA.toFixed(2) : '--'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <UnifiedSemesterFilter
            filterYears={filterYears}
            filterSemesters={filterSemesters}
            setFilterYears={setFilterYears}
            setFilterSemesters={setFilterSemesters}
          />
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
                  <th className="px-6 py-4 font-medium text-center">{t('year')}</th>
                  <th className="px-6 py-4 font-medium text-center">{t('semester')}</th>
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
                      <td className="px-6 py-4 text-center font-bold text-zinc-700 dark:text-zinc-300">{subject.yearIndex}</td>
                      <td className="px-6 py-4 text-center font-bold text-zinc-700 dark:text-zinc-300">{subject.semesterIndex}</td>
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
                            onClick={(e) => handleDelete(e, subject)}
                            className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-xs cursor-pointer"
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
                    <td colSpan={8} className="px-6 py-8 text-center text-zinc-400">
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
                        <span className="text-xs text-zinc-500">{isAr ? `المعدل: ${(g?.points || 0).toFixed(2)} • الحد: ${Number(threshold.points ?? 2.0).toFixed(2)} (${threshold.letter})` : `GPA: ${(g?.points || 0).toFixed(2)} • Threshold: ${Number(threshold.points ?? 2.0).toFixed(2)} (${threshold.letter})`}</span>
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
                    value={formData.creditHours === '' ? '' : formData.creditHours} 
                    onChange={e => setFormData({...formData, creditHours: e.target.value === '' ? '' : Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('total_marks')}</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={formData.totalMarks === '' ? '' : formData.totalMarks} 
                    onChange={e => setFormData({...formData, totalMarks: e.target.value === '' ? '' : Number(e.target.value)})} 
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

      {/* In-app confirmation modal for deleting subject */}
      <ConfirmModal
        isOpen={!!subjectToDelete}
        title={isAr ? 'حذف المادة الدراسية' : 'Delete Subject'}
        message={isAr ? `هل أنت متأكد من حذف مادة (${subjectToDelete?.name})؟ سيتم حذف كافة التقييمات المرتبطة بها نهائياً.` : `Are you sure you want to delete (${subjectToDelete?.name})? All associated grade distributions will be removed.`}
        confirmText={isAr ? 'نعم، احذف المادة' : 'Yes, Delete'}
        cancelText={isAr ? 'تراجع' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (subjectToDelete) {
            deleteSubject(subjectToDelete.id);
            setSubjectToDelete(null);
          }
        }}
        onCancel={() => setSubjectToDelete(null)}
      />
    </div>
  );
}
