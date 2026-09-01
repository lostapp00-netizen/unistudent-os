import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CheckSquare, StickyNote, CheckCircle2, Circle, Trash2, Calendar as CalendarIcon, Paperclip, FileText, Edit2, X, BookOpen, Clock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Priority, EntityAttachment, Task } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { EntityLinker } from '../ui/EntityLinker';
import { LocalAttachmentUploader } from '../ui/LocalAttachmentUploader';
import { AttachmentBadge } from '../ui/AttachmentBadge';
import { ProductivityGroupTabs } from './ProductivityGroupTabs';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../ui/UnifiedSemesterFilter';
import { isItemMatchingSemesterFilter } from '../../lib/dateFilters';
import { ConfirmModal } from '../ui/CustomModal';
import { EntityPreviewModal, PreviewEntity } from '../ui/EntityPreviewModal';

export function TasksTab() {
  const { t } = useTranslation();
  const { tasks, notes, files, subjects, scheduleItems, appointments, groups, addTask, updateTask, deleteTask, settings } = useAppStore();
  const isAr = settings.language === 'ar';
  
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);
  const [activeGroupId, setActiveGroupId] = useState<string>('all');

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<Priority>('medium');
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>([]);
  const [linkedSubjectIds, setLinkedSubjectIds] = useState<string[]>([]);
  const [linkedAppointmentIds, setLinkedAppointmentIds] = useState<string[]>([]);
  const [linkedScheduleItemIds, setLinkedScheduleItemIds] = useState<string[]>([]);
  const [linkedFileIds, setLinkedFileIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [groupId, setGroupId] = useState<string>('');
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [previewEntity, setPreviewEntity] = useState<PreviewEntity | null>(null);

  const resetForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setPriority('medium');
    setLinkedNoteIds([]);
    setLinkedSubjectIds([]);
    setLinkedAppointmentIds([]);
    setLinkedScheduleItemIds([]);
    setLinkedFileIds([]);
    setAttachments([]);
    setGroupId('');
  };

  const handleOpenAddForm = () => {
    resetForm();
    if (activeGroupId !== 'all' && activeGroupId !== 'none') {
      setGroupId(activeGroupId);
    }
    setShowAddForm(true);
  };

  const handleAddOrUpdate = () => {
    if (!title.trim()) return;
    
    const finalGroupId = groupId || (activeGroupId === 'all' || activeGroupId === 'none' ? '' : activeGroupId);

    if (editingId) {
      updateTask(editingId, {
        title,
        description,
        date,
        priority,
        linkedNoteIds,
        linkedSubjectIds,
        linkedAppointmentIds,
        linkedScheduleItemIds,
        linkedFileIds,
        attachments,
        groupId: finalGroupId
      });
    } else {
      addTask({
        id: uuidv4(),
        title,
        description,
        date,
        isCompleted: false,
        priority,
        type: 'task',
        linkedNoteIds,
        linkedSubjectIds,
        linkedAppointmentIds,
        linkedScheduleItemIds,
        linkedFileIds,
        groupId: finalGroupId,
        attachments,
      });
    }
    resetForm();
  };

  const handleEdit = (task: Task) => {
    setEditingId(task.id);
    setTitle(task.title);
    setDescription(task.description || '');
    setDate(task.date || new Date().toISOString().split('T')[0]);
    setPriority(task.priority);
    setLinkedNoteIds(task.linkedNoteIds || []);
    setLinkedSubjectIds(task.linkedSubjectIds || []);
    setLinkedAppointmentIds((task as any).linkedAppointmentIds || []);
    setLinkedScheduleItemIds((task as any).linkedScheduleItemIds || []);
    setLinkedFileIds(task.linkedFileIds || []);
    setAttachments(task.attachments || []);
    setGroupId(task.groupId || '');
    setShowAddForm(true);
  };

  const priorityColors = {
    high: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
  };

  const filteredTasks = tasks.filter(task => {
    if (!isItemMatchingSemesterFilter(task.date, task.linkedSubjectIds, filterYears, filterSemesters, settings.semesters, subjects)) {
      return false;
    }
    
    if (activeGroupId === 'none') {
      if (task.groupId) return false;
    } else if (activeGroupId !== 'all') {
      if (task.groupId !== activeGroupId) return false;
    }
    
    return true;
  });

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <ProductivityGroupTabs activeGroupId={activeGroupId} setActiveGroupId={setActiveGroupId} />
      
      <div className="flex-1 flex flex-col gap-6">
        {/* Header with Unified Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">{t('tasks')}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <UnifiedFilterBadge filterYears={filterYears} filterSemesters={filterSemesters} />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl">
                {filteredTasks.length} {isAr ? 'مهمة' : 'tasks'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <UnifiedSemesterFilter
              filterYears={filterYears}
              filterSemesters={filterSemesters}
              setFilterYears={setFilterYears}
              setFilterSemesters={setFilterSemesters}
            />
            <button 
              onClick={handleOpenAddForm} 
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-2xl transition-all font-bold shadow-md shadow-blue-500/25 cursor-pointer text-xs sm:text-sm"
            >
              <Plus size={18} />
              <span>{t('add_task')}</span>
            </button>
          </div>
        </div>
        
        {/* Tasks List */}
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <div 
              key={task.id} 
              className={`flex flex-col p-4 sm:p-5 rounded-3xl border transition-all ${
                task.isCompleted 
                  ? 'bg-zinc-50/70 dark:bg-zinc-800/20 border-zinc-200/60 dark:border-zinc-800/50 opacity-70' 
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-blue-200 dark:hover:border-blue-800/60'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <button 
                  onClick={() => updateTask(task.id, { isCompleted: !task.isCompleted })} 
                  className={`mt-0.5 shrink-0 transition-colors cursor-pointer ${task.isCompleted ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 hover:text-blue-600'}`}
                >
                  {task.isCompleted ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>

                <div className="flex-grow min-w-0">
                  <h4 className={`text-base font-bold truncate ${task.isCompleted ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
                    {task.title}
                  </h4>
                  {task.description && <p className="text-xs sm:text-sm text-zinc-500 truncate mt-1">{task.description}</p>}
                  
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${priorityColors[task.priority]}`}>
                      {t(task.priority)}
                    </span>
                    {task.date && (
                      <span className="flex items-center gap-1 text-xs text-zinc-500 font-medium">
                        <CalendarIcon size={12} /> {task.date}
                      </span>
                    )}
                    {task.groupId && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {groups.find(g => g.id === task.groupId)?.name}
                      </span>
                    )}

                    {/* Linked Items badges */}
                    {task.linkedSubjectIds?.map(id => {
                      const sub = subjects.find(s => s.id === id);
                      return sub ? (
                        <span key={id} className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 px-2 py-0.5 rounded-md">
                          <BookOpen size={10} /> {sub.name}
                        </span>
                      ) : null;
                    })}

                    {task.linkedNoteIds?.map(id => {
                      const note = notes.find(n => n.id === id);
                      return note ? (
                        <button
                          type="button"
                          key={id}
                          onClick={() => setPreviewEntity({ type: 'note', id })}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 rounded-md hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          <StickyNote size={10} /> {note.title}
                        </button>
                      ) : null;
                    })}

                    {task.linkedAppointmentIds?.map(id => {
                      const app = appointments.find(a => a.id === id);
                      return app ? (
                        <button
                          type="button"
                          key={id}
                          onClick={() => setPreviewEntity({ type: 'appointment', id })}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 px-2 py-0.5 rounded-md hover:bg-sky-100 transition-colors cursor-pointer"
                        >
                          <CalendarIcon size={10} /> {app.title}
                        </button>
                      ) : null;
                    })}

                    {task.linkedScheduleItemIds?.map(id => {
                      const sc = scheduleItems.find(s => s.id === id);
                      if (!sc) return null;
                      const sub = subjects.find(s => s.id === sc.subjectId);
                      return (
                        <button
                          type="button"
                          key={id}
                          onClick={() => setPreviewEntity({ type: 'schedule', id })}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          <Clock size={10} /> {sub?.name || 'حصة'}
                        </button>
                      );
                    })}

                    {task.linkedFileIds?.map(id => {
                      const f = files.find(file => file.id === id);
                      return f ? (
                        <span key={id} className="inline-flex items-center gap-1 text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 px-2 py-0.5 rounded-md">
                          <FileText size={10} /> {f.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                  
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      {task.attachments.map(att => (
                        <AttachmentBadge key={att.id} attachment={att} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => handleEdit(task)} 
                    className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all rounded-xl shadow-2xs cursor-pointer"
                    title={isAr ? 'تعديل' : 'Edit'}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTaskToDelete(task)} 
                    className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all rounded-xl shadow-2xs cursor-pointer"
                    title={isAr ? 'حذف' : 'Delete'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredTasks.length === 0 && (
            <div className="py-16 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center p-6">
              <CheckSquare size={48} className="mb-3 opacity-30 text-blue-500" />
              <p className="font-bold text-sm text-zinc-600 dark:text-zinc-400">
                {isAr ? 'لا توجد مهام مطابقة للفترة أو المجموعة المحددة.' : 'No tasks found for this period or group.'}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                {isAr ? 'يمكنك إضافة مهمة جديدة أو تغيير الفلتر.' : 'You can add a new task or change the filter.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 my-8 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                {editingId ? <Edit2 className="w-5 h-5 text-blue-600" /> : <CheckSquare className="w-5 h-5 text-blue-600" />}
                {editingId ? t('edit') : t('add_task')}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-2 space-y-4 flex-1 hide-scrollbar">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{t('title')}</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder={isAr ? 'عنوان المهمة...' : 'Task title...'} 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-base transition-shadow" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{t('date')}</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{t('priority')}</label>
                  <select 
                    value={priority} 
                    onChange={(e) => setPriority(e.target.value as Priority)} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="high">{isAr ? 'مهم جداً' : 'High'}</option>
                    <option value="medium">{isAr ? 'عادي' : 'Medium'}</option>
                    <option value="low">{isAr ? 'مش مهم قوي' : 'Low'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'المجموعة' : 'Group'}</label>
                <select 
                  value={groupId} 
                  onChange={(e) => setGroupId(e.target.value)} 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">{isAr ? 'بدون مجموعة' : 'No Group'}</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{t('description')}</label>
                <textarea 
                  rows={3} 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder={isAr ? 'تفاصيل المهمة...' : 'Task description...'} 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow resize-none text-sm" 
                />
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">{isAr ? 'ربط بعناصر أخرى' : 'Link to other items'}</label>
                <EntityLinker
                  selectedSubjectIds={linkedSubjectIds}
                  onChangeSubjects={setLinkedSubjectIds}
                  selectedNoteIds={linkedNoteIds}
                  onChangeNotes={setLinkedNoteIds}
                  selectedAppointmentIds={linkedAppointmentIds}
                  onChangeAppointments={setLinkedAppointmentIds}
                  selectedScheduleItemIds={linkedScheduleItemIds}
                  onChangeScheduleItems={setLinkedScheduleItemIds}
                  selectedFileIds={linkedFileIds}
                  onChangeFiles={setLinkedFileIds}
                />
              </div>
              
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1">
                  <Paperclip size={13} /> {isAr ? 'المرفقات (مستقلة)' : 'Attachments (Independent)'}
                </label>
                <LocalAttachmentUploader attachments={attachments} onChange={setAttachments} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button 
                type="button"
                onClick={resetForm} 
                className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors font-bold text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button 
                type="button"
                onClick={handleAddOrUpdate} 
                disabled={!title.trim()} 
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white transition-all font-bold text-xs shadow-md shadow-blue-500/25 cursor-pointer"
              >
                {editingId ? t('save') : t('add_task')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!taskToDelete}
        title={isAr ? 'حذف المهمة' : 'Delete Task'}
        message={isAr ? `هل أنت متأكد من حذف المهمة "${taskToDelete?.title}"؟` : `Are you sure you want to delete task "${taskToDelete?.title}"?`}
        confirmText={isAr ? 'نعم، حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (taskToDelete) {
            deleteTask(taskToDelete.id);
            setTaskToDelete(null);
          }
        }}
        onCancel={() => setTaskToDelete(null)}
      />

      {/* Entity Preview Modal */}
      <EntityPreviewModal
        preview={previewEntity}
        onClose={() => setPreviewEntity(null)}
      />
    </div>
  );
}
