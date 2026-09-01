
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
import { ConfirmModal } from '../../components/ui/CustomModal';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../../components/ui/UnifiedSemesterFilter';

export function Schedule() {
  const { t, i18n } = useTranslation();
  const { scheduleItems, addScheduleItem, updateScheduleItem, deleteScheduleItem, subjects, settings, files, notes, tasks } = useAppStore();
  
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);
  
  const [itemToDelete, setItemToDelete] = useState<ScheduleItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(new Date().getDay());
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

  const filteredScheduleItems = scheduleItems.filter(item => {
    if (filterYears.length === 0 && filterSemesters.length === 0) return true;
    const subject = subjects.find(s => s.id === item.subjectId);
    if (!subject) return true;
    const yearMatch = filterYears.length === 0 || filterYears.includes(subject.yearIndex);
    const semMatch = filterSemesters.length === 0 || filterSemesters.includes(subject.semesterIndex);
    return yearMatch && semMatch;
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
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">{settings.language === 'ar' ? 'جدولي' : 'My Schedule'}</h1>
          <div className="mt-1.5 flex items-center gap-2">
            <UnifiedFilterBadge filterYears={filterYears} filterSemesters={filterSemesters} />
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl">
              {filteredScheduleItems.length} {settings.language === 'ar' ? 'محاضرة/حصة' : 'classes'}
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
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${viewMode === 'day' ? 'bg-white dark:bg-zinc-700 shadow-xs text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <Clock size={15} /> {settings.language === 'ar' ? 'اليوم' : 'Day'}
            </button>
            <button 
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${viewMode === 'week' ? 'bg-white dark:bg-zinc-700 shadow-xs text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <LayoutGrid size={15} /> {settings.language === 'ar' ? 'أسبوع' : 'Week'}
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${viewMode === 'month' ? 'bg-white dark:bg-zinc-700 shadow-xs text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <CalendarIcon size={15} /> {settings.language === 'ar' ? 'شهر' : 'Month'}
            </button>
          </div>
          <button 
            onClick={() => openAdd(viewMode === 'day' ? selectedDayOfWeek : 0)}
            className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {t('add_schedule_item')}
          </button>
        </div>
      </header>

      {viewMode === 'day' && (
        <div className="flex-1 flex flex-col gap-5">
          {/* Day Navigation & Selector Bar */}
          <div className="bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Days Horizontal Tabs */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1">
              {days.map((d, idx) => {
                const isSelected = selectedDayOfWeek === idx;
                const isRealToday = new Date().getDay() === idx;
                const countForDay = filteredScheduleItems.filter(s => s.dayOfWeek === idx).length;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayOfWeek(idx)}
                    className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold truncate max-w-full">{d.slice(0, settings.language === 'ar' ? 7 : 3)}</span>
                    <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-zinc-400'}`}>
                      {countForDay} {settings.language === 'ar' ? 'حصص' : 'cls'}
                    </span>
                    {isRealToday && (
                      <span className={`text-[9px] font-black mt-0.5 px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'}`}>
                        {settings.language === 'ar' ? 'اليوم' : 'Today'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedDayOfWeek((prev) => (prev === 0 ? 6 : prev - 1))}
                className="p-2 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-all shadow-2xs cursor-pointer"
                title={settings.language === 'ar' ? 'اليوم السابق' : 'Previous Day'}
              >
                <ChevronRight size={16} className={settings.language === 'ar' ? '' : 'rotate-180'} />
              </button>
              
              <button
                type="button"
                onClick={() => setSelectedDayOfWeek(new Date().getDay())}
                className="px-3 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl transition-all cursor-pointer"
              >
                {settings.language === 'ar' ? 'اليوم الحالي' : 'Today'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedDayOfWeek((prev) => (prev === 6 ? 0 : prev + 1))}
                className="p-2 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-all shadow-2xs cursor-pointer"
                title={settings.language === 'ar' ? 'اليوم التالي' : 'Next Day'}
              >
                <ChevronLeft size={16} className={settings.language === 'ar' ? '' : 'rotate-180'} />
              </button>
            </div>
          </div>

          {/* Classes for Selected Day */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex-1 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                  {selectedDayOfWeek + 1}
                </span>
                <div>
                  <h2 className="font-extrabold text-lg sm:text-xl text-zinc-900 dark:text-white">
                    {days[selectedDayOfWeek]}
                  </h2>
                  <p className="text-xs text-zinc-400 font-medium">
                    {filteredScheduleItems.filter(s => s.dayOfWeek === selectedDayOfWeek).length} {settings.language === 'ar' ? 'محاضرات وحصص مقررة' : 'scheduled classes'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => openAdd(selectedDayOfWeek)} 
                className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>{t('add_schedule_item')}</span>
              </button>
            </div>

            {/* List of items */}
            <div className="space-y-3">
              {filteredScheduleItems
                .filter(s => s.dayOfWeek === selectedDayOfWeek)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(item => {
                  const subject = subjects.find(s => s.id === item.subjectId);
                  const pColor = item.priority ? priorityBorders[item.priority] : priorityBorders.medium;
                  return (
                    <div 
                      key={item.id} 
                      className={`bg-zinc-50 dark:bg-zinc-800/40 p-4 sm:p-5 rounded-2xl border-l-4 rtl:border-l-0 rtl:border-r-4 ${pColor} border-y border-zinc-200 dark:border-zinc-700/50 border-r rtl:border-r-0 rtl:border-l border-zinc-200 dark:border-zinc-700/50 relative group transition-all hover:border-indigo-200 dark:hover:border-indigo-800/60`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg">
                              <Clock size={12} /> {item.startTime} - {item.endTime}
                            </span>
                            <span className="px-2.5 py-1 bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold uppercase">
                              {t(item.type)}
                            </span>
                            {item.location && (
                              <span className="text-xs text-zinc-500 font-medium">📍 {item.location}</span>
                            )}
                          </div>

                          <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white">
                            {subject?.name || (settings.language === 'ar' ? 'مادة غير محددة' : 'Course')}
                          </h3>

                          {item.doctorName && (
                            <p className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                              <User size={13} /> {item.doctorName}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button 
                            onClick={() => openEdit(item)} 
                            className="p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 rounded-xl shadow-2xs transition-colors cursor-pointer"
                            title={settings.language === 'ar' ? 'تعديل' : 'Edit'}
                          >
                            <Edit2 size={14}/>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setItemToDelete(item)} 
                            className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 rounded-xl shadow-2xs transition-colors cursor-pointer"
                            title={settings.language === 'ar' ? 'حذف' : 'Delete'}
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>

                      {(item.linkedFileIds?.length || item.linkedNoteIds?.length || item.linkedTaskIds?.length || item.attachments?.length) ? (
                        <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/40 flex flex-wrap gap-1.5">
                          {item.linkedFileIds?.map(fid => {
                            const file = files.find(f => f.id === fid);
                            return file ? (
                              <span key={fid} className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1 rounded-md">
                                <FileText size={11} /> {file.name}
                              </span>
                            ) : null;
                          })}
                          {item.linkedNoteIds?.map(nid => {
                            const note = notes.find(n => n.id === nid);
                            return note ? (
                              <span key={nid} className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-1 rounded-md">
                                <StickyNote size={11} /> {note.title}
                              </span>
                            ) : null;
                          })}
                          {item.linkedTaskIds?.map(tid => {
                            const task = tasks.find(t => t.id === tid);
                            return task ? (
                              <span key={tid} className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-2.5 py-1 rounded-md">
                                <CheckSquare size={11} /> {task.title}
                              </span>
                            ) : null;
                          })}
                          {item.attachments && item.attachments.length > 0 && (
                            <div className="w-full flex flex-wrap gap-1.5 mt-1">
                              {item.attachments.map(att => (
                                <AttachmentBadge key={att.id} attachment={att} />
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

              {filteredScheduleItems.filter(s => s.dayOfWeek === selectedDayOfWeek).length === 0 && (
                <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center bg-zinc-50/50 dark:bg-zinc-800/20 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <Clock size={40} className="mb-2 opacity-30 text-indigo-500" />
                  <p className="font-bold text-sm text-zinc-600 dark:text-zinc-400">
                    {settings.language === 'ar' ? `لا توجد محاضرات مجدولة ليوم ${days[selectedDayOfWeek]}.` : `No classes scheduled for ${days[selectedDayOfWeek]}.`}
                  </p>
                  <button 
                    onClick={() => openAdd(selectedDayOfWeek)} 
                    className="mt-3 flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{settings.language === 'ar' ? 'إضافة حصة/محاضرة لهذا اليوم' : 'Add class for this day'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                                type="button"
                                onClick={() => setItemToDelete(item)} 
                                className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 rounded-xl shadow-xs transition-colors cursor-pointer"
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
          
          <div className="overflow-x-auto flex-1">
            <div className="min-w-[950px]">
              <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                {days.map(day => (
                  <div key={day} className="py-3.5 text-center text-xs font-black text-zinc-600 dark:text-zinc-300">
                    {day}
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
                      className={`min-h-[220px] bg-white dark:bg-zinc-900 p-2.5 transition-colors flex flex-col justify-between ${
                        !isCurrentMonth ? 'text-zinc-400 dark:text-zinc-600 bg-zinc-50/60 dark:bg-zinc-900/60' : ''
                      }`}
                    >
                      <div>
                        {/* Day Header */}
                        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs font-bold ${
                            isToday 
                              ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-500/30' 
                              : 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800'
                          }`}>
                            {format(day, 'd')}
                          </span>

                          <button
                            onClick={() => openAdd(dayOfWeek)}
                            className="p-1 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                            title={settings.language === 'ar' ? 'إضافة إلى هذا اليوم' : 'Add to this day'}
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Items List */}
                        <div className="flex flex-col gap-2 overflow-y-auto max-h-[160px] pr-1">
                          {dayItems.map(item => {
                            const subject = subjects.find(s => s.id === item.subjectId);
                            const pColor = item.priority ? priorityColors[item.priority] : priorityColors.medium;
                            const typeLabel = item.type === 'lecture' 
                              ? (settings.language === 'ar' ? 'محاضرة' : 'Lecture') 
                              : item.type === 'tutorial' 
                              ? (settings.language === 'ar' ? 'سكشن' : 'Section') 
                              : item.type === 'lab' 
                              ? (settings.language === 'ar' ? 'معمل' : 'Lab') 
                              : (settings.language === 'ar' ? 'امتحان' : 'Exam');

                            return (
                              <div 
                                key={item.id}
                                title={`${subject?.name} (${typeLabel})`}
                                className={`text-xs p-2.5 rounded-xl border flex flex-col gap-1 cursor-pointer hover:shadow-xs transition-all ${pColor}`}
                                onClick={() => openEdit(item)}
                              >
                                {/* Subject Name & Type */}
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-black text-xs leading-snug break-words">{subject?.name || 'مادة'}</span>
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-white/80 dark:bg-zinc-800/90 shrink-0">
                                    {typeLabel}
                                  </span>
                                </div>

                                {/* Time */}
                                <div className="text-[10px] font-bold opacity-90 flex items-center gap-1">
                                  <Clock size={10} />
                                  <span>{item.startTime} - {item.endTime}</span>
                                </div>

                                {/* Instructor / Doctor */}
                                {item.doctorName && (
                                  <div className="text-[10px] opacity-80 flex items-center gap-1">
                                    <User size={10} />
                                    <span className="truncate">{item.doctorName}</span>
                                  </div>
                                )}

                                {/* Location */}
                                {item.location && (
                                  <div className="text-[10px] opacity-80 truncate">
                                    📍 {item.location}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {dayItems.length === 0 && (
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title={settings.language === 'ar' ? 'حذف من الجدول' : 'Delete Schedule Item'}
        message={settings.language === 'ar' ? 'هل أنت متأكد من حذف هذه الحصة/المحاضرة من جدولك الدراسي؟' : 'Are you sure you want to delete this class from your timetable?'}
        confirmText={settings.language === 'ar' ? 'نعم، حذف' : 'Delete'}
        cancelText={settings.language === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (itemToDelete) {
            deleteScheduleItem(itemToDelete.id);
            setItemToDelete(null);
            if (editingItem?.id === itemToDelete.id) {
              setShowAddModal(false);
            }
          }
        }}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
