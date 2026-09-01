import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductivityGroupTabs } from '../../components/productivity/ProductivityGroupTabs';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../../components/ui/UnifiedSemesterFilter';
import { isItemMatchingSemesterFilter } from '../../lib/dateFilters';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/useAppStore';
import { Appointment, Priority } from '../../types';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Edit2, Paperclip, BookOpen, X, StickyNote, CheckSquare, FileText, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { EntityLinker } from '../../components/ui/EntityLinker';
import { LocalAttachmentUploader } from '../../components/ui/LocalAttachmentUploader';
import { AttachmentBadge } from '../../components/ui/AttachmentBadge';
import { ConfirmModal } from '../../components/ui/CustomModal';
import { EntityPreviewModal, PreviewEntity } from '../../components/ui/EntityPreviewModal';

export function Appointments() {
  const { t, i18n } = useTranslation();
  const { appointments, addAppointment, updateAppointment, deleteAppointment, subjects, files, notes, tasks, scheduleItems, settings, groups } = useAppStore();
  const isAr = settings.language === 'ar';
  
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);
  
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [previewEntity, setPreviewEntity] = useState<PreviewEntity | null>(null);

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
    linkedScheduleItemIds: [],
    attachments: []
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  
  const endDate = new Date(monthEnd);
  if (endDate.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  }
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const monthName = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(currentDate);

  const days = isAr 
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  const openAdd = (presetDate?: string) => {
    setEditingId(null);
    setForm({ 
      title: '', 
      description: '', 
      date: presetDate || new Date().toISOString().split('T')[0], 
      time: '12:00', 
      priority: 'medium', 
      linkedSubjectIds: [], 
      linkedFileIds: [], 
      linkedNoteIds: [], 
      linkedTaskIds: [], 
      linkedScheduleItemIds: [],
      attachments: [], 
      groupId: activeGroupId !== 'all' && activeGroupId !== 'none' ? activeGroupId : '' 
    });
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
      linkedScheduleItemIds: (app as any).linkedScheduleItemIds || [],
      attachments: app.attachments || [],
      groupId: app.groupId || ''
    });
    setShowAddModal(true);
  };

  const filteredAppointments = appointments.filter(appointment => {
    if (!isItemMatchingSemesterFilter(appointment.date, appointment.linkedSubjectIds, filterYears, filterSemesters, settings.semesters, subjects)) {
      return false;
    }
    
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
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">{isAr ? 'مواعيدي' : 'My Appointments'}</h1>
            <div className="mt-1.5 flex items-center gap-2">
              <UnifiedFilterBadge filterYears={filterYears} filterSemesters={filterSemesters} />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl">
                {filteredAppointments.length} {isAr ? 'موعد' : 'appointments'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <UnifiedSemesterFilter
              filterYears={filterYears}
              filterSemesters={filterSemesters}
              setFilterYears={setFilterYears}
              setFilterSemesters={setFilterSemesters}
            />

            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60">
              <button 
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-zinc-700 shadow-xs text-blue-600 dark:text-blue-400' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <List size={15} /> {isAr ? 'قائمة' : 'List'}
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  viewMode === 'calendar' 
                    ? 'bg-white dark:bg-zinc-700 shadow-xs text-blue-600 dark:text-blue-400' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <CalendarIcon size={15} /> {isAr ? 'التقويم' : 'Calendar'}
              </button>
            </div>

            <button 
              onClick={() => openAdd()}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-2xl transition-all text-xs sm:text-sm font-bold shadow-md shadow-blue-500/25 cursor-pointer"
            >
              <Plus size={18} />
              <span>{isAr ? 'إضافة موعد' : 'Add Appointment'}</span>
            </button>
          </div>
        </header>

        {/* List View */}
        {viewMode === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAppointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(app => (
              <div key={app.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col group relative overflow-hidden transition-all hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md">
                <div className={`absolute top-0 left-0 rtl:left-auto rtl:right-0 w-1.5 h-full ${
                  app.priority === 'high' ? 'bg-rose-500' : app.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                
                <div className="flex justify-between items-start mb-2 pl-3 rtl:pl-0 rtl:pr-3">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-white leading-tight">{app.title}</h3>
                    {app.groupId && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {groups.find(g => g.id === app.groupId)?.name}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={() => openEdit(app)} 
                      className="p-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl transition-all shadow-2xs cursor-pointer"
                      title={isAr ? 'تعديل' : 'Edit'}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setAppointmentToDelete(app)} 
                      className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-2xs cursor-pointer"
                      title={isAr ? 'حذف' : 'Delete'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                
                <div className="pl-3 rtl:pl-0 rtl:pr-3 space-y-2 mb-4">
                  <div className="flex items-center gap-4 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                      <CalendarIcon size={13} className="text-blue-500" /> {app.date}
                    </div>
                    {app.time && (
                      <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                        <Clock size={13} className="text-blue-500" /> {app.time}
                      </div>
                    )}
                  </div>
                  {app.description && <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">{app.description}</p>}
                </div>

                {/* Linked Items & Attachments */}
                <div className="mt-auto pl-3 rtl:pl-0 rtl:pr-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {app.linkedSubjectIds?.map(sid => {
                      const sub = subjects.find(s => s.id === sid);
                      return sub ? (
                        <span key={sid} className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 px-2 py-0.5 rounded-md">
                          <BookOpen size={10} /> {sub.name}
                        </span>
                      ) : null;
                    })}

                    {app.linkedNoteIds?.map(nid => {
                      const note = notes.find(n => n.id === nid);
                      return note ? (
                        <button
                          type="button"
                          key={nid}
                          onClick={() => setPreviewEntity({ type: 'note', id: nid })}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded-md hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          <StickyNote size={10} /> {note.title}
                        </button>
                      ) : null;
                    })}

                    {app.linkedTaskIds?.map(tid => {
                      const task = tasks.find(t => t.id === tid);
                      return task ? (
                        <button
                          type="button"
                          key={tid}
                          onClick={() => setPreviewEntity({ type: 'task', id: tid })}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                          <CheckSquare size={10} /> {task.title}
                        </button>
                      ) : null;
                    })}

                    {((app as any).linkedScheduleItemIds || []).map((scId: string) => {
                      const sc = scheduleItems.find(s => s.id === scId);
                      if (!sc) return null;
                      const sub = subjects.find(s => s.id === sc.subjectId);
                      return (
                        <button
                          type="button"
                          key={scId}
                          onClick={() => setPreviewEntity({ type: 'schedule', id: scId })}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          <Clock size={10} /> {sub?.name || 'حصة'}
                        </button>
                      );
                    })}

                    {app.linkedFileIds?.map(fid => {
                      const file = files.find(f => f.id === fid);
                      return file ? (
                        <span key={fid} className="inline-flex items-center gap-1 text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-md">
                          <FileText size={10} /> {file.name}
                        </span>
                      ) : null;
                    })}
                  </div>

                  {app.attachments && app.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {app.attachments.map(att => (
                        <AttachmentBadge key={att.id} attachment={att} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredAppointments.length === 0 && (
              <div className="col-span-full py-16 text-center text-zinc-400 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col items-center justify-center">
                <CalendarIcon size={48} className="mb-3 opacity-30 text-blue-500" />
                <p className="font-bold text-sm text-zinc-600 dark:text-zinc-400">
                  {isAr ? 'لا توجد مواعيد مطابقة للفترة أو المجموعة المحددة.' : 'No appointments found for this period or group.'}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {isAr ? 'يمكنك إضافة موعد جديد أو تغيير الفلتر.' : 'You can add a new appointment or change the filter.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Calendar View for Appointments Only */}
        {viewMode === 'calendar' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col flex-1">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-800/40">
              <button 
                onClick={prevMonth} 
                className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors shadow-2xs cursor-pointer"
                title={isAr ? 'الشهر السابق' : 'Previous Month'}
              >
                <ChevronRight size={18} className={isAr ? '' : 'rotate-180'} />
              </button>
              <div className="text-center">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white capitalize">{monthName}</h2>
                <p className="text-[11px] text-zinc-400">{isAr ? 'تقويم المواعيد فقط' : 'Appointments calendar only'}</p>
              </div>
              <button 
                onClick={nextMonth} 
                className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors shadow-2xs cursor-pointer"
                title={isAr ? 'الشهر التالي' : 'Next Month'}
              >
                <ChevronLeft size={18} className={isAr ? '' : 'rotate-180'} />
              </button>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <div className="min-w-[950px]">
                <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                  {days.map(day => (
                    <div key={day} className="py-3 text-center text-xs font-black text-zinc-700 dark:text-zinc-300">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 auto-rows-fr bg-zinc-200 dark:bg-zinc-800 gap-px">
                  {calendarDays.map((day) => {
                    const formattedDate = format(day, 'yyyy-MM-dd');
                    const dayAppointments = filteredAppointments.filter(a => a.date === formattedDate);
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    
                    return (
                      <div 
                        key={day.toString()} 
                        className={`min-h-[230px] p-2 transition-colors flex flex-col justify-between ${
                          !isCurrentMonth ? 'bg-zinc-50/70 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-600' : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        <div className="flex-1 flex flex-col min-w-0">
                          {/* Day Header */}
                          <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-zinc-100 dark:border-zinc-800/60">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                              isToday 
                                ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-500/30' 
                                : 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800'
                            }`}>
                              {format(day, 'd')}
                            </span>

                            <button
                              onClick={() => openAdd(formattedDate)}
                              className="p-1 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                              title={isAr ? 'إضافة موعد لهذا اليوم' : 'Add appointment on this day'}
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          {/* Slim Pills Items List */}
                          <div className="flex flex-col gap-1 overflow-y-auto max-h-[175px] pr-0.5 space-y-0.5">
                            {dayAppointments.map(app => (
                              <div 
                                key={app.id}
                                title={`${app.title}${app.time ? ` (${app.time})` : ''}`}
                                className="text-[11px] py-0.5 px-1.5 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 flex items-center justify-between gap-1 transition-all hover:scale-[1.02] cursor-pointer truncate"
                                onClick={() => openEdit(app)}
                              >
                                <div className="flex items-center gap-1 truncate min-w-0">
                                  <CalendarIcon size={10} className="shrink-0 text-amber-600 dark:text-amber-400" />
                                  {app.time && (
                                    <span className="font-bold shrink-0 text-[10px] opacity-80">{app.time}</span>
                                  )}
                                  <span className="font-bold truncate">{app.title}</span>
                                </div>
                              </div>
                            ))}

                            {dayAppointments.length === 0 && (
                              <div className="h-full flex items-center justify-center py-8 opacity-20">
                                <span className="text-[10px] text-zinc-400 font-medium">{isAr ? 'لا توجد مواعيد' : 'Empty'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Appointment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                {editingId ? (isAr ? 'تعديل الموعد' : 'Edit Appointment') : (isAr ? 'موعد جديد' : 'New Appointment')}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-2 space-y-4 flex-1 hide-scrollbar">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{t('title')}</label>
                <input 
                  type="text" 
                  value={form.title} 
                  onChange={e => setForm({...form, title: e.target.value})} 
                  placeholder={isAr ? 'عنوان الموعد...' : 'Appointment title...'}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{t('date')}</label>
                  <input 
                    type="date" 
                    value={form.date} 
                    onChange={e => setForm({...form, date: e.target.value})} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'الوقت' : 'Time'}</label>
                  <input 
                    type="time" 
                    value={form.time} 
                    onChange={e => setForm({...form, time: e.target.value})} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{t('priority')}</label>
                  <select 
                    value={form.priority} 
                    onChange={e => setForm({...form, priority: e.target.value as any})} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="high">{isAr ? 'مهم جداً' : 'High'}</option>
                    <option value="medium">{isAr ? 'عادي' : 'Medium'}</option>
                    <option value="low">{isAr ? 'مش مهم قوي' : 'Low'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'المجموعة' : 'Group'}</label>
                  <select 
                    value={form.groupId || ''} 
                    onChange={e => setForm({...form, groupId: e.target.value})} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">{isAr ? 'بدون مجموعة' : 'No Group'}</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{t('description')}</label>
                <textarea 
                  rows={3} 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  placeholder={isAr ? 'تفاصيل الموعد...' : 'Appointment details...'}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" 
                />
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">{isAr ? 'ربط بعناصر أخرى' : 'Link to other items'}</label>
                <EntityLinker
                  selectedSubjectIds={form.linkedSubjectIds}
                  onChangeSubjects={ids => setForm({...form, linkedSubjectIds: ids})}
                  selectedNoteIds={form.linkedNoteIds}
                  onChangeNotes={ids => setForm({...form, linkedNoteIds: ids})}
                  selectedTaskIds={form.linkedTaskIds}
                  onChangeTasks={ids => setForm({...form, linkedTaskIds: ids})}
                  selectedScheduleItemIds={(form as any).linkedScheduleItemIds}
                  onChangeScheduleItems={ids => setForm({...form, linkedScheduleItemIds: ids})}
                  selectedFileIds={form.linkedFileIds}
                  onChangeFiles={ids => setForm({...form, linkedFileIds: ids})}
                />
              </div>
              
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1">
                  <Paperclip size={13} /> {isAr ? 'المرفقات (مستقلة)' : 'Attachments (Independent)'}
                </label>
                <LocalAttachmentUploader attachments={form.attachments || []} onChange={att => setForm({...form, attachments: att})} />
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setShowAddModal(false)} 
                className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button 
                type="button"
                onClick={handleSave} 
                disabled={!form.title?.trim() || !form.date} 
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/25 cursor-pointer"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!appointmentToDelete}
        title={isAr ? 'حذف الموعد' : 'Delete Appointment'}
        message={isAr ? `هل أنت متأكد من حذف الموعد "${appointmentToDelete?.title}"؟` : `Are you sure you want to delete appointment "${appointmentToDelete?.title}"?`}
        confirmText={isAr ? 'نعم، حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (appointmentToDelete) {
            deleteAppointment(appointmentToDelete.id);
            setAppointmentToDelete(null);
          }
        }}
        onCancel={() => setAppointmentToDelete(null)}
      />

      {/* Entity Preview Modal */}
      <EntityPreviewModal
        preview={previewEntity}
        onClose={() => setPreviewEntity(null)}
      />
    </div>
  );
}
