import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductivityGroupTabs } from '../../components/productivity/ProductivityGroupTabs';
import { ProductivityFilter, ProductivityFilterState } from '../../components/productivity/ProductivityFilter';
import { isDateMatchingFilter } from '../../lib/dateFilters';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/useAppStore';
import { Appointment } from '../../types';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Edit2, Link as LinkIcon, Paperclip, BookOpen, X, StickyNote, CheckSquare, FileText } from 'lucide-react';
import { EntityLinker } from '../../components/ui/EntityLinker';
import { LocalAttachmentUploader } from '../../components/ui/LocalAttachmentUploader';

export function Appointments() {
  const { t } = useTranslation();
  const { appointments, addAppointment, updateAppointment, deleteAppointment, subjects, files, settings, groups } = useAppStore();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<ProductivityFilterState>({ type: "all", from: "", to: "" });
  const [activeGroupId, setActiveGroupId] = useState<string>("all");

  
  const [form, setForm] = useState<Partial<Appointment>>({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    priority: 'medium',
    linkedSubjectIds: [],
    linkedFileIds: [],
    linkedNoteIds: [],
    linkedTaskIds: [],
    attachments: []
  });

  const handleSave = () => {
    if (!form.title || !form.date) return;
    
    const finalGroupId = form.groupId || (activeGroupId === 'all' || activeGroupId === 'none' ? '' : activeGroupId);

    if (editingId) {
      updateAppointment(editingId, { ...form, groupId: finalGroupId });
    } else {
      addAppointment({ ...form, id: uuidv4(), groupId: finalGroupId } as Appointment);
    }
    
    setShowAddModal(false);
    setEditingId(null);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ title: '', description: '', date: new Date().toISOString().split('T')[0], time: '12:00', priority: 'medium', linkedSubjectIds: [], linkedFileIds: [], linkedNoteIds: [], linkedTaskIds: [], attachments: [], groupId: activeGroupId !== 'all' && activeGroupId !== 'none' ? activeGroupId : '' });
    setShowAddModal(true);
  };

  const openEdit = (app: Appointment) => {
    setEditingId(app.id);
    setForm({
      title: app.title,
      description: app.description || '',
      date: app.date,
      time: app.time || '12:00',
      priority: app.priority,
      linkedSubjectIds: app.linkedSubjectIds || [],
      linkedFileIds: app.linkedFileIds || [],
      linkedNoteIds: app.linkedNoteIds || [],
      linkedTaskIds: app.linkedTaskIds || [],
      attachments: app.attachments || []
    });
    setShowAddModal(true);
  };

  
  
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  
  const filteredAppointments = appointments.filter(appointment => {
    if (!isDateMatchingFilter(appointment.date, dateFilter, currentSemester)) return false;
    
    if (activeGroupId === 'none') {
      if (appointment.groupId) return false;
    } else if (activeGroupId !== 'all') {
      if (appointment.groupId !== activeGroupId) return false;
    }
    
    return true;
  });


  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <ProductivityGroupTabs activeGroupId={activeGroupId} setActiveGroupId={setActiveGroupId} />
      <div className="flex-1 flex flex-col gap-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold">{settings.language === 'ar' ? 'مواعيدي' : 'My Appointments'}</h1>
          <p className="text-zinc-500 mt-1">{settings.language === 'ar' ? 'إدارة مواعيدك الشخصية والدراسية' : 'Manage your personal and academic appointments'}</p>
        </div>
        <div className="flex items-center gap-3">
          <ProductivityFilter filter={dateFilter} setFilter={setDateFilter} />
          <button 
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-colors font-medium shadow-sm"
        >
          <Plus size={20} />
          {settings.language === 'ar' ? 'إضافة موعد' : 'Add Appointment'}
        </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAppointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(app => (
          <div key={app.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col group relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${
              app.priority === 'high' ? 'bg-rose-500' : app.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />
            
            <div className="flex justify-between items-start mb-2 pl-2">
              <h3 className="font-bold text-lg">{app.title}</h3>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => openEdit(app)} 
                  className="p-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all shadow-xs"
                  title={settings.language === 'ar' ? 'تعديل' : 'Edit'}
                >
                  <Edit2 size={15} />
                </button>
                <button 
                  onClick={() => deleteAppointment(app.id)} 
                  className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-xs"
                  title={settings.language === 'ar' ? 'حذف' : 'Delete'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            
            <div className="pl-2 space-y-2 mb-4">
              <div className="flex items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5"><CalendarIcon size={14} /> {app.date}</div>
                {app.time && <div className="flex items-center gap-1.5"><Clock size={14} /> {app.time}</div>}
              </div>
              {app.description && <p className="text-sm text-zinc-500">{app.description}</p>}
            </div>

            <div className="mt-auto pl-2 flex flex-wrap gap-2">
              {app.linkedSubjectIds?.map(sid => {
                const sub = subjects.find(s => s.id === sid);
                return sub ? (
                  <span key={sid} className="flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-1 rounded-md">
                    <BookOpen size={10} /> {sub.name}
                  </span>
                ) : null;
              })}
              {app.linkedFileIds?.map(fid => {
                const file = files.find(f => f.id === fid);
                return file ? (
                  <span key={fid} className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-md">
                    <FileText size={10} /> {file.name}
                  </span>
                ) : null;
              })}
              {app.attachments && app.attachments.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-md">
                  <Paperclip size={10} /> {app.attachments.length} {settings.language === 'ar' ? 'مرفقات' : 'attachments'}
                </span>
              )}
            </div>
            {app.attachments && app.attachments.length > 0 && (
              <div className="mt-2 pl-2 flex flex-wrap gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-2">
                {app.attachments.map(att => (
                  <button 
                    key={att.id} 
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (att.b2FileId) {
                        try {
                          const { getPresignedDownloadUrl } = await import('../../lib/backblaze');
                          const url = await getPresignedDownloadUrl(att.b2FileId);
                          window.open(url, '_blank');
                        } catch {
                          if (att.url) window.open(att.url, '_blank');
                        }
                      } else if (att.url) {
                        window.open(att.url, '_blank');
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-2 py-1 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700 font-medium cursor-pointer"
                  >
                    <FileText size={12} className="text-amber-500" />
                    <span className="truncate max-w-[120px]">{att.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {appointments.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-3xl">
            {settings.language === 'ar' ? 'لا توجد مواعيد مضافة حتى الآن.' : 'No appointments added yet.'}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingId ? (settings.language === 'ar' ? 'تعديل الموعد' : 'Edit Appointment') : (settings.language === 'ar' ? 'موعد جديد' : 'New Appointment')}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-2 space-y-4 flex-1 hide-scrollbar">
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('title')}</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('date')}</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Time</label>
                  <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">{t('priority')}</label>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as any})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="high">{t('high')}</option>
                  <option value="medium">{t('medium')}</option>
                  <option value="low">{t('low')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('description')}</label>
                <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-sm font-medium mb-2">{settings.language === 'ar' ? 'ربط بعناصر أخرى' : 'Link to other items'}</label>
                <EntityLinker
                  selectedSubjectIds={form.linkedSubjectIds}
                  onChangeSubjects={ids => setForm({...form, linkedSubjectIds: ids})}
                  selectedNoteIds={form.linkedNoteIds}
                  onChangeNotes={ids => setForm({...form, linkedNoteIds: ids})}
                  selectedTaskIds={form.linkedTaskIds}
                  onChangeTasks={ids => setForm({...form, linkedTaskIds: ids})}
                  selectedFileIds={form.linkedFileIds}
                  onChangeFiles={ids => setForm({...form, linkedFileIds: ids})}
                />
              </div>
              
              <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <label className="block text-sm font-medium mb-2 flex items-center gap-1"><Paperclip size={14} /> {settings.language === 'ar' ? 'المرفقات (مستقلة)' : 'Attachments (Independent)'}</label>
                <LocalAttachmentUploader attachments={form.attachments || []} onChange={att => setForm({...form, attachments: att})} />
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl font-medium transition-colors">
                {t('cancel')}
              </button>
              <button onClick={handleSave} disabled={!form.title?.trim() || !form.date} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors">
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
