import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, StickyNote, CheckSquare, X, BookOpen, Layers, FileText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { EntityAttachment, Priority } from '../../types';
import { MultiSelect } from '../ui/MultiSelect';
import { LocalAttachmentUploader } from '../ui/LocalAttachmentUploader';
import { EntityPreviewModal, PreviewEntity } from '../ui/EntityPreviewModal';

export function CalendarTab() {
  const { t, i18n } = useTranslation();
  const { tasks, notes, appointments, scheduleItems, addAppointment, addTask, addNote, subjects, settings } = useAppStore();
  const isAr = settings.language === 'ar';
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay()); 
  
  const endDate = new Date(monthEnd);
  if (endDate.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  }
  
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  
  const monthName = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(currentDate);
  
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'task' | 'appointment' | 'note'>('appointment');
  const [previewEntity, setPreviewEntity] = useState<PreviewEntity | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    priority: 'medium' as Priority,
    linkedSubjectIds: [] as string[],
    attachments: [] as EntityAttachment[]
  });

  const handleQuickAdd = () => {
    if (!form.title.trim()) return;
    const id = uuidv4();
    if (quickAddType === 'appointment') {
      addAppointment({ ...form, id, isCompleted: false });
    } else if (quickAddType === 'task') {
      addTask({ id, title: form.title, description: form.description, date: form.date, priority: form.priority, isCompleted: false, linkedSubjectIds: form.linkedSubjectIds, attachments: form.attachments, type: 'task' });
    } else {
      addNote({ id, title: form.title, content: form.description, date: form.date, priority: form.priority, linkedSubjectIds: form.linkedSubjectIds, attachments: form.attachments });
    }
    setShowQuickAdd(false);
    setForm({ title: '', description: '', date: new Date().toISOString().split('T')[0], time: '12:00', priority: 'medium', linkedSubjectIds: [], attachments: [] });
  };

  const getEventsForDay = (day: Date) => {
    const formattedDate = format(day, 'yyyy-MM-dd');
    const dayOfWeek = day.getDay();
    const dayEvents: any[] = [];
    
    // 1. Schedule Items (repeating weekly on day of week)
    scheduleItems
      .filter(s => s.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .forEach(s => {
        const sub = subjects.find(sub => sub.id === s.subjectId);
        dayEvents.push({
          id: s.id,
          title: sub?.name || (isAr ? 'حصة مجدولة' : 'Class'),
          time: s.startTime,
          endTime: s.endTime,
          type: s.type,
          eventType: 'schedule',
          location: s.location,
          doctorName: s.doctorName,
          priority: s.priority || 'medium'
        });
      });

    // 2. Tasks
    tasks.filter(t => t.date === formattedDate).forEach(t => dayEvents.push({ ...t, eventType: 'task' }));

    // 3. Appointments
    appointments.filter(a => a.date === formattedDate).forEach(a => dayEvents.push({ ...a, eventType: 'appointment' }));

    // 4. Notes (if dated)
    notes.filter(n => n.date === formattedDate).forEach(n => dayEvents.push({ ...n, eventType: 'note' }));
    
    return dayEvents;
  };
  
  const weekDays = isAr 
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col min-h-full pb-8">
      {/* Header & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white capitalize">{monthName}</h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">{isAr ? 'الكالندر العمومي الشامل (الجدول، المهام، المواعيد، الملاحظات)' : 'Global Calendar (Schedule, Tasks, Appointments, Notes)'}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => { setQuickAddType('task'); setShowQuickAdd(true); }} 
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl transition-all font-bold flex items-center gap-1.5 text-xs cursor-pointer shadow-2xs"
          >
            <CheckSquare size={15} /> {t('add_task')}
          </button>
          <button 
            onClick={() => { setQuickAddType('note'); setShowQuickAdd(true); }} 
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl transition-all font-bold flex items-center gap-1.5 text-xs cursor-pointer shadow-2xs"
          >
            <StickyNote size={15} /> {t('add_note')}
          </button>
          <button 
            onClick={() => { setQuickAddType('appointment'); setShowQuickAdd(true); }} 
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all font-bold flex items-center gap-1.5 text-xs cursor-pointer shadow-md shadow-blue-500/25"
          >
            <CalendarIcon size={15} /> {isAr ? 'إضافة موعد' : 'Add Appointment'}
          </button>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col flex-1">
        {/* Navigation Bar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-800/40">
          <button 
            onClick={prevMonth} 
            className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors shadow-2xs cursor-pointer"
            title={isAr ? 'الشهر السابق' : 'Previous Month'}
          >
            <ChevronRight size={18} className={isAr ? '' : 'rotate-180'} />
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())} 
            className="px-5 py-2 font-bold text-xs rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            {isAr ? 'اليوم الحالي' : 'Today'}
          </button>
          <button 
            onClick={nextMonth} 
            className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors shadow-2xs cursor-pointer"
            title={isAr ? 'الشهر التالي' : 'Next Month'}
          >
            <ChevronLeft size={18} className={isAr ? '' : 'rotate-180'} />
          </button>
        </div>
        
        {/* Horizontal scroll container for full visibility */}
        <div className="overflow-x-auto flex-1">
          <div className="min-w-[1200px]">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
              {weekDays.map(day => (
                <div key={day} className="py-3 text-center text-xs font-black text-zinc-700 dark:text-zinc-300">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 auto-rows-fr bg-zinc-200 dark:bg-zinc-800 gap-px">
              {days.map((day) => {
                const events = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentDate);
                const dayFormatted = format(day, 'yyyy-MM-dd');
                
                return (
                  <div 
                    key={day.toString()} 
                    className={`min-h-[420px] p-2.5 transition-colors flex flex-col justify-between ${
                      !isCurrentMonth 
                        ? 'bg-zinc-50/70 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-600' 
                        : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex-1 flex flex-col min-w-0">
                      {/* Day Header */}
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs font-black ${
                          isToday 
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
                            : 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800'
                        }`}>
                          {format(day, 'd')}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {events.length > 0 && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                              {events.length}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, date: dayFormatted }));
                              setShowQuickAdd(true);
                            }}
                            className="p-1 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                            title={isAr ? 'إضافة إلى هذا اليوم' : 'Add to this day'}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Rich Events List (Fits 5-8 items comfortably) */}
                      <div className="flex flex-col gap-2 overflow-y-auto max-h-[350px] pr-1 space-y-0.5">
                        {events.map(event => {
                          const isTask = event.eventType === 'task';
                          const isNote = event.eventType === 'note';
                          const isAppt = event.eventType === 'appointment';
                          const isSchedule = event.eventType === 'schedule';

                          let pillStyle = 'bg-zinc-50 border-zinc-200/80 text-zinc-800 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-200';
                          let badgeStyle = 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200';
                          let tagLabel = isAr ? 'عنصر' : 'Item';
                          let icon = <FileText size={11} className="shrink-0" />;

                          if (isSchedule) {
                            if (event.type === 'lecture') {
                              pillStyle = 'bg-blue-50/90 border-blue-200/80 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-200';
                              badgeStyle = 'bg-blue-200/70 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200';
                              tagLabel = isAr ? 'محاضرة' : 'Lecture';
                              icon = <Clock size={11} className="shrink-0 text-blue-600 dark:text-blue-400" />;
                            } else if (event.type === 'tutorial') {
                              pillStyle = 'bg-sky-50/90 border-sky-200/80 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800/60 dark:text-sky-200';
                              badgeStyle = 'bg-sky-200/70 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200';
                              tagLabel = isAr ? 'سكشن' : 'Section';
                              icon = <Clock size={11} className="shrink-0 text-sky-600 dark:text-sky-400" />;
                            } else {
                              pillStyle = 'bg-teal-50/90 border-teal-200/80 text-teal-900 dark:bg-teal-950/40 dark:border-teal-800/60 dark:text-teal-200';
                              badgeStyle = 'bg-teal-200/70 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200';
                              tagLabel = isAr ? 'معمل' : 'Lab';
                              icon = <Clock size={11} className="shrink-0 text-teal-600 dark:text-teal-400" />;
                            }
                          } else if (isTask) {
                            pillStyle = 'bg-emerald-50/90 border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200';
                            badgeStyle = 'bg-emerald-200/70 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200';
                            tagLabel = isAr ? 'مهمة' : 'Task';
                            icon = <CheckSquare size={11} className="shrink-0 text-emerald-600 dark:text-emerald-400" />;
                          } else if (isAppt) {
                            pillStyle = 'bg-amber-50/90 border-amber-200/80 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200';
                            badgeStyle = 'bg-amber-200/70 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200';
                            tagLabel = isAr ? 'موعد' : 'Appointment';
                            icon = <CalendarIcon size={11} className="shrink-0 text-amber-600 dark:text-amber-400" />;
                          } else if (isNote) {
                            pillStyle = 'bg-purple-50/90 border-purple-200/80 text-purple-900 dark:bg-purple-950/40 dark:border-purple-800/60 dark:text-purple-200';
                            badgeStyle = 'bg-purple-200/70 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200';
                            tagLabel = isAr ? 'ملاحظة' : 'Note';
                            icon = <StickyNote size={11} className="shrink-0 text-purple-600 dark:text-purple-400" />;
                          }

                          return (
                            <div 
                              key={`${event.eventType}-${event.id}`}
                              onClick={() => setPreviewEntity({ type: event.eventType as any, id: event.id })}
                              title={isAr ? 'انقر لعرض التفاصيل الكاملة' : 'Click to view full details'}
                              className={`p-2.5 rounded-2xl border transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer flex flex-col justify-between gap-1.5 ${pillStyle}`}
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 ${badgeStyle}`}>
                                    {icon}
                                    <span>{tagLabel}</span>
                                  </span>
                                  {event.time && (
                                    <span className="flex items-center gap-1 font-black text-[10px] opacity-90 shrink-0">
                                      <Clock size={10} /> {event.time} {event.endTime ? `- ${event.endTime}` : ''}
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white leading-tight line-clamp-2">
                                  {event.title}
                                </h4>
                              </div>

                              {(event.doctorName || event.location) && (
                                <div className="pt-1.5 border-t border-black/5 dark:border-white/10 flex flex-col gap-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                                  {event.doctorName && (
                                    <div className="flex items-center gap-1.5 truncate">
                                      <User size={11} className="shrink-0 opacity-70 text-blue-600 dark:text-blue-400" />
                                      <span className="truncate">{event.doctorName}</span>
                                    </div>
                                  )}
                                  {event.location && (
                                    <div className="flex items-center gap-1.5 truncate">
                                      <MapPin size={11} className="shrink-0 opacity-70 text-amber-600 dark:text-amber-400" />
                                      <span className="truncate">{event.location}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {events.length === 0 && (
                          <div className="h-full min-h-[140px] flex items-center justify-center opacity-25">
                            <span className="text-xs text-zinc-400 font-bold">{isAr ? 'لا توجد عناصر' : 'Empty'}</span>
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

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                {quickAddType === 'task' ? t('add_task') : quickAddType === 'note' ? t('add_note') : (isAr ? 'إضافة موعد' : 'Add Appointment')}
              </h3>
              <button onClick={() => setShowQuickAdd(false)} className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('title')}</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder={isAr ? 'العنوان...' : 'Title...'} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('date')}</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                {quickAddType === 'appointment' ? (
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'الوقت' : 'Time'}</label>
                    <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('priority')}</label>
                    <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as any})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="high">{isAr ? 'مهم جداً' : 'High'}</option>
                      <option value="medium">{isAr ? 'عادي' : 'Medium'}</option>
                      <option value="low">{isAr ? 'مش مهم قوي' : 'Low'}</option>
                    </select>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{t('description')}</label>
                <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder={isAr ? 'الوصف أو التفاصيل...' : 'Description...'} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" />
              </div>

              {subjects.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1"><BookOpen size={13}/> {isAr ? 'ربط بمادة' : 'Link Subject'}</label>
                  <MultiSelect
                    options={subjects.map(s => ({ id: s.id, label: s.name }))}
                    selectedIds={form.linkedSubjectIds}
                    onChange={(ids) => setForm(prev => ({ ...prev, linkedSubjectIds: ids }))}
                    placeholder={isAr ? 'اختر المواد' : 'Select subjects'}
                  />
                </div>
              )}
              
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'المرفقات (مستقلة)' : 'Attachments (Independent)'}</label>
                <LocalAttachmentUploader attachments={form.attachments} onChange={(atts) => setForm(prev => ({ ...prev, attachments: atts }))} />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button 
                type="button"
                onClick={handleQuickAdd} 
                disabled={!form.title.trim()} 
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/25 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entity Preview Modal */}
      <EntityPreviewModal
        preview={previewEntity}
        onClose={() => setPreviewEntity(null)}
      />
    </div>
  );
}
