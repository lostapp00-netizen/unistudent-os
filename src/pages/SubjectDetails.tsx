import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { ChevronRight, ArrowLeft, ArrowRight, Trophy, PieChart, Plus, Trash2, Edit2, CheckSquare, StickyNote, ChevronLeft } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { calculateSubjectGrade } from '../lib/academic';
import { GradeDistributionItem } from '../types';
import { DistributionItemCard } from '../components/academic/DistributionItemCard';
import { DistributionDefinitionRow } from '../components/academic/DistributionDefinitionRow';
import { ConfirmModal } from '../components/ui/CustomModal';

export function SubjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { subjects, tasks, notes, settings, updateSubject, deleteSubject } = useAppStore();
  
  const subject = subjects.find(s => s.id === id);
  
  const [newDistName, setNewDistName] = useState('');
  const [newDistMarks, setNewDistMarks] = useState<number | ''>('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    creditHours: 3,
    totalMarks: 100,
    yearIndex: 1,
    semesterIndex: 1
  });

  if (!subject) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-700">المادة غير موجودة</h2>
        <button onClick={() => navigate('/academic')} className="mt-4 text-indigo-600 underline">العودة للجدول</button>
      </div>
    );
  }

  const distributedMarks = subject.distributions.reduce((acc, curr) => acc + curr.maxMarks, 0);
  const remainingMarks = subject.totalMarks - distributedMarks;
  
  const gradeInfo = calculateSubjectGrade(subject, settings.gradingScale);

  const handleAddDistribution = () => {
    if (!newDistName || !newDistMarks || newDistMarks <= 0) return;
    if (newDistMarks > remainingMarks) {
      alert(`الدرجات المتبقية هي ${remainingMarks} فقط.`);
      return;
    }
    
    updateSubject(subject.id, {
      distributions: [
        ...subject.distributions,
        {
          id: uuidv4(),
          name: newDistName,
          maxMarks: Number(newDistMarks),
          achievedMarks: null,
          status: 'current'
        }
      ]
    });
    
    setNewDistName('');
    setNewDistMarks('');
  };

  const handleRemoveDistribution = (distId: string) => {
    updateSubject(subject.id, {
      distributions: subject.distributions.filter(d => d.id !== distId)
    });
  };

  const handleUpdateDistributionDef = (distId: string, name: string, maxMarks: number) => {
    updateSubject(subject.id, {
      distributions: subject.distributions.map(d => 
        d.id === distId ? { ...d, name, maxMarks } : d
      )
    });
  };

  const handleUpdateAchieved = (distId: string, updates: Partial<GradeDistributionItem>) => {
    updateSubject(subject.id, {
      distributions: subject.distributions.map(d => 
        d.id === distId ? { ...d, ...updates } : d
      )
    });
  };

  const isRtl = settings.language === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  
  const isFinished = subject.status === 'finished';

  const toggleStatus = (newStatus: 'current' | 'finished') => {
    updateSubject(subject.id, { status: newStatus });
  };

  const handleOpenEditSubject = () => {
    setEditForm({
      name: subject.name,
      code: subject.code,
      creditHours: subject.creditHours,
      totalMarks: subject.totalMarks,
      yearIndex: subject.yearIndex,
      semesterIndex: subject.semesterIndex
    });
    setShowEditModal(true);
  };

  const handleSaveEditSubject = () => {
    if (!editForm.name.trim() || !editForm.code.trim()) return;
    updateSubject(subject.id, {
      name: editForm.name.trim(),
      code: editForm.code.trim(),
      creditHours: Number(editForm.creditHours),
      totalMarks: Number(editForm.totalMarks),
      yearIndex: Number(editForm.yearIndex),
      semesterIndex: Number(editForm.semesterIndex)
    });
    setShowEditModal(false);
  };

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <button 
            onClick={() => navigate('/academic')}
            className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex-shrink-0 mt-0.5 sm:mt-0"
          >
            <BackIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 break-words leading-snug">
              {subject.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-zinc-500 text-xs sm:text-sm mt-1.5 font-medium">
              <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/50">
                {subject.code}
              </span>
              <span>الساعات: <strong className="text-zinc-700 dark:text-zinc-300">{subject.creditHours}</strong></span>
              <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
              <span>الدرجة الكلية: <strong className="text-zinc-700 dark:text-zinc-300">{subject.totalMarks}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl">
            <button 
              onClick={() => updateSubject(subject.id, { includeInGpa: subject.includeInGpa === false ? true : false })}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${subject.includeInGpa !== false ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              {isRtl ? (subject.includeInGpa !== false ? 'متضمن في المعدل' : 'مستبعد من المعدل') : (subject.includeInGpa !== false ? 'Included in GPA' : 'Excluded from GPA')}
            </button>
            <div className="w-px bg-zinc-200 dark:bg-zinc-700 mx-0.5 my-1.5"></div>
            <button 
              onClick={() => toggleStatus('current')}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${!isFinished ? 'bg-white dark:bg-zinc-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              {isRtl ? 'حالي' : 'Current'}
            </button>
            <button 
              onClick={() => toggleStatus('finished')}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${isFinished ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              {isRtl ? 'نهائي' : 'Final'}
            </button>
          </div>

          <button
            onClick={handleOpenEditSubject}
            className="p-2 sm:p-2.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all shadow-xs flex items-center gap-1.5 text-xs sm:text-sm font-bold"
            title={isRtl ? 'تعديل بيانات المادة' : 'Edit Subject'}
          >
            <Edit2 size={16} />
            <span className="inline">{isRtl ? 'تعديل' : 'Edit'}</span>
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-2 sm:p-2.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-xs flex items-center gap-1.5 text-xs sm:text-sm font-bold cursor-pointer"
            title={isRtl ? 'حذف المادة' : 'Delete Subject'}
          >
            <Trash2 size={16} />
            <span className="inline">{isRtl ? 'حذف' : 'Delete'}</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Grade Distribution Manager */}
        <div className="md:col-span-8 flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <PieChart className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">{t('distributions')}</h2>
            </div>
            
            <div className="mb-6 flex flex-col sm:flex-row gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <div className="flex-1 min-w-0">
                <input 
                  type="text" 
                  disabled={isFinished}
                  placeholder={isRtl ? 'اسم بند التقييم (مثلاً: ميدترم، أعمال سنة)...' : 'Distribution name (e.g. Midterm)...'}
                  value={newDistName}
                  onChange={e => setNewDistName(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 sm:w-32 sm:flex-none">
                  <input 
                    type="number" 
                    min="1"
                    disabled={isFinished}
                    placeholder={isRtl ? 'الدرجة' : 'Marks'}
                    value={newDistMarks}
                    onChange={e => setNewDistMarks(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-center font-bold"
                  />
                </div>
                <button 
                  onClick={handleAddDistribution}
                  disabled={remainingMarks === 0 || isFinished || !newDistName.trim() || !newDistMarks}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl transition-colors font-bold text-sm flex-shrink-0 shadow-sm"
                  title={isRtl ? 'إضافة بند التقييم' : 'Add Distribution'}
                >
                  <Plus className="w-5 h-5" />
                  <span>{isRtl ? 'إضافة' : 'Add'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {subject.distributions.map(dist => (
                <DistributionDefinitionRow
                  key={dist.id}
                  distribution={dist}
                  isSubjectFinished={isFinished}
                  remainingMarks={remainingMarks}
                  onUpdate={handleUpdateDistributionDef}
                  onDelete={handleRemoveDistribution}
                  isRtl={isRtl}
                />
              ))}
              {subject.distributions.length === 0 && (
                <div className="text-center py-4 text-zinc-400 text-sm">لم يتم إضافة بنود لتوزيع الدرجات.</div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-sm font-medium">
              <span className="text-zinc-500">{t('remaining_marks')}:</span>
              <span className={`text-lg font-black ${remainingMarks > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {remainingMarks}
              </span>
            </div>
          </div>
        </div>

        {/* Achievements / Marks Entry */}
        <div className="md:col-span-4 flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                  <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-xl font-bold">{t('achievements')}</h2>
              </div>
              
              <div className="space-y-4">
                {subject.distributions.map(dist => (
                  <DistributionItemCard
                    key={dist.id}
                    distribution={dist}
                    isSubjectFinished={isFinished}
                    onUpdate={handleUpdateAchieved}
                    isRtl={isRtl}
                  />
                ))}
                {subject.distributions.length === 0 && (
                  <div className="text-center py-4 text-zinc-500 text-sm">
                    {isRtl ? 'يجب إضافة توزيع درجات أولاً.' : 'Add grade distributions first.'}
                  </div>
                )}
              </div>
              
              <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <div className="text-center">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{t('current_grade')}</p>
                  {gradeInfo ? (
                    <div>
                      <div className="text-4xl font-black text-amber-500">{gradeInfo.letter}</div>
                      <div className="text-sm text-zinc-500 mt-1">{gradeInfo.totalAchieved} / {subject.totalMarks} ({gradeInfo.percentage.toFixed(1)}%)</div>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-zinc-400">--</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

  
        <div className="md:col-span-12 mt-4">
          <h2 className="text-xl font-bold mb-4">{settings.language === 'ar' ? 'المهام والملاحظات المربوطة' : 'Linked Tasks & Notes'}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tasks */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><CheckSquare className="text-indigo-500" /> {t('tasks')}</h3>
            <div className="space-y-3">
              {tasks.filter(t => t.linkedSubjectIds?.includes(subject.id)).map(task => (
                <div key={task.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex justify-between items-start">
                    <h4 className={`font-medium ${task.isCompleted ? 'line-through text-zinc-500' : ''}`}>{task.title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${task.priority === 'high' ? 'bg-rose-100 text-rose-700' : task.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {task.priority}
                    </span>
                  </div>
                  {task.date && <p className="text-xs text-zinc-500 mt-1">{task.date}</p>}
                </div>
              ))}
              {tasks.filter(t => t.linkedSubjectIds?.includes(subject.id)).length === 0 && (
                <p className="text-sm text-zinc-500 italic">{settings.language === 'ar' ? 'لا توجد مهام' : 'No tasks'}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><StickyNote className="text-amber-500" /> {t('notes')}</h3>
            <div className="space-y-3">
              {notes.filter(n => n.linkedSubjectIds?.includes(subject.id)).map(note => (
                <div key={note.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <h4 className="font-medium">{note.title}</h4>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{note.content}</p>
                </div>
              ))}
              {notes.filter(n => n.linkedSubjectIds?.includes(subject.id)).length === 0 && (
                <p className="text-sm text-zinc-500 italic">{settings.language === 'ar' ? 'لا توجد ملاحظات' : 'No notes'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-6">
              {isRtl ? 'تعديل بيانات المادة' : 'Edit Subject Details'}
            </h2>
            <div className="overflow-y-auto pr-2 space-y-4 flex-1 hide-scrollbar">
              <div>
                <label className="block text-sm font-medium mb-1">{t('subject_name')}</label>
                <input 
                  type="text" 
                  value={editForm.name} 
                  onChange={e => setEditForm({...editForm, name: e.target.value})} 
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('subject_code')}</label>
                <input 
                  type="text" 
                  value={editForm.code} 
                  onChange={e => setEditForm({...editForm, code: e.target.value})} 
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('year')}</label>
                  <select 
                    value={editForm.yearIndex} 
                    onChange={e => setEditForm({...editForm, yearIndex: Number(e.target.value)})} 
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
                    value={editForm.semesterIndex} 
                    onChange={e => setEditForm({...editForm, semesterIndex: Number(e.target.value)})} 
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
                    value={editForm.creditHours} 
                    onChange={e => setEditForm({...editForm, creditHours: Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('total_marks')}</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={editForm.totalMarks} 
                    onChange={e => setEditForm({...editForm, totalMarks: Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setShowEditModal(false)} 
                className="flex-1 px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSaveEditSubject} 
                className="flex-1 px-4 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors font-medium"
              >
                {isRtl ? 'حفظ التعديلات' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app confirmation modal for deleting subject */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title={isRtl ? 'حذف المادة الدراسية' : 'Delete Subject'}
        message={isRtl ? `هل أنت متأكد من حذف مادة (${subject?.name})؟ سيتم حذف كافة التقييمات والدرجات المرتبطة بها والعودة لقائمة المواد.` : `Are you sure you want to delete (${subject?.name})? All marks will be removed.`}
        confirmText={isRtl ? 'نعم، احذف المادة' : 'Yes, Delete'}
        cancelText={isRtl ? 'تراجع' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (subject) {
            deleteSubject(subject.id);
            setIsDeleteModalOpen(false);
            navigate('/academic/subjects');
          }
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
