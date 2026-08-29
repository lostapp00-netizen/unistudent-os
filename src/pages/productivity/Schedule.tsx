
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/useAppStore';
import { ScheduleItem } from '../../types';
import { Clock, Plus, Trash2, Edit2, LayoutGrid, Calendar as CalendarIcon, User, ChevronLeft, ChevronRight, Paperclip, FileText, CheckSquare, StickyNote, BookOpen } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { EntityLinker } from '../../components/ui/EntityLinker';
import { LocalAttachmentUploader } from '../../components/ui/LocalAttachmentUploader';
import { AttachmentBadge } from '../../components/ui/AttachmentBadge';

export function Schedule() {
  const { t, i18n } = useTranslation();
  const { scheduleItems, addScheduleItem, updateScheduleItem, deleteScheduleItem, subjects, settings, files, notes, tasks } = useAppStore();
  const [filterSemester, setFilterSemester] = useState<'current' | 'all'>('current');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [newItem, setNewItem] = useState<Partial<ScheduleItem>>({
    subjectId: '',
    dayOfWeek: 0,
    startTime: '08:00',
    endTime: '10:00',
    location: '',
    type: 'lecture',
    doctorName: '',
    priority: 'medium',
    linkedFileIds: [],
    linkedNoteIds: [],
    linkedTaskIds: [],
    attachments: []
  });

  const days = settings.language === 'ar' 
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  
  const endDate = new Date(monthEnd);

  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const filteredScheduleItems = scheduleItems.filter(item => {
    if (filterSemester === 'all') return true;
    if (!currentSemester) return true;
    const subject = subjects.find(s => s.id === item.subjectId);
    if (!subject) return true;
    return subject.yearIndex === currentSemester.yearIndex && subject.semesterIndex === currentSemester.semesterIndex;
  });
  if (endDate.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  }
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const monthName = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(currentDate);

  const openAdd = (dayIdx?: number) => {
    setEditingItem(null);
    setNewItem({
      subjectId: subjects.length > 0 ? subjects[0].id : '',
      dayOfWeek: dayIdx !== undefined ? dayIdx : 0,
      startTime: '08:00',
      endTime: '10:00',
      location: '',
      type: 'lecture',
      doctorName: '',
      priority: 'medium',
      linkedFileIds: [],
      linkedNoteIds: [],
      linkedTaskIds: [],
      attachments: []
    });
    setShowAddModal(true);
  };

  const openEdit = (item: ScheduleItem) => {
    setEditingItem(item);
    setNewItem(item);
    setShowAddModal(true);
  };

  const handleSave = () => {
    if (!newItem.subjectId) return;
    
    if (editingItem) {
      updateScheduleItem(editingItem.id, newItem as ScheduleItem);
    } else {
      addScheduleItem({ ...newItem, id: uuidv4() } as ScheduleItem);
    }
    setShowAddModal(false);
  };

  const priorityColors = {
    high: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    medium: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
    low: 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
  };

  const priorityBorders = {
    high: 'border-blue-500',
    medium: 'border-yellow-500',
    low: 'border-red-500'
  };

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{settings.language === 'ar' ? 'جدولي' : 'My Schedule'}</h1>
          <p className="text-zinc-500 mt-1">{settings.language === 'ar' ? 'جدول محاضراتك الأسبوعي' : 'Your weekly timetable'}</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <LayoutGrid size={16} /> {settings.language === 'ar' ? 'أسبوع' : 'Week'}
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'month' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <CalendarIcon size={16} /> {settings.language === 'ar' ? 'شهر' : 'Month'}
            </button>
          </div>
          <button 
            onClick={() => openAdd(0)}
            className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> {t('add_schedule_item')}
          </button>
        </div>
      </header>

      {viewMode === 'week' ? (
        <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden overflow-y-auto">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {days.map((day, idx) => {
              const dayItems = filteredScheduleItems.filter(s => s.dayOfWeek === idx).sort((a, b) => a.startTime.localeCompare(b.startTime));
              return (
                <div key={idx} className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm">{idx + 1}</span>
                      {day}
                    </h3>
                    <button onClick={() => openAdd(idx)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">{t('add_schedule_item')}</button>
                  </div>
                  
                  {dayItems.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dayItems.map(item => {
                        const subject = subjects.find(s => s.id === item.subjectId);
                        const pColor = item.priority ? priorityBorders[item.priority] : priorityBorders.medium;
                        return (
                          <div key={item.id} className={`bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border-l-4 ${pColor} border-y border-y-zinc-200 dark:border-y-zinc-700/50 border-r border-r-zinc-200 dark:border-r-zinc-700/50 relative group`}>
                            <div className="absolute top-3 left-3 rtl:right-3 rtl:left-auto flex items-center gap-1.5 transition-opacity">
                              <button 
                                onClick={() => openEdit(item)} 
                                className="p-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 rounded-xl shadow-xs transition-colors"
                                title={settings.language === 'ar' ? 'تعديل' : 'Edit'}
                              >
                                <Edit2 size={13}/>
                              </button>
                              <button 
                                onClick={() => deleteScheduleItem(item.id)} 
                                className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 rounded-xl shadow-xs transition-colors"
                                title={settings.language === 'ar' ? 'حذف' : 'Delete'}
                              >
                                <Trash2 size={13}/>
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                              <Clock size={12} /> {item.startTime} - {item.endTime}
                            </div>
                            <h4 className="font-bold text-base mb-1">{subject?.name || (settings.language === 'ar' ? 'مادة غير معروفة' : 'Unknown subject')}</h4>
                            
                            {item.doctorName && (
                              <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 mt-1 mb-2">
                                <User size={12} /> {item.doctorName}
                              </div>
                            )}

                            <div className="flex justify-between items-center mt-3 text-xs text-zinc-500">
                              <span className="px-2 py-1 bg-zinc-200/50 dark:bg-zinc-700/50 rounded-md">{t(item.type)}</span>
                              <span>{item.location}</span>
                            </div>

                            {(item.linkedFileIds?.length || item.linkedNoteIds?.length || item.linkedTaskIds?.length || item.attachments?.length) ? (
                              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700/50 flex flex-wrap gap-1">
                                {item.linkedFileIds?.map(fid => {
                                  const file = files.find(f => f.id === fid);
                                  return file ? (
                                    <span key={fid} className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-md">
                                      <FileText size={10} /> {file.name}
                                    </span>
                                  ) : null;
                                })}
                                {item.linkedNoteIds?.map(nid => {
                                  const note = notes.find(n => n.id === nid);
                                  return note ? (
                                    <span key={nid} className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-md">
                                      <StickyNote size={10} /> {note.title}
                                    </span>
                                  ) : null;
                                })}
                                {item.linkedTaskIds?.map(tid => {
                                  const task = tasks.find(t => t.id === tid);
                                  return task ? (
                                    <span key={tid} className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-md">
                                      <CheckSquare size={10} /> {task.title}
                                    </span>
                                  ) : null;
                                })}
                                {item.attachments && item.attachments.length > 0 && (
                                  <div className="w-full flex flex-wrap gap-1.5 mt-2">
                                    {item.attachments.map(att => (
                                      <AttachmentBadge key={att.id} attachment={att} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 italic py-2">{settings.language === 'ar' ? 'لا يوجد شيء في هذا اليوم.' : 'Nothing on this day.'}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col flex-1">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/30">
            <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-xl font-bold">{monthName}</h2>
            <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              <ChevronRight size={24} />
            </button>
          </div>
          
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
            {days.map(day => (
              <div key={day} className="py-3 text-center text-xs font-bold text-zinc-500">
                {day.substring(0, 3)}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 auto-rows-fr bg-zinc-200 dark:bg-zinc-800 gap-px">
            {calendarDays.map((day, idx) => {
              const dayOfWeek = day.getDay();
              const dayItems = filteredScheduleItems.filter(s => s.dayOfWeek === dayOfWeek).sort((a, b) => a.startTime.localeCompare(b.startTime));
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              return (
                <div 
                  key={day.toString()} 
                  className={`min-h-[120px] bg-white dark:bg-zinc-900 p-1.5 transition-colors ${!isCurrentMonth ? 'text-zinc-400 dark:text-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/50' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${isToday ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/30' : 'font-medium'}`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 overflow-y-auto max-h-[85px] hide-scrollbar">
                    {dayItems.map(item => {
                      const subject = subjects.find(s => s.id === item.subjectId);
                      const pColor = item.priority ? priorityColors[item.priority] : priorityColors.medium;
                      return (
                        <div 
                          key={item.id}
                          title={`${subject?.name} - ${item.startTime}`}
                          className={`text-[10px] px-1.5 py-1 rounded-md border-l-2 flex flex-col gap-0.5 cursor-pointer hover:opacity-80 ${pColor}`}
                          onClick={() => openEdit(item)}
                        >
                          <span className="font-bold truncate">{subject?.name}</span>
                          <span className="opacity-80 flex items-center gap-0.5"><Clock size={8}/> {item.startTime}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <h2 className="text-xl font-bold mb-6">{editingItem ? t('edit_schedule') : t('add_schedule_item')}</h2>
            
            <div className="overflow-y-auto pr-2 space-y-4 flex-1 hide-scrollbar">
              <div>
                <label className="block text-sm font-medium mb-1">{t('subjects')}</label>
                <select 
                  value={newItem.subjectId} 
                  onChange={e => setNewItem({...newItem, subjectId: e.target.value})}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" disabled>{settings.language === 'ar' ? 'اختر مادة' : 'Select subject'}</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{settings.language === 'ar' ? 'اسم الدكتور' : 'Doctor Name'}</label>
                <input 
                  type="text" 
                  value={newItem.doctorName || ''} 
                  onChange={e => setNewItem({...newItem, doctorName: e.target.value})} 
                  placeholder={settings.language === 'ar' ? 'د. أحمد محمود...' : 'Dr. Ahmed Mahmoud...'} 
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('day')}</label>
                  <select 
                    value={newItem.dayOfWeek} 
                    onChange={e => setNewItem({...newItem, dayOfWeek: Number(e.target.value)})}
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('type')}</label>
                  <select 
                    value={newItem.type} 
                    onChange={e => setNewItem({...newItem, type: e.target.value as any})}
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="lecture">{t('lecture')}</option>
                    <option value="tutorial">{t('tutorial')}</option>
                    <option value="lab">{t('lab')}</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">من</label>
                  <input type="time" value={newItem.startTime} onChange={e => setNewItem({...newItem, startTime: e.target.value})} className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">إلى</label>
                  <input type="time" value={newItem.endTime} onChange={e => setNewItem({...newItem, endTime: e.target.value})} className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('location')}</label>
                  <input type="text" value={newItem.location} onChange={e => setNewItem({...newItem, location: e.target.value})} placeholder={settings.language === 'ar' ? 'مدرج ١، معمل ٢...' : 'Hall 1, Lab 2...'} className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('priority')}</label>
                  <select 
                    value={newItem.priority || 'medium'} 
                    onChange={e => setNewItem({...newItem, priority: e.target.value as any})}
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="high">{settings.language === 'ar' ? 'مهم جداً (أزرق)' : 'High (Blue)'}</option>
                    <option value="medium">{settings.language === 'ar' ? 'عادي (أصفر)' : 'Medium (Yellow)'}</option>
                    <option value="low">{settings.language === 'ar' ? 'مش مهم قوي (أحمر)' : 'Low (Red)'}</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-sm font-medium mb-2">{settings.language === 'ar' ? 'ربط بعناصر أخرى' : 'Link to other items'}</label>
                <EntityLinker
                  selectedNoteIds={newItem.linkedNoteIds}
                  onChangeNotes={ids => setNewItem({...newItem, linkedNoteIds: ids})}
                  selectedTaskIds={newItem.linkedTaskIds}
                  onChangeTasks={ids => setNewItem({...newItem, linkedTaskIds: ids})}
                  selectedFileIds={newItem.linkedFileIds}
                  onChangeFiles={ids => setNewItem({...newItem, linkedFileIds: ids})}
                />
              </div>
              
              <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <label className="block text-sm font-medium mb-2 flex items-center gap-1"><Paperclip size={14} /> {settings.language === 'ar' ? 'المرفقات (مستقلة)' : 'Attachments (Independent)'}</label>
                <LocalAttachmentUploader attachments={newItem.attachments || []} onChange={att => setNewItem({...newItem, attachments: att})} />
              </div>
            </div>
            
            <div className="mt-6 flex gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 rounded-xl text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium">{t('cancel')}</button>
              <button onClick={handleSave} disabled={!newItem.subjectId} className="flex-1 px-4 py-3 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors font-bold">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
