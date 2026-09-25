import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/useAppStore';
import { calculateSubjectGrade, getPointsSummary } from '../../lib/academic';
import { Subject } from '../../types';
import { Plus, Edit2, Trash2, Award } from 'lucide-react';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../../components/ui/UnifiedSemesterFilter';
import { ConfirmModal } from '../../components/ui/CustomModal';
import { BonusPointsModal } from '../../components/academic/BonusPointsModal';

export function AcademicSubjects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subjects, settings, addSubject, updateSubject, deleteSubject } = useAppStore();
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [showBonusModal, setShowBonusModal] = useState(false);

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
    setFormError(null);
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
    setFormError(null);
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

  const handleDeleteSubject = (e: React.MouseEvent, subject: Subject) => {
    e.stopPropagation();
    setSubjectToDelete(subject);
  };

  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError(settings.language === 'ar' ? 'يرجى إدخال اسم المادة الدراسية.' : 'Please enter subject name.');
      return;
    }
    // نظام النقط: مفيش ساعات معتمدة، فمش بنطلبها ولا بنتحقق منها.
    if (gradingSystem === 'gpa' && (formData.creditHours === '' || isNaN(Number(formData.creditHours)) || Number(formData.creditHours) <= 0)) {
      setFormError(settings.language === 'ar' ? 'يرجى إدخال عدد الساعات المعتمدة بشكل صحيح (أكبر من 0).' : 'Please enter valid credit hours (greater than 0).');
      return;
    }
    if (formData.totalMarks === '' || isNaN(Number(formData.totalMarks)) || Number(formData.totalMarks) <= 0) {
      setFormError(settings.language === 'ar' ? 'يرجى إدخال الدرجة الكلية للمادة بشكل صحيح (أكبر من 0).' : 'Please enter valid total marks (greater than 0).');
      return;
    }

    if (editingSubject) {
      updateSubject(editingSubject.id, {
        name: formData.name.trim(),
        code: formData.code.trim(),
        creditHours: gradingSystem === 'points' ? (Number(editingSubject.creditHours) || 1) : Number(formData.creditHours),
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
        // Um sistema de pontos não usa ساعات معتمدة: بنُخزّن 1 بس عشان لو
        // الطالب رجع لنظام المعدل، المواد تفضل صالحة للحساب.
        creditHours: gradingSystem === 'points' ? 1 : Number(formData.creditHours),
        totalMarks: Number(formData.totalMarks),
        yearIndex: Number(formData.yearIndex),
        semesterIndex: Number(formData.semesterIndex),
        status: 'current',
        distributions: [],
        includeInGpa: true
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

  const isAr = settings.language === 'ar';
  const gradingSystem = settings.gradingSystem === 'points' ? 'points' : 'gpa';
  const marksPerPoint = Number(settings.marksPerPoint || 0);
  // النقط الإضافية: بتظهر بس في نظام النقط (وزرار «إضافة نقاط» فوق خالص).
  const pointsSummary = gradingSystem === 'points' ? getPointsSummary(settings, subjects) : null;

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">{t('subjects')}</h1>
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

          {/* إضافة نقاط (نظام النقط فقط): نقط حصل عليها الطالب خارج درجات المواد */}
          {gradingSystem === 'points' && (
            <button
              onClick={() => setShowBonusModal(true)}
              title={isAr
                ? 'سجّل نقط بونص أو نقط لدرجات خارجية — بتتضاف على اللي حصلته ومش بتغيّر التوتال الكلي'
                : 'Record bonus / external points — they add to what you earned without changing the total'}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
            >
              <Award size={16} />
              <span>{isAr ? 'إضافة نقاط' : 'Add Points'}</span>
              {pointsSummary && pointsSummary.bonusPoints > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[11px] font-black">
                  +{pointsSummary.bonusPoints}
                </span>
              )}
            </button>
          )}

          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>{t('add_subject')}</span>
          </button>
        </div>
      </header>

      {/* شريط مختصر: النقط المُحصَّلة (بما فيها الإضافية) مقابل التوتال — نظام النقط فقط */}
      {gradingSystem === 'points' && pointsSummary && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-[11px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <span>
            {isAr ? 'المُحصَّل:' : 'Earned:'} {pointsSummary.points.toFixed(1)}
            {pointsSummary.totalPoints > 0 ? ` / ${pointsSummary.totalPoints}` : ''} {isAr ? 'نقطة' : 'pts'}
          </span>
          <span className="text-emerald-400">•</span>
          <span>{isAr ? 'من الدرجات:' : 'From marks:'} {pointsSummary.marksPoints.toFixed(1)}</span>
          <span className="text-emerald-400">•</span>
          <button
            onClick={() => setShowBonusModal(true)}
            className="underline decoration-dotted hover:text-emerald-600 dark:hover:text-emerald-200 cursor-pointer"
          >
            {isAr ? 'نقط إضافية:' : 'Extra points:'} +{pointsSummary.bonusPoints}
            {pointsSummary.bonusCount > 0 ? ` (${pointsSummary.bonusCount})` : ''}
          </button>
          {pointsSummary.totalPoints > 0 && (
            <>
              <span className="text-emerald-400">•</span>
              <span>{isAr ? 'المتبقي:' : 'Left:'} {pointsSummary.remainingPoints.toFixed(1)}</span>
            </>
          )}
        </div>
      )}
      
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex-1">
        <div className="overflow-x-auto h-full">
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              <tr>
                <th className="px-6 py-4 font-medium">{t('subject_name')}</th>
                <th className="px-6 py-4 font-medium">{t('subject_code')}</th>
                <th className="px-6 py-4 font-medium text-center">{t('year')}</th>
                <th className="px-6 py-4 font-medium text-center">{t('semester')}</th>
                {gradingSystem === 'gpa' && <th className="px-6 py-4 font-medium text-center">{t('credit_hours')}</th>}
                <th className="px-6 py-4 font-medium text-center">{isAr ? 'النقط' : 'Points'}</th>
                <th className="px-6 py-4 font-medium text-center">{isAr ? 'النسبة المئوية' : 'Percentage'}</th>
                <th className="px-6 py-4 font-medium text-center">{isAr ? 'التقدير' : 'Letter Grade'}</th>
                <th className="px-6 py-4 font-medium text-center">{isAr ? 'الدرجات (حاصل / كلي)' : 'Marks (Achieved / Total)'}</th>
                <th className="px-6 py-4 font-medium text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredSubjects.map(subject => {
                const gradeInfo = calculateSubjectGrade(subject, settings.gradingScale);
                return (
                  <tr key={subject.id} onClick={() => navigate(`/academic/${subject.id}`)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group whitespace-nowrap">
                    <td className="px-6 py-4 font-bold text-indigo-700 dark:text-indigo-400">{subject.name}</td>
                    <td className="px-6 py-4 text-zinc-500">{subject.code}</td>
                    <td className="px-6 py-4 text-center">{subject.yearIndex}</td>
                    <td className="px-6 py-4 text-center">{subject.semesterIndex}</td>
                    {gradingSystem === 'gpa' && <td className="px-6 py-4 text-center">{subject.creditHours}</td>}
                    <td className="px-6 py-4 text-center font-bold text-zinc-700 dark:text-zinc-300">
                      {gradeInfo
                        ? (gradingSystem === 'points'
                            ? (marksPerPoint > 0 ? (gradeInfo.totalAchieved / marksPerPoint).toFixed(2) : '--')
                            : Number(gradeInfo.points || 0).toFixed(2))
                        : '--'}
                    </td>
                    <td className="px-6 py-4 text-center font-medium">
                      {gradeInfo ? `${Number(gradeInfo.percentage || 0).toFixed(1)}%` : '--'}
                    </td>
                    <td className="px-6 py-4 text-center font-black">
                      {gradeInfo ? (
                        <span className={
                          (gradingSystem === 'points'
                            ? (gradeInfo.percentage || 0) >= 80
                            : (gradeInfo.points || 0) >= 3.0)
                            ? 'text-emerald-600'
                            : (gradingSystem === 'points'
                                ? (gradeInfo.percentage || 0) >= 65
                                : (gradeInfo.points || 0) >= 2.0)
                              ? 'text-amber-500'
                              : 'text-rose-500'
                        }>
                          {gradeInfo.letter}
                        </span>
                      ) : <span className="text-zinc-400">--</span>}
                    </td>
                    <td className="px-6 py-4 text-center font-medium">
                      {gradeInfo ? (
                        <span><span className="text-indigo-600 dark:text-indigo-400 font-bold">{gradeInfo.totalAchieved}</span> / {subject.totalMarks}</span>
                      ) : (
                         <span><span className="text-zinc-400">--</span> / {subject.totalMarks}</span>
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
                          onClick={(e) => handleDeleteSubject(e, subject)}
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
                <tr><td colSpan={gradingSystem === 'gpa' ? 10 : 9} className="px-6 py-8 text-center text-zinc-400">{isAr ? 'لا توجد مواد مضافة في هذا الفصل الدراسي.' : 'No subjects added for this semester.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-4">
              {editingSubject ? (isAr ? 'تعديل المادة' : 'Edit Subject') : t('add_subject')}
            </h2>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800/40">
                {formError}
              </div>
            )}

            <div className="overflow-y-auto pr-2 space-y-4 flex-1 hide-scrollbar">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('subject_name')} <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => {
                    setFormData({...formData, name: e.target.value});
                    if (formError) setFormError(null);
                  }} 
                  placeholder={isAr ? 'مثال: الرياضيات المتقدمة' : 'e.g. Advanced Math'}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium">{t('subject_code')}</label>
                  <span className="text-[11px] text-zinc-400 font-normal">{isAr ? '(اختياري - يولد تلقائياً)' : '(Optional)'}</span>
                </div>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value})} 
                  placeholder={isAr ? 'مثال: MATH101 (اتركه فارغاً للتوليد التلقائي)' : 'e.g. MATH101'}
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
                {gradingSystem === 'gpa' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('credit_hours')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={formData.creditHours === '' ? '' : formData.creditHours} 
                      onChange={e => {
                        if (formError) setFormError(null);
                        setFormData({...formData, creditHours: e.target.value === '' ? '' : Number(e.target.value)});
                      }} 
                      className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>
                )}
                <div className={gradingSystem === 'gpa' ? '' : 'col-span-2'}>
                  <label className="block text-sm font-medium mb-1">
                    {gradingSystem === 'points'
                      ? (isAr ? 'الدرجة الكلية في الكلية' : 'Total marks in college')
                      : t('total_marks')}
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    value={formData.totalMarks === '' ? '' : formData.totalMarks} 
                    onChange={e => {
                      if (formError) setFormError(null);
                      setFormData({...formData, totalMarks: e.target.value === '' ? '' : Number(e.target.value)});
                    }} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
              </div>
              {gradingSystem === 'points' && (
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {isAr
                    ? 'نظام النقط مش بيستخدم الساعات المعتمدة — الدرجة اللي بتجمعها في المادة هي اللي بتتحوّل نقط.'
                    : 'The points system does not use credit hours — the marks you collect are what turns into points.'}
                </p>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
              <button 
                onClick={() => setShowModal(false)} 
                className="flex-1 px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSubmit as any} 
                className="flex-1 px-4 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors font-medium cursor-pointer"
              >
                {editingSubject ? (isAr ? 'حفظ التعديل' : 'Save Changes') : t('add_subject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* النقط الإضافية (نظام النقط) */}
      <BonusPointsModal
        isOpen={showBonusModal}
        onClose={() => setShowBonusModal(false)}
        isAr={isAr}
      />

      {/* In-app confirmation modal for deleting subject */}
      <ConfirmModal
        isOpen={!!subjectToDelete}
        title={isAr ? 'حذف المادة الدراسية' : 'Delete Subject'}
        message={isAr ? `هل أنت متأكد من حذف مادة (${subjectToDelete?.name})؟ سيتم إزالتها نهائياً مع كافة تقييماتها ودرجاتها.` : `Are you sure you want to delete (${subjectToDelete?.name})? All associated marks will be removed.`}
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
