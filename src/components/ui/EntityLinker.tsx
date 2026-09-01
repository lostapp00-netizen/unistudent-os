import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Check, X, BookOpen, StickyNote, CheckSquare, Calendar as CalendarIcon, Clock, FileText, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';

interface EntityLinkerProps {
  selectedSubjectIds?: string[];
  onChangeSubjects?: (ids: string[]) => void;
  selectedNoteIds?: string[];
  onChangeNotes?: (ids: string[]) => void;
  selectedTaskIds?: string[];
  onChangeTasks?: (ids: string[]) => void;
  selectedAppointmentIds?: string[];
  onChangeAppointments?: (ids: string[]) => void;
  selectedScheduleItemIds?: string[];
  onChangeScheduleItems?: (ids: string[]) => void;
  selectedFileIds?: string[];
  onChangeFiles?: (ids: string[]) => void;
}

export function EntityLinker({
  selectedSubjectIds = [], onChangeSubjects,
  selectedNoteIds = [], onChangeNotes,
  selectedTaskIds = [], onChangeTasks,
  selectedAppointmentIds = [], onChangeAppointments,
  selectedScheduleItemIds = [], onChangeScheduleItems,
  selectedFileIds = [], onChangeFiles
}: EntityLinkerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'subjects' | 'notes' | 'tasks' | 'appointments' | 'schedule' | 'files'>('subjects');
  const [expandedScheduleDay, setExpandedScheduleDay] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  
  const { subjects, notes, tasks, appointments, scheduleItems, files } = useAppStore();

  const days = isAr 
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const driveFiles = files.filter(f => f.type === 'file');

  const toggleSubject = (id: string) => {
    if (!onChangeSubjects) return;
    if (selectedSubjectIds.includes(id)) onChangeSubjects(selectedSubjectIds.filter(x => x !== id));
    else onChangeSubjects([...selectedSubjectIds, id]);
  };

  const toggleNote = (id: string) => {
    if (!onChangeNotes) return;
    if (selectedNoteIds.includes(id)) onChangeNotes(selectedNoteIds.filter(x => x !== id));
    else onChangeNotes([...selectedNoteIds, id]);
  };

  const toggleTask = (id: string) => {
    if (!onChangeTasks) return;
    if (selectedTaskIds.includes(id)) onChangeTasks(selectedTaskIds.filter(x => x !== id));
    else onChangeTasks([...selectedTaskIds, id]);
  };

  const toggleAppointment = (id: string) => {
    if (!onChangeAppointments) return;
    if (selectedAppointmentIds.includes(id)) onChangeAppointments(selectedAppointmentIds.filter(x => x !== id));
    else onChangeAppointments([...selectedAppointmentIds, id]);
  };

  const toggleScheduleItem = (id: string) => {
    if (!onChangeScheduleItems) return;
    if (selectedScheduleItemIds.includes(id)) onChangeScheduleItems(selectedScheduleItemIds.filter(x => x !== id));
    else onChangeScheduleItems([...selectedScheduleItemIds, id]);
  };

  const toggleFile = (id: string) => {
    if (!onChangeFiles) return;
    if (selectedFileIds.includes(id)) onChangeFiles(selectedFileIds.filter(x => x !== id));
    else onChangeFiles([...selectedFileIds, id]);
  };

  const getSelectedItems = () => {
    const items: React.ReactNode[] = [];
    
    selectedSubjectIds.forEach(id => {
      const s = subjects.find(x => x.id === id);
      if (s) items.push(
        <span key={`sub-${id}`} className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium border border-blue-200 dark:border-blue-800/40">
          <BookOpen size={12} className="text-blue-600 dark:text-blue-400" /> {s.name}
          {onChangeSubjects && <button type="button" onClick={(e) => { e.stopPropagation(); onChangeSubjects(selectedSubjectIds.filter(x => x !== id)); }} className="hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 p-0.5 rounded transition-colors"><X size={12} /></button>}
        </span>
      );
    });
    
    selectedNoteIds.forEach(id => {
      const n = notes.find(x => x.id === id);
      if (n) items.push(
        <span key={`not-${id}`} className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium border border-amber-200 dark:border-amber-800/40">
          <StickyNote size={12} className="text-amber-600 dark:text-amber-400" /> {n.title}
          {onChangeNotes && <button type="button" onClick={(e) => { e.stopPropagation(); onChangeNotes(selectedNoteIds.filter(x => x !== id)); }} className="hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 p-0.5 rounded transition-colors"><X size={12} /></button>}
        </span>
      );
    });

    selectedTaskIds.forEach(id => {
      const tsk = tasks.find(x => x.id === id);
      if (tsk) items.push(
        <span key={`tsk-${id}`} className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium border border-emerald-200 dark:border-emerald-800/40">
          <CheckSquare size={12} className="text-emerald-600 dark:text-emerald-400" /> {tsk.title}
          {onChangeTasks && <button type="button" onClick={(e) => { e.stopPropagation(); onChangeTasks(selectedTaskIds.filter(x => x !== id)); }} className="hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 p-0.5 rounded transition-colors"><X size={12} /></button>}
        </span>
      );
    });

    selectedAppointmentIds.forEach(id => {
      const app = appointments.find(x => x.id === id);
      if (app) items.push(
        <span key={`app-${id}`} className="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium border border-sky-200 dark:border-sky-800/40">
          <CalendarIcon size={12} className="text-sky-600 dark:text-sky-400" /> {app.title}
          {onChangeAppointments && <button type="button" onClick={(e) => { e.stopPropagation(); onChangeAppointments(selectedAppointmentIds.filter(x => x !== id)); }} className="hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 p-0.5 rounded transition-colors"><X size={12} /></button>}
        </span>
      );
    });

    selectedScheduleItemIds.forEach(id => {
      const sc = scheduleItems.find(x => x.id === id);
      if (sc) {
        const sub = subjects.find(s => s.id === sc.subjectId);
        items.push(
          <span key={`sc-${id}`} className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium border border-indigo-200 dark:border-indigo-800/40">
            <Clock size={12} className="text-indigo-600 dark:text-indigo-400" /> {sub?.name || 'حصة'} ({days[sc.dayOfWeek]} {sc.startTime})
            {onChangeScheduleItems && <button type="button" onClick={(e) => { e.stopPropagation(); onChangeScheduleItems(selectedScheduleItemIds.filter(x => x !== id)); }} className="hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 p-0.5 rounded transition-colors"><X size={12} /></button>}
          </span>
        );
      }
    });

    selectedFileIds.forEach(id => {
      const f = driveFiles.find(x => x.id === id);
      if (f) items.push(
        <span key={`fil-${id}`} className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium border border-blue-200 dark:border-blue-800/40">
          <FileText size={12} className="text-blue-600 dark:text-blue-400" /> {f.name}
          {onChangeFiles && <button type="button" onClick={(e) => { e.stopPropagation(); onChangeFiles(selectedFileIds.filter(x => x !== id)); }} className="hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 p-0.5 rounded transition-colors"><X size={12} /></button>}
        </span>
      );
    });

    return items;
  };

  const selectedItems = getSelectedItems();

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-3.5 py-2.5 flex flex-wrap gap-2 items-center min-h-[44px] cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 transition-all hover:border-blue-300 dark:hover:border-blue-700"
      >
        {selectedItems.length === 0 ? (
          <span className="text-zinc-400 text-xs sm:text-sm flex-1">{isAr ? 'اضغط لاختيار عناصر للربط (مواد، ملاحظات، مهام، مواعيد، جدول، ملفات)...' : 'Select items to link (Subjects, Notes, Tasks, Appointments, Schedule, Files)...'}</span>
        ) : (
          <div className="flex flex-wrap gap-1.5 flex-1">
            {selectedItems}
          </div>
        )}
        <ChevronDown size={16} className={`text-zinc-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-80">
          {/* Category Tabs */}
          <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 overflow-x-auto hide-scrollbar p-1.5 gap-1">
            {onChangeSubjects && (
              <button
                type="button"
                onClick={() => setActiveCategory('subjects')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeCategory === 'subjects' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50'
                }`}
              >
                <BookOpen size={13} /> {isAr ? 'المواد' : 'Subjects'} ({subjects.length})
              </button>
            )}

            {onChangeNotes && (
              <button
                type="button"
                onClick={() => setActiveCategory('notes')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeCategory === 'notes' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50'
                }`}
              >
                <StickyNote size={13} /> {isAr ? 'الملاحظات' : 'Notes'} ({notes.length})
              </button>
            )}

            {onChangeTasks && (
              <button
                type="button"
                onClick={() => setActiveCategory('tasks')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeCategory === 'tasks' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50'
                }`}
              >
                <CheckSquare size={13} /> {isAr ? 'المهام' : 'Tasks'} ({tasks.length})
              </button>
            )}

            {onChangeAppointments && (
              <button
                type="button"
                onClick={() => setActiveCategory('appointments')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeCategory === 'appointments' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50'
                }`}
              >
                <CalendarIcon size={13} /> {isAr ? 'المواعيد' : 'Appointments'} ({appointments.length})
              </button>
            )}

            {onChangeScheduleItems && (
              <button
                type="button"
                onClick={() => setActiveCategory('schedule')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeCategory === 'schedule' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50'
                }`}
              >
                <CalendarDays size={13} /> {isAr ? 'الجدول' : 'Schedule'} ({scheduleItems.length})
              </button>
            )}

            {onChangeFiles && (
              <button
                type="button"
                onClick={() => setActiveCategory('files')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeCategory === 'files' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50'
                }`}
              >
                <FileText size={13} /> {isAr ? 'الدرايف' : 'Drive'} ({driveFiles.length})
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="overflow-y-auto p-2 divide-y divide-zinc-100 dark:divide-zinc-800 flex-1">
            {activeCategory === 'subjects' && (
              <div>
                {subjects.length === 0 ? (
                  <p className="p-4 text-center text-xs text-zinc-400">{isAr ? 'لا توجد مواد مسجلة' : 'No subjects registered'}</p>
                ) : (
                  subjects.map(s => (
                    <div key={s.id} onClick={() => toggleSubject(s.id)} className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-xl text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 text-zinc-800 dark:text-zinc-200 transition-colors">
                      <div className="flex items-center gap-2"><BookOpen size={14} className="text-blue-500" /> <span className="font-medium">{s.name}</span></div>
                      {selectedSubjectIds.includes(s.id) && <Check size={16} className="text-blue-600" />}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeCategory === 'notes' && (
              <div>
                {notes.length === 0 ? (
                  <p className="p-4 text-center text-xs text-zinc-400">{isAr ? 'لا توجد ملاحظات' : 'No notes'}</p>
                ) : (
                  notes.map(n => (
                    <div key={n.id} onClick={() => toggleNote(n.id)} className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-xl text-sm hover:bg-amber-50 dark:hover:bg-amber-950/30 text-zinc-800 dark:text-zinc-200 transition-colors">
                      <div className="flex items-center gap-2"><StickyNote size={14} className="text-amber-500" /> <span className="font-medium">{n.title}</span></div>
                      {selectedNoteIds.includes(n.id) && <Check size={16} className="text-amber-600" />}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeCategory === 'tasks' && (
              <div>
                {tasks.length === 0 ? (
                  <p className="p-4 text-center text-xs text-zinc-400">{isAr ? 'لا توجد مهام' : 'No tasks'}</p>
                ) : (
                  tasks.map(t => (
                    <div key={t.id} onClick={() => toggleTask(t.id)} className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-xl text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-zinc-800 dark:text-zinc-200 transition-colors">
                      <div className="flex items-center gap-2"><CheckSquare size={14} className="text-emerald-500" /> <span className="font-medium">{t.title}</span></div>
                      {selectedTaskIds.includes(t.id) && <Check size={16} className="text-emerald-600" />}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeCategory === 'appointments' && (
              <div>
                {appointments.length === 0 ? (
                  <p className="p-4 text-center text-xs text-zinc-400">{isAr ? 'لا توجد مواعيد' : 'No appointments'}</p>
                ) : (
                  appointments.map(a => (
                    <div key={a.id} onClick={() => toggleAppointment(a.id)} className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-xl text-sm hover:bg-sky-50 dark:hover:bg-sky-950/30 text-zinc-800 dark:text-zinc-200 transition-colors">
                      <div className="flex items-center gap-2"><CalendarIcon size={14} className="text-sky-500" /> <span className="font-medium">{a.title} ({a.date})</span></div>
                      {selectedAppointmentIds.includes(a.id) && <Check size={16} className="text-sky-600" />}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeCategory === 'schedule' && (
              <div className="space-y-1">
                {days.map((dayName, dayIdx) => {
                  const dayItems = scheduleItems.filter(s => s.dayOfWeek === dayIdx);
                  const isExpanded = expandedScheduleDay === dayIdx;
                  return (
                    <div key={dayIdx} className="rounded-xl border border-zinc-100 dark:border-zinc-800/80 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedScheduleDay(isExpanded ? null : dayIdx)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-blue-500" />
                          {dayName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 font-medium">
                          {dayItems.length} {isAr ? 'حصص' : 'classes'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="p-1.5 space-y-1 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
                          {dayItems.length === 0 ? (
                            <p className="text-[11px] text-zinc-400 py-2 text-center">{isAr ? 'لا توجد حصص في هذا اليوم' : 'No classes this day'}</p>
                          ) : (
                            dayItems.map(item => {
                              const sub = subjects.find(s => s.id === item.subjectId);
                              const isSelected = selectedScheduleItemIds.includes(item.id);
                              const typeText = item.type === 'lecture' ? (isAr ? 'محاضرة' : 'Lec') : item.type === 'tutorial' ? (isAr ? 'سكشن' : 'Sec') : (isAr ? 'معمل' : 'Lab');
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => toggleScheduleItem(item.id)}
                                  className="px-2.5 py-1.5 flex items-center justify-between rounded-lg text-xs hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer text-zinc-700 dark:text-zinc-300 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded">
                                      {typeText}
                                    </span>
                                    <span className="font-semibold">{sub?.name || 'حصة'}</span>
                                    <span className="text-[10px] text-zinc-400">({item.startTime} - {item.endTime})</span>
                                  </div>
                                  {isSelected && <Check size={14} className="text-blue-600" />}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeCategory === 'files' && (
              <div>
                {driveFiles.length === 0 ? (
                  <p className="p-4 text-center text-xs text-zinc-400">{isAr ? 'لا توجد ملفات في الدرايف' : 'No files in Drive'}</p>
                ) : (
                  driveFiles.map(f => (
                    <div key={f.id} onClick={() => toggleFile(f.id)} className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-xl text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 text-zinc-800 dark:text-zinc-200 transition-colors">
                      <div className="flex items-center gap-2"><FileText size={14} className="text-blue-500" /> <span className="font-medium truncate max-w-[200px]">{f.name}</span></div>
                      {selectedFileIds.includes(f.id) && <Check size={16} className="text-blue-600" />}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
