import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/useAppStore';
import { ScheduleItem } from '../../types';
import { Clock, Plus, Trash2, Edit2, LayoutGrid, Calendar as CalendarIcon, User, ChevronLeft, ChevronRight, Paperclip, FileText, CheckSquare, StickyNote, BookOpen, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { EntityLinker } from '../../components/ui/EntityLinker';
import { LocalAttachmentUploader } from '../../components/ui/LocalAttachmentUploader';
import { AttachmentBadge } from '../../components/ui/AttachmentBadge';
import { ConfirmModal } from '../../components/ui/CustomModal';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../../components/ui/UnifiedSemesterFilter';
import { EntityPreviewModal, PreviewEntity } from '../../components/ui/EntityPreviewModal';

export function Schedule() {
  const { t, i18n } = useTranslation();
  const { scheduleItems, addScheduleItem, updateScheduleItem, deleteScheduleItem, subjects, settings, files, notes, tasks, appointments } = useAppStore();
  const isAr = settings.language === 'ar';
  
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);
  
  const [itemToDelete, setItemToDelete] = useState<ScheduleItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(new Date().getDay());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [previewEntity, setPreviewEntity] = useState<PreviewEntity | null>(null);

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
    linkedAppointmentIds: [],
    attachments: []
  });

  const days = isAr 
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  
  const endDate = new Date(monthEnd);
  if (endDate.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  }
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const filteredScheduleItems = scheduleItems.filter(item => {
    if (filterYears.length === 0 && filterSemesters.length === 0) return true;
    const subject = subjects.find(s => s.id === item.subjectId);
    if (!subject) return true;
    const yearMatch = filterYears.length === 0 || filterYears.includes(subject.yearIndex);
    const semMatch = filterSemesters.length === 0 || filterSemesters.includes(subject.semesterIndex);
    return yearMatch && semMatch;
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const monthName = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(currentDate);

  const openAdd = (dayIdx?: number) => {
    setEditingItem(null);
    setNewItem({
      subjectId: subjects.length > 0 ? subjects[0].id : '',
      dayOfWeek: dayIdx !== undefined ? dayIdx : selectedDayOfWeek,
      startTime: '08:00',
      endTime: '10:00',
      location: '',
      type: 'lecture',
      doctorName: '',
      priority: 'medium',
      linkedFileIds: [],
      linkedNoteIds: [],
      linkedTaskIds: [],
      linkedAppointmentIds: [],
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

  const getCountsForDay = (dayIdx: number) => {
    const dayItems = filteredScheduleItems.filter(s => s.dayOfWeek === dayIdx);
    const lectures = dayItems.filter(s => s.type === 'lecture').length;
    const tutorials = dayItems.filter(s => s.type === 'tutorial').length;
    const labs = dayItems.filter(s => s.type === 'lab').length;
    return { lectures, tutorials, labs, total: dayItems.length };
  };

  const selectedDayCounts = getCountsForDay(selectedDayOfWeek);

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">{isAr ? 'جدولي' : 'My Schedule'}</h1>
          <div className="mt-1.5 flex items-center gap-2">
            <UnifiedFilterBadge filterYears={filterYears} filterSemesters={filterSemesters} />
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl">
              {filteredScheduleItems.length} {isAr ? 'حصة ومحاضرة' : 'classes'}
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                viewMode === 'day' 
                  ? 'bg-white dark:bg-zinc-700 shadow-xs text-blue-600 dark:text-blue-400' 
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <Clock size={15} /> {isAr ? 'اليوم' : 'Day'}
            </button>
            <button 
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                viewMode === 'week' 
                  ? 'bg-white dark:bg-zinc-700 shadow-xs text-blue-600 dark:text-blue-400' 
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <LayoutGrid size={15} /> {isAr ? 'أسبوع' : 'Week'}
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                viewMode === 'month' 
                  ? 'bg-white dark:bg-zinc-700 shadow-xs text-blue-600 dark:text-blue-400' 
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <CalendarIcon size={15} /> {isAr ? 'شهر' : 'Month'}
            </button>
          </div>

          <button 
            onClick={() => openAdd(viewMode === 'day' ? selectedDayOfWeek : 0)}
            className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-blue-500/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {t('add_schedule_item')}
          </button>
        </div>
      </header>

      {/* View Mode: Day */}
      {viewMode === 'day' && (
        <div className="flex-1 flex flex-col gap-5">
          {/* Day Navigation & Selector Bar */}
          <div className="bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col gap-3">
            {/* Days Horizontal Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {days.map((d, idx) => {
                const isSelected = selectedDayOfWeek === idx;
                const isRealToday = new Date().getDay() === idx;
                const counts = getCountsForDay(idx);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayOfWeek(idx)}
                    className={`py-2.5 px-2 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border text-center ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-md shadow-blue-500/20'
                        : 'bg-zinc-50/80 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200/60 dark:border-zinc-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs sm:text-sm font-extrabold">{d}</span>
                      {isRealToday && (
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                        }`}>
                          {isAr ? 'اليوم' : 'Today'}
                        </span>
                      )}
                    </div>

                    {/* Breakdown counts under each day */}
                    <div className={`text-[10px] font-bold mt-1.5 flex flex-wrap items-center justify-center gap-1 ${
                      isSelected ? 'text-blue-100' : 'text-zinc-500 dark:text-zinc-400'
                    }`}>
                      <span>{counts.lectures} {isAr ? 'محاضرة' : 'Lec'}</span>
                      <span>•</span>
                      <span>{counts.tutorials} {isAr ? 'سكشن' : 'Sec'}</span>
                      <span>•</span>
                      <span>{counts.labs} {isAr ? 'معمل' : 'Lab'}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedDayOfWeek((prev) => (prev === 0 ? 6 : prev - 1))}
                className="p-2 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-all shadow-2xs cursor-pointer"
                title={isAr ? 'اليوم السابق' : 'Previous Day'}
              >
                <ChevronRight size={16} className={isAr ? '' : 'rotate-180'} />
              </button>
              
              <button
                type="button"
                onClick={() => setSelectedDayOfWeek(new Date().getDay())}
                className="px-4 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl transition-all cursor-pointer"
              >
                {isAr ? 'العودة لليوم الحالي' : 'Go to Today'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedDayOfWeek((prev) => (prev === 6 ? 0 : prev + 1))}
                className="p-2 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-all shadow-2xs cursor-pointer"
                title={isAr ? 'اليوم التالي' : 'Next Day'}
              >
                <ChevronLeft size={16} className={isAr ? '' : 'rotate-180'} />
              </button>
            </div>
          </div>

          {/* Classes for Selected Day */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex-1 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold text-sm border border-blue-200 dark:border-blue-800/50">
                  {selectedDayOfWeek + 1}
                </span>
                <div>
                  <h2 className="font-extrabold text-lg sm:text-xl text-zinc-900 dark:text-white">
                    {days[selectedDayOfWeek]}
                  </h2>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {selectedDayCounts.lectures} {isAr ? 'محاضرة' : 'Lectures'} • {selectedDayCounts.tutorials} {isAr ? 'سكشن' : 'Sections'} • {selectedDayCounts.labs} {isAr ? 'معمل' : 'Labs'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => openAdd(selectedDayOfWeek)} 
                className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/50 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer self-start sm:self-auto"
              >
                <Plus size={14} />
                <span>{t('add_schedule_item')}</span>
              </button>
            </div>

            {/* List of items for selected day */}
            <div className="space-y-3">
              {filteredScheduleItems
                .filter(s => s.dayOfWeek === selectedDayOfWeek)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(item => {
                  const subject = subjects.find(s => s.id === item.subjectId);
                  const typeLabel = item.type === 'lecture' ? (isAr ? 'محاضرة' : 'Lecture') : item.type === 'tutorial' ? (isAr ? 'سكشن' : 'Tutorial') : (isAr ? 'معمل' : 'Lab');
                  
                  return (
                    <div 
                      key={item.id} 
                      className="bg-zinc-50/70 dark:bg-zinc-800/40 p-4 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 text-xs font-black text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/50 px-2.5 py-1 rounded-lg">
                              <Clock size={12} /> {item.startTime} - {item.endTime}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              item.type === 'lecture' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                              item.type === 'tutorial' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' :
                              'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            }`}>
                              {typeLabel}
                            </span>
                            {item.location && (
                              <span className="text-xs text-zinc-500 font-medium flex items-center gap-1">
                                <MapPin size={12} /> {item.location}
                              </span>
                            )}
                          </div>

                          <h3 className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-white">
                            {subject?.name || (isAr ? 'مادة غير محددة' : 'Course')}
                          </h3>

                          {item.doctorName && (
                            <p className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                              <User size={13} className="text-zinc-400" /> {item.doctorName}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button 
                            onClick={() => openEdit(item)} 
                            className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 rounded-xl shadow-2xs transition-colors cursor-pointer"
                            title={isAr ? 'تعديل' : 'Edit'}
                          >
                            <Edit2 size={14}/>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setItemToDelete(item)} 
                            className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 rounded-xl shadow-2xs transition-colors cursor-pointer"
                            title={isAr ? 'حذف' : 'Delete'}
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>

                      {/* Linked Entities & Attachments */}
                      {(item.linkedFileIds?.length || item.linkedNoteIds?.length || item.linkedTaskIds?.length || (item as any).linkedAppointmentIds?.length || item.attachments?.length) ? (
                        <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/40 flex flex-wrap gap-1.5">
                          {item.linkedNoteIds?.map(nid => {
                            const note = notes.find(n => n.id === nid);
                            return note ? (
                              <button
                                key={nid}
                                type="button"
                                onClick={() => setPreviewEntity({ type: 'note', id: nid })}
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 px-2.5 py-1 rounded-md hover:bg-amber-100 transition-colors cursor-pointer"
                              >
                                <StickyNote size={11} /> {note.title}
                              </button>
                            ) : null;
                          })}

                          {item.linkedTaskIds?.map(tid => {
                            const task = tasks.find(t => t.id === tid);
                            return task ? (
                              <button
                                key={tid}
                                type="button"
                                onClick={() => setPreviewEntity({ type: 'task', id: tid })}
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-1 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer"
                              >
                                <CheckSquare size={11} /> {task.title}
                              </button>
                            ) : null;
                          })}

                          {((item as any).linkedAppointmentIds || []).map((aid: string) => {
                            const app = appointments.find(a => a.id === aid);
                            return app ? (
                              <button
                                key={aid}
                                type="button"
                                onClick={() => setPreviewEntity({ type: 'appointment', id: aid })}
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 px-2.5 py-1 rounded-md hover:bg-sky-100 transition-colors cursor-pointer"
                              >
                                <CalendarIcon size={11} /> {app.title}
                              </button>
                            ) : null;
                          })}

                          {item.linkedFileIds?.map(fid => {
                            const file = files.find(f => f.id === fid);
                            return file ? (
                              <span key={fid} className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-md">
                                <FileText size={11} /> {file.name}
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
                  <Clock size={40} className="mb-2 opacity-30 text-blue-500" />
                  <p className="font-bold text-sm text-zinc-600 dark:text-zinc-400">
                    {isAr ? `لا توجد محاضرات مجدولة ليوم ${days[selectedDayOfWeek]}.` : `No classes scheduled for ${days[selectedDayOfWeek]}.`}
                  </p>
                  <button 
                    onClick={() => openAdd(selectedDayOfWeek)} 
                    className="mt-3 flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{isAr ? 'إضافة حصة/محاضرة لهذا اليوم' : 'Add class for this day'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Mode: Week */}
      {viewMode === 'week' && (
        <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden overflow-y-auto">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {days.map((day, idx) => {
              const dayItems = filteredScheduleItems.filter(s => s.dayOfWeek === idx).sort((a, b) => a.startTime.localeCompare(b.startTime));
              const counts = getCountsForDay(idx);
              return (
                <div key={idx} className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-200 dark:border-blue-800/50">
                        {idx + 1}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-white">{day}</h3>
                        <p className="text-[11px] font-bold text-zinc-400">
                          {counts.lectures} {isAr ? 'محاضرة' : 'Lec'} • {counts.tutorials} {isAr ? 'سكشن' : 'Sec'} • {counts.labs} {isAr ? 'معمل' : 'Lab'}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => openAdd(idx)} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
                      <Plus size={14} /> {t('add_schedule_item')}
                    </button>
                  </div>
                  
                  {dayItems.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dayItems.map(item => {
                        const subject = subjects.find(s => s.id === item.subjectId);
                        const typeLabel = item.type === 'lecture' ? (isAr ? 'محاضرة' : 'Lec') : item.type === 'tutorial' ? (isAr ? 'سكشن' : 'Sec') : (isAr ? 'معمل' : 'Lab');
                        return (
                          <div key={item.id} className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 relative group flex flex-col justify-between">
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  item.type === 'lecture' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                                  item.type === 'tutorial' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' :
                                  'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                                }`}>
                                  {typeLabel}
                                </span>
                                <h4 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white mt-1">{subject?.name || (isAr ? 'مادة غير معروفة' : 'Unknown course')}</h4>
                              </div>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => openEdit(item)} 
                                  className="p-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                                  title={isAr ? 'تعديل' : 'Edit'}
                                >
                                  <Edit2 size={13}/>
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setItemToDelete(item)} 
                                  className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                                  title={isAr ? 'حذف' : 'Delete'}
                                >
                                  <Trash2 size={13}/>
                                </button>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/40">
                              <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                                <Clock size={11} /> {item.startTime} - {item.endTime}
                              </span>
                              {item.location && <span>📍 {item.location}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 italic py-2">{isAr ? 'لا توجد حصص في هذا اليوم.' : 'Nothing on this day.'}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View Mode: Month Calendar */}
      {viewMode === 'month' && (
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
              <p className="text-[11px] text-zinc-400">{isAr ? 'تقويم الجدول الدراسي فقط' : 'Schedule items only'}</p>
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
                  const dayOfWeek = day.getDay();
                  const dayItems = filteredScheduleItems.filter(s => s.dayOfWeek === dayOfWeek).sort((a, b) => a.startTime.localeCompare(b.startTime));
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
                            onClick={() => openAdd(dayOfWeek)}
                            className="p-1 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                            title={isAr ? 'إضافة إلى هذا اليوم' : 'Add to this day'}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {/* Slim Pills Items List */}
                        <div className="flex flex-col gap-1 overflow-y-auto max-h-[175px] pr-0.5 space-y-0.5">
                          {dayItems.map(item => {
                            const subject = subjects.find(s => s.id === item.subjectId);
                            let pillStyle = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
                            let typeText = isAr ? 'محاضرة' : 'Lec';
                            
                            if (item.type === 'tutorial') {
                              pillStyle = 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800';
                              typeText = isAr ? 'سكشن' : 'Sec';
                            } else if (item.type === 'lab') {
                              pillStyle = 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800';
                              typeText = isAr ? 'معمل' : 'Lab';
                            }

                            return (
                              <div 
                                key={item.id}
                                title={`${subject?.name || 'مادة'} (${typeText}) ${item.startTime}-${item.endTime}`}
                                className={`text-[11px] py-0.5 px-1.5 rounded-md border flex items-center justify-between gap-1 transition-all hover:scale-[1.02] cursor-pointer truncate ${pillStyle}`}
                                onClick={() => openEdit(item)}
                              >
                                <div className="flex items-center gap-1 truncate min-w-0">
                                  <Clock size={10} className="shrink-0" />
                                  <span className="font-bold shrink-0 text-[10px] opacity-80">{item.startTime}</span>
                                  <span className="font-bold truncate">{subject?.name || 'مادة'}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-white/70 dark:bg-zinc-800/80 shrink-0">
                                  {typeText}
                                </span>
                              </div>
                            );
                          })}

                          {dayItems.length === 0 && (
                            <div className="h-full flex items-center justify-center py-8 opacity-20">
                              <span className="text-[10px] text-zinc-400 font-medium">{isAr ? 'لا توجد حصص' : 'Empty'}</span>
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

      {/* Add/Edit Class Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                {editingItem ? (isAr ? 'تعديل الحصة/المحاضرة' : 'Edit Class') : (isAr ? 'إضافة إلى الجدول' : 'Add to Schedule')}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer">
                <ChevronLeft size={20} className={isAr ? 'rotate-180' : ''} />
              </button>
            </div>

            <div className="overflow-y-auto pr-2 space-y-4 flex-1 hide-scrollbar">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'المادة' : 'Subject'}</label>
                <select 
                  value={newItem.subjectId} 
                  onChange={e => setNewItem({ ...newItem, subjectId: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                >
                  <option value="">{isAr ? '-- اختر المادة --' : '-- Select Subject --'}</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'اليوم' : 'Day'}</label>
                  <select 
                    value={newItem.dayOfWeek} 
                    onChange={e => setNewItem({ ...newItem, dayOfWeek: parseInt(e.target.value) })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    {days.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'النوع' : 'Type'}</label>
                  <select 
                    value={newItem.type} 
                    onChange={e => setNewItem({ ...newItem, type: e.target.value as any })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="lecture">{isAr ? 'محاضرة' : 'Lecture'}</option>
                    <option value="tutorial">{isAr ? 'سكشن' : 'Tutorial'}</option>
                    <option value="lab">{isAr ? 'معمل' : 'Lab'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'وقت البدء' : 'Start Time'}</label>
                  <input 
                    type="time" 
                    value={newItem.startTime} 
                    onChange={e => setNewItem({ ...newItem, startTime: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'وقت الانتهاء' : 'End Time'}</label>
                  <input 
                    type="time" 
                    value={newItem.endTime} 
                    onChange={e => setNewItem({ ...newItem, endTime: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'اسم الدكتور / المعيد' : 'Doctor / Instructor'}</label>
                  <input 
                    type="text" 
                    value={newItem.doctorName || ''} 
                    onChange={e => setNewItem({ ...newItem, doctorName: e.target.value })}
                    placeholder={isAr ? 'د. فلان...' : 'Dr. Name...'}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{isAr ? 'المكان / القاعة' : 'Location / Room'}</label>
                  <input 
                    type="text" 
                    value={newItem.location || ''} 
                    onChange={e => setNewItem({ ...newItem, location: e.target.value })}
                    placeholder={isAr ? 'مدرج 1 / معمل 2...' : 'Hall 1 / Lab 2...'}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">{isAr ? 'ربط بعناصر أخرى' : 'Link to other items'}</label>
                <EntityLinker
                  selectedNoteIds={newItem.linkedNoteIds}
                  onChangeNotes={ids => setNewItem({ ...newItem, linkedNoteIds: ids })}
                  selectedTaskIds={newItem.linkedTaskIds}
                  onChangeTasks={ids => setNewItem({ ...newItem, linkedTaskIds: ids })}
                  selectedAppointmentIds={(newItem as any).linkedAppointmentIds}
                  onChangeAppointments={ids => setNewItem({ ...newItem, linkedAppointmentIds: ids })}
                  selectedFileIds={newItem.linkedFileIds}
                  onChangeFiles={ids => setNewItem({ ...newItem, linkedFileIds: ids })}
                />
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1">
                  <Paperclip size={13} /> {isAr ? 'المرفقات (مستقلة)' : 'Attachments (Independent)'}
                </label>
                <LocalAttachmentUploader attachments={newItem.attachments || []} onChange={atts => setNewItem({ ...newItem, attachments: atts })} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={!newItem.subjectId}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25 disabled:opacity-50 cursor-pointer"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title={isAr ? 'حذف الحصة من الجدول' : 'Delete Class'}
        message={isAr ? 'هل أنت متأكد من حذف هذه الحصة من الجدول الدراسي؟' : 'Are you sure you want to delete this class from your schedule?'}
        confirmText={isAr ? 'نعم، حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (itemToDelete) {
            deleteScheduleItem(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        onCancel={() => setItemToDelete(null)}
      />

      {/* Entity Preview Modal */}
      <EntityPreviewModal
        preview={previewEntity}
        onClose={() => setPreviewEntity(null)}
      />
    </div>
  );
}
