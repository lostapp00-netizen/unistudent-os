
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CheckSquare, StickyNote, CheckCircle, Circle, Trash2, Calendar as CalendarIcon, Link as LinkIcon, Paperclip, FileText, Edit2, X, BookOpen } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Priority, EntityAttachment } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { EntityLinker } from '../ui/EntityLinker';
import { LocalAttachmentUploader } from '../ui/LocalAttachmentUploader';
import { AttachmentBadge } from '../ui/AttachmentBadge';
import { ProductivityGroupTabs } from './ProductivityGroupTabs';
import { ProductivityFilter, ProductivityFilterState } from './ProductivityFilter';
import { isDateMatchingFilter } from '../../lib/dateFilters';
import { ConfirmModal } from '../ui/CustomModal';

export function TasksTab() {
  const [showAddForm, setShowAddForm] = useState(false);
  const { t } = useTranslation();
  const { tasks, notes, files, subjects, groups, addGroup, addTask, updateTask, deleteTask, addFile, settings } = useAppStore();
  
  const [taskToDelete, setTaskToDelete] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<Priority>('medium');
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>([]);
  const [linkedFileIds, setLinkedFileIds] = useState<string[]>([]);
  const [linkedSubjectIds, setLinkedSubjectIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [groupId, setGroupId] = useState<string>('');

  
  const [dateFilter, setDateFilter] = useState<ProductivityFilterState>({ type: "all", from: "", to: "" });
  const [activeGroupId, setActiveGroupId] = useState<string>('all');
  
  const resetForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setPriority('medium');
    setLinkedNoteIds([]);
    setLinkedFileIds([]);
    setLinkedSubjectIds([]);
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
    
    if (editingId) {
      updateTask(editingId, { title, description, date, priority, linkedNoteIds, linkedFileIds, linkedSubjectIds, attachments });
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
        linkedFileIds,
        linkedSubjectIds,
        groupId,
        attachments,
      });
    }
    resetForm();
  };

  const handleEdit = (task: any) => {
    setEditingId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setDate(task.date || new Date().toISOString().split('T')[0]);
    setPriority(task.priority);
    setLinkedNoteIds(task.linkedNoteIds || []);
    setLinkedFileIds(task.linkedFileIds || []);
    setLinkedSubjectIds(task.linkedSubjectIds || []);
    setAttachments(task.attachments || []);
    setGroupId(task.groupId || '');
    setShowAddForm(true);
  };

  const priorityColors = {
    high: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  };

  
  
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  
  const filteredTasks = tasks.filter(task => {
    if (!isDateMatchingFilter(task.date, dateFilter, currentSemester)) return false;
    
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
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 my-8 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                {editingId ? <Edit2 className="w-6 h-6 text-indigo-500" /> : <CheckSquare className="w-6 h-6 text-indigo-500" />}
                {editingId ? t('edit') : t('add_task')}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-2 space-y-4 flex-1 hide-scrollbar">
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('title')}</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('title')} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow font-medium" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('date')}</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow text-zinc-700 dark:text-zinc-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('priority')}</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow text-zinc-700 dark:text-zinc-300">
                    <option value="high">{settings.language === 'ar' ? 'مهم جداً' : 'High'}</option>
                    <option value="medium">{settings.language === 'ar' ? 'عادي' : 'Medium'}</option>
                    <option value="low">{settings.language === 'ar' ? 'مش مهم قوي' : 'Low'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{settings.language === 'ar' ? 'المجموعة' : 'Group'}</label>
                  <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow text-zinc-700 dark:text-zinc-300">
                    <option value="">{settings.language === 'ar' ? 'بدون مجموعة' : 'No Group'}</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
</div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('description')}</label>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('description')} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none" />
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-sm font-medium mb-2">{settings.language === 'ar' ? 'ربط بعناصر أخرى' : 'Link to other items'}</label>
                <EntityLinker
                  selectedSubjectIds={linkedSubjectIds}
                  onChangeSubjects={setLinkedSubjectIds}
                  selectedNoteIds={linkedNoteIds}
                  onChangeNotes={setLinkedNoteIds}
                  selectedFileIds={linkedFileIds}
                  onChangeFiles={setLinkedFileIds}
                />
              </div>
              
              <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <label className="block text-sm font-medium mb-2 flex items-center gap-1"><Paperclip size={14} /> {settings.language === 'ar' ? 'المرفقات (مستقلة)' : 'Attachments (Independent)'}</label>
                <LocalAttachmentUploader attachments={attachments} onChange={setAttachments} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={resetForm} className="px-6 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors font-medium text-zinc-700 dark:text-zinc-300">
                {t('cancel')}
              </button>
              <button onClick={handleAddOrUpdate} disabled={!title.trim()} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors font-medium flex items-center gap-2">
                {editingId ? t('save') : t('add_task')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t('tasks')}</h2>
        <div className="flex items-center gap-3">
          <ProductivityFilter filter={dateFilter} setFilter={setDateFilter} />
          <button onClick={handleOpenAddForm} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-colors font-medium shadow-sm">
          <Plus size={20} />
          {t('add_task')}
        </button>
        </div>
      </div>
      
      <div className="space-y-3">

      

      
        {filteredTasks.map(task => (
          <div key={task.id} className={`flex flex-col p-4 rounded-3xl border transition-colors ${task.isCompleted ? 'bg-zinc-50 dark:bg-zinc-800/30 border-transparent opacity-60' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm'}`}>
            <div className="flex items-start gap-4">
              <button onClick={() => updateTask(task.id, { isCompleted: !task.isCompleted })} className={`mt-1 flex-shrink-0 transition-colors ${task.isCompleted ? 'text-indigo-500' : 'text-zinc-400 hover:text-indigo-500'}`}>
                {task.isCompleted ? <CheckCircle size={24} /> : <Circle size={24} />}
              </button>
              <div className="flex-grow min-w-0">
                <h4 className={`text-base font-medium truncate ${task.isCompleted ? 'line-through text-zinc-500' : ''}`}>{task.title}</h4>
                {task.description && <p className="text-sm text-zinc-500 truncate mt-1">{task.description}</p>}
                
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${priorityColors[task.priority]}`}>{t(task.priority)}</span>
                  {task.date && (
                    <span className="flex items-center gap-1 text-xs text-zinc-500"><CalendarIcon size={14} /> {task.date}</span>
                  )}
                  {task.groupId && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {groups.find(g => g.id === task.groupId)?.name}
                    </span>
                  )}
                  {task.linkedSubjectIds && task.linkedSubjectIds.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                      <BookOpen size={12} /> {task.linkedSubjectIds.map(id => subjects.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
                    </span>
                  )}
                  {task.attachments && task.attachments.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-indigo-500 font-medium">
                      <Paperclip size={12} /> {task.attachments.length} {settings.language === 'ar' ? 'مرفقات' : 'attachments'}
                    </span>
                  )}
                </div>
                
                {task.attachments && task.attachments.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {task.attachments.map(att => (
                      <AttachmentBadge key={att.id} attachment={att} />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => handleEdit(task)} 
                  className="p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all rounded-xl shadow-xs"
                  title={settings.language === 'ar' ? 'تعديل' : 'Edit'}
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  type="button"
                  onClick={() => setTaskToDelete(task)} 
                  className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all rounded-xl shadow-xs cursor-pointer"
                  title={settings.language === 'ar' ? 'حذف' : 'Delete'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!taskToDelete}
        title={settings.language === 'ar' ? 'حذف المهمة' : 'Delete Task'}
        message={settings.language === 'ar' ? `هل أنت متأكد من حذف المهمة "${taskToDelete?.title}"؟` : `Are you sure you want to delete task "${taskToDelete?.title}"?`}
        confirmText={settings.language === 'ar' ? 'نعم، حذف' : 'Delete'}
        cancelText={settings.language === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (taskToDelete) {
            deleteTask(taskToDelete.id);
            setTaskToDelete(null);
          }
        }}
        onCancel={() => setTaskToDelete(null)}
      />
    </div>
  );
}
