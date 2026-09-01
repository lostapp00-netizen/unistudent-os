import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Calendar as CalendarIcon, StickyNote, Edit2, X, BookOpen, CheckSquare, Paperclip, FileText, Clock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Priority, EntityAttachment, Note } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { EntityLinker } from '../ui/EntityLinker';
import { LocalAttachmentUploader } from '../ui/LocalAttachmentUploader';
import { AttachmentBadge } from '../ui/AttachmentBadge';
import { ProductivityGroupTabs } from './ProductivityGroupTabs';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../ui/UnifiedSemesterFilter';
import { isItemMatchingSemesterFilter } from '../../lib/dateFilters';
import { ConfirmModal } from '../ui/CustomModal';
import { EntityPreviewModal, PreviewEntity } from '../ui/EntityPreviewModal';

export function NotesTab() {
  const { t } = useTranslation();
  const { notes, tasks, files, subjects, scheduleItems, appointments, groups, addNote, updateNote, deleteNote, settings } = useAppStore();
  const isAr = settings.language === 'ar';
  
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);
  const [activeGroupId, setActiveGroupId] = useState<string>('all');

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<Priority>('medium');
  const [linkedSubjectIds, setLinkedSubjectIds] = useState<string[]>([]);
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
  const [linkedAppointmentIds, setLinkedAppointmentIds] = useState<string[]>([]);
  const [linkedScheduleItemIds, setLinkedScheduleItemIds] = useState<string[]>([]);
  const [linkedFileIds, setLinkedFileIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [groupId, setGroupId] = useState<string>('');
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [previewEntity, setPreviewEntity] = useState<PreviewEntity | null>(null);

  const resetForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setTitle('');
    setContent('');
    setDate(new Date().toISOString().split('T')[0]);
    setPriority('medium');
    setLinkedSubjectIds([]);
    setLinkedTaskIds([]);
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
    if (!title.trim() && !content.trim()) return;
    
    const finalGroupId = groupId || (activeGroupId === 'all' || activeGroupId === 'none' ? '' : activeGroupId);

    if (editingId) {
      updateNote(editingId, {
        title: title || (isAr ? 'ملاحظة بدون عنوان' : 'Untitled Note'),
        content,
        date,
        priority,
        linkedSubjectIds,
        linkedTaskIds,
        linkedAppointmentIds,
        linkedScheduleItemIds,
        linkedFileIds,
        attachments,
        groupId: finalGroupId
      });
    } else {
      addNote({
        id: uuidv4(),
        title: title || (isAr ? 'ملاحظة بدون عنوان' : 'Untitled Note'),
        content,
        date,
        priority,
        linkedSubjectIds,
        linkedTaskIds,
        linkedAppointmentIds,
        linkedScheduleItemIds,
        linkedFileIds,
        attachments,
        groupId: finalGroupId,
      });
    }
    resetForm();
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setDate(note.date || new Date().toISOString().split('T')[0]);
    setPriority(note.priority);
    setLinkedSubjectIds(note.linkedSubjectIds || []);
    setLinkedTaskIds(note.linkedTaskIds || []);
    setLinkedAppointmentIds((note as any).linkedAppointmentIds || []);
    setLinkedScheduleItemIds((note as any).linkedScheduleItemIds || []);
    setLinkedFileIds(note.linkedFileIds || []);
    setAttachments(note.attachments || []);
    setGroupId(note.groupId || '');
    setShowAddForm(true);
  };

  const priorityColors = {
    high: 'border-rose-300 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/20',
    medium: 'border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20',
    low: 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20'
  };

  const filteredNotes = notes.filter(note => {
    if (!isItemMatchingSemesterFilter(note.date, note.linkedSubjectIds, filterYears, filterSemesters, settings.semesters, subjects)) {
      return false;
    }
    
    if (activeGroupId === 'none') {
      if (note.groupId) return false;
    } else if (activeGroupId !== 'all') {
      if (note.groupId !== activeGroupId) return false;
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
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">{t('notes')}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <UnifiedFilterBadge filterYears={filterYears} filterSemesters={filterSemesters} />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl">
                {filteredNotes.length} {isAr ? 'ملاحظة' : 'notes'}
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
              <span>{t('add_note')}</span>
            </button>
          </div>
        </div>

        {/* Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map(note => (
            <div 
              key={note.id} 
              className={`bg-white dark:bg-zinc-900 rounded-3xl p-5 border shadow-xs flex flex-col transition-all hover:shadow-md ${priorityColors[note.priority]}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-1 min-w-0 pr-2 rtl:pr-0 rtl:pl-2">
                  <h4 className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-white leading-tight">{note.title}</h4>
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                    {note.date && <span className="flex items-center gap-1"><CalendarIcon size={12}/> {note.date}</span>}
                    {note.groupId && (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-[10px]">
                        {groups.find(g => g.id === note.groupId)?.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5 shrink-0">
                  <button 
                    onClick={() => handleEdit(note)} 
                    className="p-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl transition-all shadow-2xs cursor-pointer"
                    title={isAr ? 'تعديل' : 'Edit'}
                  >
                    <Edit2 size={14}/>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNoteToDelete(note)} 
                    className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-2xs cursor-pointer"
                    title={isAr ? 'حذف' : 'Delete'}
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4 whitespace-pre-wrap flex-1 leading-relaxed">{note.content}</p>
              
              {/* Linked Items & Attachments */}
              <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                {/* Linked subjects, tasks, appointments, classes */}
                <div className="flex flex-wrap gap-1.5">
                  {note.linkedSubjectIds?.map(id => {
                    const sub = subjects.find(s => s.id === id);
                    return sub ? (
                      <span key={id} className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 px-2.5 py-1 rounded-lg">
                        <BookOpen size={11} /> {sub.name}
                      </span>
                    ) : null;
                  })}

                  {note.linkedTaskIds?.map(id => {
                    const task = tasks.find(t => t.id === id);
                    return task ? (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setPreviewEntity({ type: 'task', id })}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        <CheckSquare size={11} /> {task.title}
                      </button>
                    ) : null;
                  })}

                  {note.linkedAppointmentIds?.map(id => {
                    const app = appointments.find(a => a.id === id);
                    return app ? (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setPreviewEntity({ type: 'appointment', id })}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 px-2.5 py-1 rounded-lg hover:bg-sky-100 transition-colors cursor-pointer"
                      >
                        <CalendarIcon size={11} /> {app.title}
                      </button>
                    ) : null;
                  })}

                  {note.linkedScheduleItemIds?.map(id => {
                    const sc = scheduleItems.find(s => s.id === id);
                    if (!sc) return null;
                    const sub = subjects.find(s => s.id === sc.subjectId);
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setPreviewEntity({ type: 'schedule', id })}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        <Clock size={11} /> {sub?.name || 'حصة'}
                      </button>
                    );
                  })}

                  {note.linkedFileIds?.map(id => {
                    const f = files.find(file => file.id === id);
                    return f ? (
                      <span key={id} className="inline-flex items-center gap-1 text-[11px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 rounded-lg">
                        <FileText size={11} /> {f.name}
                      </span>
                    ) : null;
                  })}
                </div>

                {/* Attachments */}
                {note.attachments && note.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {note.attachments.map(att => (
                      <AttachmentBadge key={att.id} attachment={att} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredNotes.length === 0 && (
            <div className="col-span-full py-16 text-center text-zinc-400 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col items-center justify-center">
              <StickyNote size={48} className="mb-3 opacity-30 text-amber-500" />
              <p className="font-bold text-sm text-zinc-600 dark:text-zinc-400">
                {isAr ? 'لا توجد ملاحظات مطابقة للفترة أو المجموعة المحددة.' : 'No notes found for this period or group.'}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                {isAr ? 'يمكنك تدوين ملاحظة جديدة أو تغيير الفلتر.' : 'You can create a new note or change the filter.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                {editingId ? <Edit2 className="w-5 h-5 text-blue-600" /> : <StickyNote className="w-5 h-5 text-blue-600" />}
                {editingId ? t('edit') : t('add_note')}
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
                  placeholder={isAr ? 'عنوان الملاحظة...' : 'Note title...'} 
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
                  value={content} 
                  onChange={(e) => setContent(e.target.value)} 
                  placeholder={isAr ? 'تفاصيل الملاحظة...' : 'Note content...'} 
                  rows={4} 
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow resize-none text-sm" 
                />
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">{isAr ? 'ربط بعناصر أخرى' : 'Link to other items'}</label>
                <EntityLinker
                  selectedSubjectIds={linkedSubjectIds}
                  onChangeSubjects={setLinkedSubjectIds}
                  selectedTaskIds={linkedTaskIds}
                  onChangeTasks={setLinkedTaskIds}
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
                disabled={!title.trim() && !content.trim()} 
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white transition-all font-bold text-xs shadow-md shadow-blue-500/25 cursor-pointer"
              >
                {editingId ? t('save') : t('add_note')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!noteToDelete}
        title={isAr ? 'حذف الملاحظة' : 'Delete Note'}
        message={isAr ? `هل أنت متأكد من حذف الملاحظة "${noteToDelete?.title}"؟` : `Are you sure you want to delete note "${noteToDelete?.title}"?`}
        confirmText={isAr ? 'نعم، حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (noteToDelete) {
            deleteNote(noteToDelete.id);
            setNoteToDelete(null);
          }
        }}
        onCancel={() => setNoteToDelete(null)}
      />

      {/* Entity Preview Modal */}
      <EntityPreviewModal
        preview={previewEntity}
        onClose={() => setPreviewEntity(null)}
      />
    </div>
  );
}
