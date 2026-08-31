import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, StickyNote, CheckSquare, X, BookOpen } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { EntityAttachment } from '../../types';
import { MultiSelect } from '../ui/MultiSelect';
import { LocalAttachmentUploader } from '../ui/LocalAttachmentUploader';

export function CalendarTab() {
  const { t, i18n } = useTranslation();
  const { tasks, notes, appointments, addAppointment, addTask, addNote, subjects, settings } = useAppStore();
  
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
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    priority: 'medium' as any,
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
    const dayEvents: any[] = [];
    
    tasks.filter(t => t.date === formattedDate).forEach(t => dayEvents.push({ ...t, eventType: 'task' }));
    appointments.filter(a => a.date === formattedDate).forEach(a => dayEvents.push({ ...a, eventType: 'appointment' }));
    notes.filter(n => n.date === formattedDate).forEach(n => dayEvents.push({ ...n, eventType: 'note' }));
    
    return dayEvents;
  };
  
  const weekDays = i18n.language === 'ar' 
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col min-h-full pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">{monthName}</h2>
          <p className="text-zinc-500">{settings.language === 'ar' ? 'نظرة عامة على جدولك الزمني' : 'Overview of your schedule'}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => { setQuickAddType('task'); setShowQuickAdd(true); }} className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 rounded-xl transition-colors font-medium flex items-center gap-2 text-sm">
            <CheckSquare size={16} /> {t('add_task')}
          </button>
          <button onClick={() => { setQuickAddType('note'); setShowQuickAdd(true); }} className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 rounded-xl transition-colors font-medium flex items-center gap-2 text-sm">
            <StickyNote size={16} /> {t('add_note')}
          </button>
          <button onClick={() => { setQuickAddType('appointment'); setShowQuickAdd(true); }} className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 rounded-xl transition-colors font-medium flex items-center gap-2 text-sm">
            <CalendarIcon size={16} /> {settings.language === 'ar' ? 'إضافة موعد' : 'Add Appointment'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col flex-1">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/30">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-6 py-2 font-bold rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
            {settings.language === 'ar' ? 'اليوم' : 'Today'}
          </button>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            <ChevronRight size={24} />
          </button>
        </div>
        
        {/* Horizontal scroll container for full visibility */}
        <div className="overflow-x-auto flex-1">
          <div className="min-w-[950px]">
            <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
              {weekDays.map(day => (
                <div key={day} className="py-3.5 text-center text-sm font-black text-zinc-600 dark:text-zinc-300">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 auto-rows-fr bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 gap-px">
              {days.map((day, idx) => {
                const events = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentDate);
                const dayFormatted = format(day, 'yyyy-MM-dd');
                
                return (
                  <div 
                    key={day.toString()} 
                    className={`min-h-[220px] bg-white dark:bg-zinc-900 p-2.5 transition-colors flex flex-col justify-between ${
                      !isCurrentMonth ? 'text-zinc-400 dark:text-zinc-600 bg-zinc-50/60 dark:bg-zinc-900/60' : ''
                    }`}
                  >
                    <div>
                      {/* Day Header */}
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs font-bold ${
                          isToday 
                            ? 'bg-purple-600 text-white font-black shadow-md shadow-purple-500/30' 
                            : 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800'
                        }`}>
                          {format(day, 'd')}
                        </span>

                        <button
                          onClick={() => {
                            setForm(prev => ({ ...prev, date: dayFormatted }));
                            setShowQuickAdd(true);
                          }}
                          className="p-1 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors"
                          title={settings.language === 'ar' ? 'إضافة إلى هذا اليوم' : 'Add to this day'}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Events List */}
                      <div className="flex flex-col gap-2 overflow-y-auto max-h-[160px] pr-1">
                        {events.map(event => {
                          const isTask = event.eventType === 'task';
                          const isNote = event.eventType === 'note';
                          const isAppt = event.eventType === 'appointment';

                          const linkedSubs = subjects.filter(s => (event.linkedSubjectIds || []).includes(s.id));

                          return (
                            <div 
                              key={event.id}
                              title={event.title}
                              className={`text-xs p-2 rounded-xl border flex flex-col gap-1 transition-all shadow-2xs hover:shadow-xs ${
                                event.priority === 'high' 
                                  ? 'border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200'
                                  : event.priority === 'low' 
                                  ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40 text-red-800 dark:text-red-200'
                                  : 'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                              }`}
                            >
                              {/* Event Header: Type Icon & Title */}
                              <div className="flex items-start gap-1.5">
                                {isTask && <CheckSquare size={13} className="shrink-0 text-emerald-600 mt-0.5" />}
                                {isNote && <StickyNote size={13} className="shrink-0 text-amber-600 mt-0.5" />}
                                {isAppt && <CalendarIcon size={13} className="shrink-0 text-indigo-600 mt-0.5" />}
                                <span className="font-bold text-xs leading-snug break-words">{event.title}</span>
                              </div>

                              {/* Time if present */}
                              {event.time && (
                                <div className="text-[10px] font-semibold opacity-90 flex items-center gap-1">
                                  <Clock size={10} />
                                  <span>{event.time}</span>
                                </div>
                              )}

                              {/* Linked Subjects */}
                              {linkedSubs.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {linkedSubs.map(s => (
                                    <span key={s.id} className="text-[9px] font-bold px-1.5 py-0.2 bg-white/70 dark:bg-zinc-800/80 rounded-md truncate max-w-[120px]">
                                      {s.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Description Preview */}
                              {(event.description || event.content || event.notes) && (
                                <p className="text-[10px] opacity-75 line-clamp-1">
                                  {event.description || event.content || event.notes}
                                </p>
                              )}
                            </div>
                          );
                        })}

                        {events.length === 0 && (
                          <div className="h-full flex items-center justify-center py-6 opacity-20">
                            <span className="text-[10px] text-zinc-400 font-medium">{settings.language === 'ar' ? 'فارغ' : 'Empty'}</span>
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

      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {quickAddType === 'task' ? t('add_task') : quickAddType === 'note' ? t('add_note') : (settings.language === 'ar' ? 'إضافة موعد' : 'Add Appointment')}
              </h3>
              <button onClick={() => setShowQuickAdd(false)} className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t('title')}</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t('date')}</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                {quickAddType === 'appointment' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Time</label>
                    <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                )}
                {quickAddType !== 'appointment' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t('priority')}</label>
                    <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as any})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="high">{settings.language === 'ar' ? 'مهم جداً (أزرق)' : 'High (Blue)'}</option>
                      <option value="medium">{settings.language === 'ar' ? 'عادي (أصفر)' : 'Medium (Yellow)'}</option>
                      <option value="low">{settings.language === 'ar' ? 'مش مهم قوي (أحمر)' : 'Low (Red)'}</option>
                    </select>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t('description')}</label>
                <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              {subjects.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1"><BookOpen size={14}/> {settings.language === 'ar' ? 'ربط بمادة' : 'Link Subject'}</label>
                  <MultiSelect
                    options={subjects.map(s => ({ id: s.id, label: s.name }))}
                    selectedIds={form.linkedSubjectIds}
                    onChange={(ids) => setForm(prev => ({ ...prev, linkedSubjectIds: ids }))}
                    placeholder={settings.language === 'ar' ? 'اختر المواد' : 'Select subjects'}
                  />
                </div>
              )}
              
              <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <label className="block text-sm font-medium mb-2 flex items-center gap-1">{settings.language === 'ar' ? 'المرفقات (مستقلة)' : 'Attachments (Independent)'}</label>
                <LocalAttachmentUploader attachments={form.attachments} onChange={(atts) => setForm(prev => ({ ...prev, attachments: atts }))} />
              </div>
              
              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                <button onClick={handleQuickAdd} disabled={!form.title.trim()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-2">
                  <Plus size={20} />
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
