import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { CheckSquare, StickyNote, HardDrive, Calendar, Clock, ListTodo, Filter, X, RotateCcw } from 'lucide-react';
import { GroupsManager } from '../../components/settings/GroupsManager';

export function ProductivityDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tasks, notes, files, appointments, scheduleItems, subjects, settings } = useAppStore();
  const isAr = settings.language === 'ar';

  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setShowFilterPopover(false);
      }
    }
    if (showFilterPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterPopover]);

  const toggleYear = (y: number) => {
    setFilterYears(prev => prev.includes(y) ? prev.filter(yr => yr !== y) : [...prev, y]);
  };

  const toggleSemester = (s: number) => {
    setFilterSemesters(prev => prev.includes(s) ? prev.filter(sem => sem !== s) : [...prev, s]);
  };

  const resetToCurrentSemester = () => {
    if (currentSemester) {
      setFilterYears([currentSemester.yearIndex]);
      setFilterSemesters([currentSemester.semesterIndex]);
    } else {
      setFilterYears([]);
      setFilterSemesters([]);
    }
  };

  // Matching semesters & subjects for the current filter
  const selectedSemesters = settings.semesters.filter(sem => 
    (filterYears.length === 0 || filterYears.includes(sem.yearIndex)) &&
    (filterSemesters.length === 0 || filterSemesters.includes(sem.semesterIndex))
  );

  const matchingSubjectIds = new Set(
    subjects
      .filter(sub => 
        (filterYears.length === 0 || filterYears.includes(sub.yearIndex)) &&
        (filterSemesters.length === 0 || filterSemesters.includes(sub.semesterIndex))
      )
      .map(s => s.id)
  );

  const isItemMatchingYearSemester = (itemDate?: string, linkedSubjectIds?: string[]) => {
    if (filterYears.length === 0 && filterSemesters.length === 0) return true;
    
    // Check if linked to any matching subject
    if (linkedSubjectIds && linkedSubjectIds.length > 0) {
      if (linkedSubjectIds.some(id => matchingSubjectIds.has(id))) return true;
    }
    
    // Check item date against selected semester dates
    if (itemDate && selectedSemesters.length > 0) {
      const hasDateRange = selectedSemesters.some(s => s.startDate || s.endDate);
      if (hasDateRange) {
        const matchesDate = selectedSemesters.some(sem => {
          if (!sem.startDate && !sem.endDate) return false;
          if (sem.startDate && sem.endDate) {
            return itemDate >= sem.startDate && itemDate <= sem.endDate;
          }
          if (sem.startDate) return itemDate >= sem.startDate;
          if (sem.endDate) return itemDate <= sem.endDate;
          return false;
        });
        if (matchesDate) return true;
      }
    }

    // If item has no subject link and no matching dates defined in semesters, include by default if no subjects linked
    if (!linkedSubjectIds?.length) {
      const hasDefinedDates = selectedSemesters.some(s => s.startDate || s.endDate);
      if (!hasDefinedDates) return true;
    }

    return false;
  };

  // Filtered collections
  const filteredTasks = tasks.filter(t => isItemMatchingYearSemester(t.date, t.linkedSubjectIds));
  const filteredPendingTasks = filteredTasks.filter(t => !t.isCompleted);
  
  const filteredNotes = notes.filter(n => isItemMatchingYearSemester(n.date || (n as any).createdAt, n.linkedSubjectIds));
  const filteredAppointments = appointments.filter(a => isItemMatchingYearSemester(a.date, a.linkedSubjectIds));
  const filteredFiles = files.filter(f => isItemMatchingYearSemester(f.createdAt));
  
  const filteredScheduleItems = scheduleItems.filter(sc => {
    if (filterYears.length === 0 && filterSemesters.length === 0) return true;
    if (sc.subjectId && matchingSubjectIds.has(sc.subjectId)) return true;
    const sub = subjects.find(s => s.id === sc.subjectId);
    if (sub) {
      const yearMatch = filterYears.length === 0 || filterYears.includes(sub.yearIndex);
      const semMatch = filterSemesters.length === 0 || filterSemesters.includes(sub.semesterIndex);
      return yearMatch && semMatch;
    }
    return true;
  });

  const totalFileSize = filteredFiles.reduce((acc, f) => acc + f.size, 0);
  const totalFileSizeMB = (totalFileSize / (1024 * 1024)).toFixed(1);

  const stats = [
    { label: t('tasks'), count: filteredPendingTasks.length, icon: CheckSquare, to: '/productivity/tasks', color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: t('notes'), count: filteredNotes.length, icon: StickyNote, to: '/productivity/notes', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { label: t('my_appointments'), count: filteredAppointments.length, icon: Calendar, to: '/productivity/appointments', color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { label: t('my_schedule'), count: filteredScheduleItems.length, icon: Clock, to: '/productivity/schedule', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  ];

  const getFilterLabel = () => {
    if (filterYears.length === 1 && filterSemesters.length === 1) {
      return `${isAr ? 'السنة' : 'Year'} ${filterYears[0]} | ${isAr ? 'الفصل' : 'Semester'} ${filterSemesters[0]}`;
    }
    if (filterYears.length === 0 && filterSemesters.length === 0) {
      return isAr ? 'جميع الفصول' : 'All Semesters';
    }
    return isAr ? 'فصول متعددة' : 'Multiple Semesters';
  };

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      {/* Header with Year & Semester Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t('productivity_dashboard')}</h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-1 flex items-center gap-2">
            <span>{isAr ? 'نظرة عامة متكاملة على أدواتك وملخص إنتاجيتك' : 'Comprehensive overview of your tools and productivity'}</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40 text-xs">
              {getFilterLabel()}
            </span>
          </p>
        </div>

        {/* Year & Semester Filter Popover Control */}
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            type="button"
            onClick={() => setShowFilterPopover(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all border shadow-xs cursor-pointer ${
              filterYears.length > 0 || filterSemesters.length > 0 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-300' 
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Filter size={16} />
            <span>{t('filter')}</span>
            {(filterYears.length > 0 || filterSemesters.length > 0) && (
              <span className="flex items-center justify-center bg-indigo-600 text-white w-5 h-5 rounded-full text-xs font-bold mr-1 rtl:mr-0 rtl:ml-1">
                {filterYears.length + filterSemesters.length}
              </span>
            )}
          </button>

          {currentSemester && (filterYears.length !== 1 || filterYears[0] !== currentSemester.yearIndex || filterSemesters.length !== 1 || filterSemesters[0] !== currentSemester.semesterIndex) && (
            <button
              type="button"
              onClick={resetToCurrentSemester}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title={isAr ? 'الرجوع للفصل الدراسي الحالي' : 'Reset to Current Semester'}
            >
              <RotateCcw size={13} />
              <span>{isAr ? 'الفصل الحالي' : 'Current Term'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Modal / Popover */}
      {showFilterPopover && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            ref={filterPopoverRef}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-base text-zinc-900 dark:text-white">{t('filter')} - {isAr ? 'السنة والفصل الدراسي' : 'Year & Semester'}</span>
              </div>
              <div className="flex items-center gap-2">
                {(filterYears.length > 0 || filterSemesters.length > 0) && (
                  <button 
                    onClick={() => { setFilterYears([]); setFilterSemesters([]); }}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 cursor-pointer"
                  >
                    {isAr ? 'مسح الكل (عرض الكل)' : 'Clear All'}
                  </button>
                )}
                <button
                  onClick={() => setShowFilterPopover(false)}
                  className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Year Filter */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">{t('year')}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: settings.totalYears || 4 }).map((_, i) => (
                    <label key={i} className="flex items-center gap-2.5 text-sm cursor-pointer bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={filterYears.includes(i + 1)} 
                        onChange={() => toggleYear(i + 1)} 
                        className="rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700 bg-transparent w-4 h-4 cursor-pointer" 
                      />
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{t('year')} {i + 1}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Semester Filter */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">{t('semester')}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: settings.semestersPerYear || 2 }).map((_, i) => (
                    <label key={i} className="flex items-center gap-2.5 text-sm cursor-pointer bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={filterSemesters.includes(i + 1)} 
                        onChange={() => toggleSemester(i + 1)} 
                        className="rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700 bg-transparent w-4 h-4 cursor-pointer" 
                      />
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{t('semester')} {i + 1}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              {currentSemester ? (
                <button
                  type="button"
                  onClick={resetToCurrentSemester}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>{isAr ? 'تحديد الفصل الحالي' : 'Set to Current'}</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setShowFilterPopover(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {isAr ? 'تطبيق الفلتر' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div 
            key={idx}
            onClick={() => navigate(stat.to)}
            className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900 transition-all flex items-center justify-between group"
          >
            <div>
              <p className="text-sm text-zinc-500 mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black">{stat.count}</h3>
            </div>
            <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <stat.icon size={28} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        <div 
          onClick={() => navigate('/productivity/drive')}
          className="lg:col-span-1 bg-indigo-600 dark:bg-zinc-900 text-white rounded-3xl p-6 shadow-xl border border-transparent dark:border-zinc-800 flex flex-col justify-between cursor-pointer hover:shadow-2xl transition-all relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/20 rounded-xl"><HardDrive size={24} /></div>
              <h3 className="font-bold text-xl">{t('drive')}</h3>
            </div>
            <div className="mt-8">
              <div className="text-5xl font-black mb-2">{totalFileSizeMB} <span className="text-xl">MB</span></div>
              <p className="text-indigo-200">{filteredFiles.length} {isAr ? 'ملفات' : 'Files'}</p>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 blur-3xl rounded-full"></div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg">{isAr ? 'أحدث المهام والمواعيد' : 'Latest Tasks & Appointments'}</h3>
            <button onClick={() => navigate('/productivity/calendar')} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer">
              {isAr ? 'التقويم الكامل' : 'Full Calendar'}
            </button>
          </div>
          <div className="space-y-3">
            {[...filteredPendingTasks, ...filteredAppointments]
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .slice(0, 4)
              .map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${item.priority === 'high' ? 'bg-rose-500' : item.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <div>
                    <p className="font-bold text-sm">{item.title}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5"><Clock size={12}/> {item.date} {item.time ? `- ${item.time}` : ''}</p>
                  </div>
                </div>
                <div className="px-2 py-1 bg-zinc-200/50 dark:bg-zinc-700/50 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {'time' in item ? t('my_appointments') : t('tasks')}
                </div>
              </div>
            ))}
            {filteredPendingTasks.length === 0 && filteredAppointments.length === 0 && (
              <div className="py-8 text-center text-zinc-400 flex flex-col items-center">
                <ListTodo size={32} className="mb-2 opacity-50" />
                <p className="text-sm">{isAr ? 'لا توجد مهام أو مواعيد في هذه الفترة المحددة.' : 'No tasks or appointments found for this period.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Productivity Categories / Groups */}
      <div className="mt-2">
        <GroupsManager />
      </div>
    </div>
  );
}
