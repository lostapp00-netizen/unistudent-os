import React from 'react';
import { X, Calendar, Clock, BookOpen, User, MapPin, CheckSquare, StickyNote, Calendar as CalendarIcon, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Priority } from '../../types';

export type PreviewEntity = 
  | { type: 'note'; id: string }
  | { type: 'task'; id: string }
  | { type: 'appointment'; id: string }
  | { type: 'schedule'; id: string };

interface EntityPreviewModalProps {
  preview: PreviewEntity | null;
  onClose: () => void;
}

export function EntityPreviewModal({ preview, onClose }: EntityPreviewModalProps) {
  const { notes, tasks, appointments, scheduleItems, subjects, settings } = useAppStore();
  const isAr = settings.language === 'ar';

  if (!preview) return null;

  const days = isAr 
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let content: React.ReactNode = null;
  let title: string = '';
  let badgeIcon = <FileText size={18} />;

  if (preview.type === 'note') {
    const note = notes.find(n => n.id === preview.id);
    if (!note) {
      content = <p className="text-zinc-500 text-sm py-4">{isAr ? 'الملاحظة غير موجودة أو تم حذفها.' : 'Note not found or was deleted.'}</p>;
      title = isAr ? 'تفاصيل الملاحظة' : 'Note Details';
    } else {
      title = note.title;
      badgeIcon = <StickyNote size={18} className="text-amber-500" />;
      const linkedSubs = subjects.filter(s => (note.linkedSubjectIds || []).includes(s.id));
      content = (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
            {note.date && (
              <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                <Calendar size={13} /> {note.date}
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-lg font-bold ${
              note.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' :
              note.priority === 'low' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
              'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            }`}>
              {note.priority === 'high' ? (isAr ? 'أولوية عالية' : 'High Priority') : note.priority === 'low' ? (isAr ? 'أولوية منخفضة' : 'Low Priority') : (isAr ? 'أولوية متوسطة' : 'Medium Priority')}
            </span>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/50">
            <p className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">{note.content || (isAr ? 'لا يوجد محتوى' : 'No content')}</p>
          </div>

          {linkedSubs.length > 0 && (
            <div>
              <p className="text-xs font-bold text-zinc-400 mb-1.5">{isAr ? 'المواد المرتبطة' : 'Linked Subjects'}</p>
              <div className="flex flex-wrap gap-1.5">
                {linkedSubs.map(s => (
                  <span key={s.id} className="text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <BookOpen size={12} /> {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
  } else if (preview.type === 'task') {
    const task = tasks.find(t => t.id === preview.id);
    if (!task) {
      content = <p className="text-zinc-500 text-sm py-4">{isAr ? 'المهمة غير موجودة أو تم حذفها.' : 'Task not found or was deleted.'}</p>;
      title = isAr ? 'تفاصيل المهمة' : 'Task Details';
    } else {
      title = task.title;
      badgeIcon = <CheckSquare size={18} className="text-emerald-500" />;
      content = (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
            {task.date && (
              <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                <Calendar size={13} /> {task.date}
              </span>
            )}
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
              task.isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            }`}>
              {task.isCompleted ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {task.isCompleted ? (isAr ? 'مكتملة' : 'Completed') : (isAr ? 'قيد الانتظار' : 'Pending')}
            </span>
          </div>

          {task.description && (
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/50">
              <p className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">{task.description}</p>
            </div>
          )}
        </div>
      );
    }
  } else if (preview.type === 'appointment') {
    const app = appointments.find(a => a.id === preview.id);
    if (!app) {
      content = <p className="text-zinc-500 text-sm py-4">{isAr ? 'الموعد غير موجود أو تم حذفه.' : 'Appointment not found or was deleted.'}</p>;
      title = isAr ? 'تفاصيل الموعد' : 'Appointment Details';
    } else {
      title = app.title;
      badgeIcon = <CalendarIcon size={18} className="text-blue-500" />;
      content = (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
            <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
              <Calendar size={13} /> {app.date}
            </span>
            {app.time && (
              <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                <Clock size={13} /> {app.time}
              </span>
            )}
          </div>

          {app.description && (
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/50">
              <p className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">{app.description}</p>
            </div>
          )}
        </div>
      );
    }
  } else if (preview.type === 'schedule') {
    const item = scheduleItems.find(s => s.id === preview.id);
    if (!item) {
      content = <p className="text-zinc-500 text-sm py-4">{isAr ? 'عنصر الجدول غير موجود أو تم حذفه.' : 'Schedule item not found or was deleted.'}</p>;
      title = isAr ? 'تفاصيل الحصة/المحاضرة' : 'Class Details';
    } else {
      const sub = subjects.find(s => s.id === item.subjectId);
      title = sub ? sub.name : (isAr ? 'محاضرة في الجدول' : 'Scheduled Class');
      badgeIcon = <Clock size={18} className="text-blue-600" />;
      const typeLabel = item.type === 'lecture' ? (isAr ? 'محاضرة' : 'Lecture') : item.type === 'tutorial' ? (isAr ? 'سكشن' : 'Tutorial') : (isAr ? 'معمل' : 'Lab');
      content = (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-xl">
              {typeLabel}
            </span>
            <span className="text-xs font-bold px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl">
              {days[item.dayOfWeek]}
            </span>
            <span className="text-xs font-bold px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl flex items-center gap-1">
              <Clock size={12} /> {item.startTime} - {item.endTime}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {item.doctorName && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 flex items-center gap-2 text-xs">
                <User size={15} className="text-zinc-400" />
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold">{isAr ? 'المحاضر/الدكتور' : 'Instructor'}</p>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">{item.doctorName}</p>
                </div>
              </div>
            )}
            {item.location && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 flex items-center gap-2 text-xs">
                <MapPin size={15} className="text-zinc-400" />
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold">{isAr ? 'المكان / القاعة' : 'Location'}</p>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">{item.location}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl shrink-0">
              {badgeIcon}
            </div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white truncate">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto pr-1">
          {content}
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors cursor-pointer"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
