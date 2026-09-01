
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Calendar as CalendarIcon, StickyNote, Edit2, X, BookOpen, CheckSquare, Paperclip, FileText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Priority, EntityAttachment } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { EntityLinker } from '../ui/EntityLinker';
import { LocalAttachmentUploader } from '../ui/LocalAttachmentUploader';
import { AttachmentBadge } from '../ui/AttachmentBadge';
import { ProductivityGroupTabs } from './ProductivityGroupTabs';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../ui/UnifiedSemesterFilter';
import { isItemMatchingSemesterFilter } from '../../lib/dateFilters';
import { ConfirmModal } from '../ui/CustomModal';

export function NotesTab() {
  const [showAddForm, setShowAddForm] = useState(false);
  const { t } = useTranslation();
  const { notes, tasks, files, subjects, groups, addGroup, addNote, updateNote, deleteNote, settings } = useAppStore();
  
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);
  const [activeGroupId, setActiveGroupId] = useState<string>('all');

  
  const resetForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setTitle('');
    setContent('');
    setDate(new Date().toISOString().split('T')[0]);
    setPriority('medium');
    setLinkedSubjectIds([]);
    setLinkedTaskIds([]);
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
    
    if (editingId) {
      updateNote(editingId, { title: title || 'Untitled', content, date, priority, linkedSubjectIds, linkedTaskIds, linkedFileIds, attachments, groupId: groupId || (activeGroupId === 'all' || activeGroupId === 'none' ? '' : activeGroupId) });
    } else {
      addNote({
        id: uuidv4(),
        title: title || 'Untitled',
        content,
        date,
        priority,
        linkedSubjectIds,
        linkedTaskIds,
        linkedFileIds,
        attachments,
        groupId,
      });
    }
    resetForm();
  };

  const handleEdit = (note: any) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setDate(note.date || new Date().toISOString().split('T')[0]);
    setPriority(note.priority);
    setLinkedSubjectIds(note.linkedSubjectIds || []);
    setLinkedTaskIds(note.linkedTaskIds || []);
    setLinkedFileIds(note.linkedFileIds || []);
    setAttachments(note.attachments || []);
    setGroupId(note.groupId || '');
    setShowAddForm(true);
  };

  const priorityColors = {
    high: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
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
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                {editingId ? <Edit2 className="w-6 h-6 text-indigo-500" /> : <StickyNote className="w-6 h-6 text-indigo-500" />}
                {editingId ? t('edit') : t('add_note')}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-2 space-y-4 flex-1 hide-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('title')}</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('title')} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow font-bold text-lg" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t('date')}</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-700 dark:text-zinc-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t('priority')}</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-700 dark:text-zinc-300">
                      <option value="high">{settings.language === 'ar' ? 'مهم جداً' : 'High'}</option>
                      <option value="medium">{settings.language === 'ar' ? 'عادي' : 'Medium'}</option>
                      <option value="low">{settings.language === 'ar' ? 'مش مهم قوي' : 'Low'}</option>
                    </select>
                  </div>
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
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('description')} rows={5} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none" />
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-sm font-medium mb-2">{settings.language === 'ar' ? 'ربط بعناصر أخرى' : 'Link to other items'}</label>
                <EntityLinker
                  selectedSubjectIds={linkedSubjectIds}
                  onChangeSubjects={setLinkedSubjectIds}
                  selectedTaskIds={linkedTaskIds}
                  onChangeTasks={setLinkedTaskIds}
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
              <button onClick={resetForm} className="px-6 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                {t('cancel')}
              </button>
              <button onClick={handleAddOrUpdate} disabled={!title.trim() && !content.trim()} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors font-medium flex items-center gap-2 cursor-pointer shadow-xs">
                {editingId ? t('save') : t('add_note')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Unified Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">{t('notes')}</h2>
          <div className="mt-1.5 flex items-center gap-2">
            <UnifiedFilterBadge filterYears={filterYears} filterSemesters={filterSemesters} />
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl">
              {filteredNotes.length} {settings.language === 'ar' ? 'ملاحظة' : 'notes'}
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
          <button onClick={handleOpenAddForm} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-2xl transition-all font-bold shadow-xs cursor-pointer text-xs sm:text-sm">
            <Plus size={18} />
            <span>{t('add_note')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

      

      
        {filteredNotes.map(note => (
          <div key={note.id} className={`bg-white dark:bg-zinc-900 rounded-3xl p-5 border shadow-sm flex flex-col ${priorityColors[note.priority]}`}>
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-bold text-lg leading-tight">{note.title}</h4>
              <div className="flex gap-1.5 ml-2 rtl:mr-2 rtl:ml-0">
                <button 
                  onClick={() => handleEdit(note)} 
                  className="p-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all shadow-xs"
                  title={settings.language === 'ar' ? 'تعديل' : 'Edit'}
                >
                  <Edit2 size={14}/>
                </button>
                <button 
                  type="button"
                  onClick={() => setNoteToDelete(note)} 
                  className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-xs cursor-pointer"
                  title={settings.language === 'ar' ? 'حذف' : 'Delete'}
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4 whitespace-pre-wrap flex-1">{note.content}</p>
            
            <div className="mt-auto pt-3 border-t border-black/5 dark:border-white/5">
              <div className="flex items-center gap-4 text-xs font-medium opacity-70">
                {note.date && <span className="flex items-center gap-1"><CalendarIcon size={12}/> {note.date}</span>}
              </div>
              {note.linkedSubjectIds && note.linkedSubjectIds.length > 0 && (
                <div className="flex items-center gap-1 text-xs font-bold mt-2 opacity-80">
                  <BookOpen size={12} /> {note.linkedSubjectIds.map(id => subjects.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
                </div>
              )}
              {note.attachments && note.attachments.length > 0 && (
                <div className="flex items-center gap-1 text-xs font-bold mt-1 opacity-80">
                  <Paperclip size={12} /> {note.attachments.length} {settings.language === 'ar' ? 'مرفقات' : 'attachments'}
                </div>
              )}
              
              {note.attachments && note.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
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
              {settings.language === 'ar' ? 'لا توجد ملاحظات مطابقة للفترة أو المجموعة المحددة.' : 'No notes found for this period or group.'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {settings.language === 'ar' ? 'يمكنك تدوين ملاحظة جديدة أو تغيير الفلتر.' : 'You can create a new note or change the filter.'}
            </p>
          </div>
        )}
      </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!noteToDelete}
        title={settings.language === 'ar' ? 'حذف الملاحظة' : 'Delete Note'}
        message={settings.language === 'ar' ? `هل أنت متأكد من حذف الملاحظة "${noteToDelete?.title}"؟` : `Are you sure you want to delete note "${noteToDelete?.title}"?`}
        confirmText={settings.language === 'ar' ? 'نعم، حذف' : 'Delete'}
        cancelText={settings.language === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (noteToDelete) {
            deleteNote(noteToDelete.id);
            setNoteToDelete(null);
          }
        }}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
}
