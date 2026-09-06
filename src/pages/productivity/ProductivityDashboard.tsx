import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { 
  CheckSquare, 
  StickyNote, 
  HardDrive, 
  Calendar as CalendarIcon, 
  Clock, 
  ListTodo, 
  Plus, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  BookOpen, 
  TrendingUp, 
  Folder, 
  Layers, 
  Zap, 
  ChevronRight,
  User,
  Paperclip,
  MapPin
} from 'lucide-react';
import { GroupsManager } from '../../components/settings/GroupsManager';
import { UnifiedSemesterFilter, UnifiedFilterBadge } from '../../components/ui/UnifiedSemesterFilter';
import { isItemMatchingSemesterFilter } from '../../lib/dateFilters';

export function ProductivityDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tasks, notes, files, appointments, scheduleItems, subjects, settings, updateTask } = useAppStore();
  const isAr = settings.language === 'ar';

  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const [filterYears, setFilterYears] = useState<number[]>(currentSemester ? [currentSemester.yearIndex] : []);
  const [filterSemesters, setFilterSemesters] = useState<number[]>(currentSemester ? [currentSemester.semesterIndex] : []);

  // Filtered collections based on semester date range and linked subjects
  const filteredTasks = tasks.filter(t => 
    isItemMatchingSemesterFilter(t.date, t.linkedSubjectIds, filterYears, filterSemesters, settings.semesters, subjects)
  );
  
  const filteredPendingTasks = filteredTasks.filter(t => !t.isCompleted);
  const filteredCompletedTasks = filteredTasks.filter(t => t.isCompleted);
  const taskCompletionRate = filteredTasks.length > 0 
    ? Math.round((filteredCompletedTasks.length / filteredTasks.length) * 100) 
    : 0;

  const filteredNotes = notes.filter(n => 
    isItemMatchingSemesterFilter(n.date || (n as any).createdAt, n.linkedSubjectIds, filterYears, filterSemesters, settings.semesters, subjects)
  );

  const filteredAppointments = appointments.filter(a => 
    isItemMatchingSemesterFilter(a.date, a.linkedSubjectIds, filterYears, filterSemesters, settings.semesters, subjects)
  );

  const filteredScheduleItems = scheduleItems.filter(sc => {
    if (filterYears.length === 0 && filterSemesters.length === 0) return true;
    const sub = subjects.find(s => s.id === sc.subjectId);
    if (!sub) return true;
    const yearMatch = filterYears.length === 0 || filterYears.includes(sub.yearIndex);
    const semMatch = filterSemesters.length === 0 || filterSemesters.includes(sub.semesterIndex);
    return yearMatch && semMatch;
  });

  // Calculate Real Files (excluding folders!) and all Entity Attachments
  const actualDriveFiles = files.filter(f => f.type !== 'folder');
  const driveFilesBytes = actualDriveFiles.reduce((acc, f) => acc + (Number(f.size) || 0), 0);

  // All entity attachments across tasks, notes, appointments, and schedule items
  const taskAttachments = tasks.flatMap(t => t.attachments || []);
  const noteAttachments = notes.flatMap(n => n.attachments || []);
  const appointmentAttachments = appointments.flatMap(a => a.attachments || []);
  const scheduleAttachments = scheduleItems.flatMap(s => s.attachments || []);
  
  const allAttachmentsCount = taskAttachments.length + noteAttachments.length + appointmentAttachments.length + scheduleAttachments.length;
  const attachmentsBytes = [...taskAttachments, ...noteAttachments, ...appointmentAttachments, ...scheduleAttachments]
    .reduce((acc, att) => acc + (Number(att.size) || 0), 0);

  const totalStorageBytes = driveFilesBytes + attachmentsBytes;
  const totalStorageMB = (totalStorageBytes / (1024 * 1024)).toFixed(2);
  const totalFilesCount = actualDriveFiles.length + allAttachmentsCount;

  // Format Storage Display
  const formatStorageString = () => {
    if (totalStorageBytes === 0) return '0.0 MB';
    if (totalStorageBytes < 1024 * 1024) {
      const kb = (totalStorageBytes / 1024).toFixed(1);
      return `${kb} KB`;
    }
    return `${(totalStorageBytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Today's schedule items
  const todayDayOfWeek = new Date().getDay(); // 0 is Sunday
  const todayScheduleItems = filteredScheduleItems
    .filter(item => item.dayOfWeek === todayDayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const daysArabic = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const daysEnglish = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDayName = isAr ? daysArabic[todayDayOfWeek] : daysEnglish[todayDayOfWeek];

  return (
    <div className="flex flex-col min-h-full gap-6 pb-12">
      {/* Top Header Bar */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            <span>{t('productivity_dashboard')}</span>
          </h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <UnifiedFilterBadge 
              filterYears={filterYears} 
              filterSemesters={filterSemesters} 
            />
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-3 py-1 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
              {filteredPendingTasks.length} {isAr ? 'مهام متبقية' : 'tasks left'} • {filteredAppointments.length} {isAr ? 'مواعيد' : 'appointments'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <UnifiedSemesterFilter
            filterYears={filterYears}
            filterSemesters={filterSemesters}
            setFilterYears={setFilterYears}
            setFilterSemesters={setFilterSemesters}
          />
          <button
            onClick={() => navigate('/productivity/tasks')}
            className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer"
          >
            <CheckSquare size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span>{isAr ? 'إضافة مهمة' : 'Add Task'}</span>
          </button>
          <button
            onClick={() => navigate('/productivity/notes')}
            className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer"
          >
            <StickyNote size={15} className="text-amber-500" />
            <span>{isAr ? 'إضافة ملاحظة' : 'Add Note'}</span>
          </button>
          <button
            onClick={() => navigate('/productivity/appointments')}
            className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer"
          >
            <CalendarIcon size={15} className="text-indigo-600 dark:text-indigo-400" />
            <span>{isAr ? 'إضافة موعد' : 'Add Appointment'}</span>
          </button>
        </div>
      </header>

      {/* 4 Interactive Statistics Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* 1. Tasks Card */}
        <div 
          onClick={() => navigate('/productivity/tasks')}
          className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('tasks')}</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                {filteredPendingTasks.length}
                <span className="text-xs font-bold text-zinc-400 ms-1.5 font-sans">
                  ({filteredCompletedTasks.length} {isAr ? 'منجزة' : 'done'})
                </span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckSquare size={24} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{isAr ? 'إجمالي المهام المسجلة:' : 'Total Tasks:'} <strong className="text-zinc-800 dark:text-zinc-200">{filteredTasks.length}</strong></span>
            <ChevronRight size={16} className={`text-zinc-400 group-hover:text-emerald-600 transition-transform ${isAr ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* 2. Notes Card */}
        <div 
          onClick={() => navigate('/productivity/notes')}
          className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md hover:border-amber-300 dark:hover:border-amber-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('notes')}</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">{filteredNotes.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <StickyNote size={24} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{isAr ? 'ملاحظات وأفكار مدونة' : 'Personal & Study Notes'}</span>
            <ChevronRight size={16} className={`text-zinc-400 group-hover:text-amber-600 transition-transform ${isAr ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* 3. Appointments Card */}
        <div 
          onClick={() => navigate('/productivity/appointments')}
          className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('my_appointments')}</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">{filteredAppointments.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CalendarIcon size={24} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{isAr ? 'المواعيد والتسليمات' : 'Deadlines & Events'}</span>
            <ChevronRight size={16} className={`text-zinc-400 group-hover:text-indigo-600 transition-transform ${isAr ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* 4. Schedule Items Card */}
        <div 
          onClick={() => navigate('/productivity/schedule')}
          className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800/60 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('my_schedule')}</p>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">{filteredScheduleItems.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{isAr ? `محاضرات اليوم (${todayScheduleItems.length})` : `Today's classes (${todayScheduleItems.length})`}</span>
            <ChevronRight size={16} className={`text-zinc-400 group-hover:text-blue-600 transition-transform ${isAr ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 Cols): Tasks & Today's Schedule Feed */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Upcoming Tasks & Appointments Feed */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <ListTodo size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                    {isAr ? 'المهام والمواعيد القادمة' : 'Upcoming Tasks & Appointments'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">{isAr ? 'إنجاز سريع ومتابعة الأولويات' : 'Quick complete and priority tracking'}</p>
                </div>
              </div>

              <button
                onClick={() => navigate('/productivity/tasks')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>{isAr ? 'عرض الكل' : 'View All'}</span>
                <ChevronRight size={14} className={isAr ? 'rotate-180' : ''} />
              </button>
            </div>

            <div className="space-y-3">
              {[...filteredPendingTasks.map(t => ({ ...t, kind: 'task' as const })), ...filteredAppointments.map(a => ({ ...a, kind: 'appointment' as const }))]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 5)
                .map((item) => {
                  const isTask = item.kind === 'task';
                  const priorityColor = item.priority === 'high' 
                    ? 'bg-rose-500' 
                    : item.priority === 'medium' 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500';

                  return (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isTask ? (
                          <button
                            onClick={() => updateTask(item.id, { isCompleted: !item.isCompleted })}
                            className="text-zinc-400 hover:text-indigo-600 transition-colors shrink-0 cursor-pointer"
                            title={isAr ? 'تحديد كمنجزة' : 'Mark as done'}
                          >
                            {item.isCompleted ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} />}
                          </button>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <CalendarIcon size={12} />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${priorityColor} shrink-0`} />
                            <p className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">{item.title}</p>
                          </div>
                          
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-400">
                            <span className="flex items-center gap-1"><Clock size={11} /> {item.date} {('time' in item && item.time) ? `- ${item.time}` : ''}</span>
                            {item.linkedSubjectIds && item.linkedSubjectIds.length > 0 && (
                              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold truncate">
                                <BookOpen size={10} /> {subjects.find(s => s.id === item.linkedSubjectIds![0])?.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                          isTask ? 'bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        }`}>
                          {isTask ? (isAr ? 'مهمة' : 'Task') : (isAr ? 'موعد' : 'Event')}
                        </span>
                      </div>
                    </div>
                  );
                })}

              {filteredPendingTasks.length === 0 && filteredAppointments.length === 0 && (
                <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center">
                  <ListTodo size={40} className="mb-2 opacity-30 text-indigo-500" />
                  <p className="font-bold text-xs text-zinc-600 dark:text-zinc-400">{isAr ? 'لا توجد مهام أو مواعيد قادمة في هذه الفترة.' : 'No upcoming tasks or appointments.'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Today's Schedule Lectures Preview */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                    {isAr ? `محاضرات اليوم (${todayDayName})` : `Today's Schedule (${todayDayName})`}
                  </h3>
                  <p className="text-[11px] text-zinc-400">{isAr ? 'جدولك الدراسي وحصصك المقررة لهذا اليوم' : 'Your classes and sessions for today'}</p>
                </div>
              </div>

              <button
                onClick={() => navigate('/productivity/schedule')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>{isAr ? 'الجدول الكامل' : 'Full Timetable'}</span>
                <ChevronRight size={14} className={isAr ? 'rotate-180' : ''} />
              </button>
            </div>

            <div className="space-y-2.5">
              {todayScheduleItems.map((item) => {
                const subject = subjects.find(s => s.id === item.subjectId);
                return (
                  <div
                    key={item.id}
                    onClick={() => navigate('/productivity/schedule')}
                    className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 transition-all"
                  >
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">{subject?.name || (isAr ? 'مادة دراسية' : 'Course')}</h4>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-400">
                        <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400"><Clock size={11} /> {item.startTime} - {item.endTime}</span>
                        {item.doctorName && <span className="flex items-center gap-1"><User size={11} /> {item.doctorName}</span>}
                        {item.location && <span className="flex items-center gap-0.5"><MapPin size={11} /> {item.location}</span>}
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                      {t(item.type)}
                    </span>
                  </div>
                );
              })}

              {todayScheduleItems.length === 0 && (
                <div className="py-8 text-center text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/20 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{isAr ? 'لا توجد محاضرات مجدولة لهذا اليوم. استمتع بوقتك!' : 'No lectures scheduled for today. Enjoy!'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Cloud Storage / Drive & Groups Manager */}
        <div className="space-y-6">
          
          {/* Cloud Storage & Drive Card */}
          <div 
            onClick={() => navigate('/productivity/drive')}
            className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-3xl p-6 shadow-xs border border-zinc-200 dark:border-zinc-800 cursor-pointer group hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                  <HardDrive size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white">{t('drive')}</h3>
                  <p className="text-[11px] text-zinc-400">{isAr ? 'المساحة السحابية المستهلكة' : 'Cloud Storage'}</p>
                </div>
              </div>

              <ChevronRight size={18} className={`text-zinc-400 group-hover:text-indigo-600 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform ${isAr ? 'rotate-180' : ''}`} />
            </div>

            <div className="pt-1">
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-1">
                {formatStorageString()}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {totalFilesCount} {isAr ? 'ملفات ومرفقات مرفوعة' : 'uploaded files & attachments'}
              </p>
            </div>

            {/* Visual Storage Distribution Bar */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden flex">
                <div 
                  className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(8, (totalStorageBytes / (50 * 1024 * 1024)) * 100))}%` }} 
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                <span>{actualDriveFiles.length} {isAr ? 'ملفات درايف' : 'drive files'}</span>
                <span>{allAttachmentsCount} {isAr ? 'مرفقات عناصر' : 'attachments'}</span>
              </div>
            </div>
          </div>

          {/* Productivity Groups & Categories Section */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 space-y-3 w-full max-w-full min-w-0">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <Layers size={18} className="text-indigo-500" />
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                {isAr ? 'المجموعات والتصنيفات' : 'Productivity Groups'}
              </h3>
            </div>

            <GroupsManager embedded />
          </div>

        </div>

      </div>
    </div>
  );
}
