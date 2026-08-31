import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { CheckSquare, StickyNote, HardDrive, Calendar, Clock, ListTodo, Filter } from 'lucide-react';
import { GroupsManager } from '../../components/settings/GroupsManager';
import { ProductivityFilter, ProductivityFilterState } from '../../components/productivity/ProductivityFilter';
import { isDateMatchingFilter } from '../../lib/dateFilters';

export function ProductivityDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tasks, notes, files, appointments, scheduleItems, settings } = useAppStore();
  const isAr = settings.language === 'ar';

  const [dateFilter, setDateFilter] = useState<ProductivityFilterState>({ type: 'all', from: '', to: '' });
  const currentSemester = settings.semesters.find(s => s.isCurrent);

  // Filtered collections
  const filteredTasks = tasks.filter(t => isDateMatchingFilter(t.date || (t as any).createdAt, dateFilter, currentSemester));
  const filteredPendingTasks = filteredTasks.filter(t => !t.isCompleted);
  
  const filteredNotes = notes.filter(n => isDateMatchingFilter(n.updatedAt || (n as any).createdAt, dateFilter, currentSemester));
  const filteredAppointments = appointments.filter(a => isDateMatchingFilter(a.date, dateFilter, currentSemester));
  const filteredFiles = files.filter(f => isDateMatchingFilter(f.createdAt, dateFilter, currentSemester));
  
  const filteredScheduleItems = scheduleItems.filter(sc => {
    if (dateFilter.type === 'semester' && currentSemester) {
      return sc.yearIndex === currentSemester.yearIndex && sc.semesterIndex === currentSemester.semesterIndex;
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

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      {/* Header with Centered Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t('productivity_dashboard')}</h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-1">
            {isAr ? 'نظرة عامة متكاملة على أدواتك وملخص إنتاجيتك' : 'Comprehensive overview of your tools and productivity'}
          </p>
        </div>

        {/* Centered Filter Control Bar */}
        <div className="w-full md:w-auto flex items-center justify-center">
          <div className="flex items-center gap-2 bg-zinc-100/80 dark:bg-zinc-800/60 p-1.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs">
            <ProductivityFilter filter={dateFilter} setFilter={setDateFilter} align="center" />
            {dateFilter.type !== 'all' && (
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 px-2 py-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                {isAr ? 'تصفية نشطة' : 'Active'}
              </span>
            )}
          </div>
        </div>
      </div>

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
