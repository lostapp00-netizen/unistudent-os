import React from 'react';
import { X, Calendar, Clock, BookOpen, User, MapPin, CheckSquare, StickyNote, Calendar as CalendarIcon, FileText, CheckCircle2, AlertCircle, Edit2, ArrowLeftRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Priority } from '../../types';
import { formatTimeRange12 } from '../../lib/utils';
import { findPairForItem, isItemHiddenOnDate } from '../../lib/alternatingLectures';

export type PreviewEntity = 
  | { type: 'note'; id: string }
  | { type: 'task'; id: string }
  | { type: 'appointment'; id: string }
  | { type: 'schedule'; id: string };

interface EntityPreviewModalProps {
  preview: PreviewEntity | null;
  onClose: () => void;
  onEdit?: (entity: PreviewEntity) => void;
}

export function EntityPreviewModal({ preview, onClose, onEdit }: EntityPreviewModalProps) {
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
          <div className="flex items-center gap-2 text-xs text-zinc-500 flex-wrap">
            {note.date && (
              <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl font-bold">
                <Calendar size={13} /> {note.date}
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-xl font-bold ${
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
                  <span key={s.id} className="text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
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
          <div className="flex items-center gap-2 text-xs text-zinc-500 flex-wrap">
            {task.date && (
              <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl font-bold">
                <Calendar size={13} /> {task.date}
              </span>
            )}
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold ${
              task.isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            }`}>
              {task.isCompleted ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {task.isCompleted ? (isAr ? 'مكتملة' : 'Completed') : (isAr ? 'قيد الانتظار' : 'Pending')}
            </span>
            <span className={`px-2.5 py-1 rounded-xl font-bold ${
              task.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' :
              task.priority === 'low' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
              'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            }`}>
              {task.priority === 'high' ? (isAr ? 'أولوية عالية' : 'High Priority') : task.priority === 'low' ? (isAr ? 'أولوية منخفضة' : 'Low Priority') : (isAr ? 'أولوية متوسطة' : 'Medium Priority')}
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
          <div className="flex items-center gap-2 text-xs text-zinc-500 flex-wrap">
            <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl font-bold">
              <Calendar size={13} /> {app.date}
            </span>
            {app.time && (
              <span className="flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 rounded-xl font-bold">
                <Clock size={13} /> {app.time}
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-xl font-bold ${
              app.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' :
              app.priority === 'low' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
              'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            }`}>
              {app.priority === 'high' ? (isAr ? 'أولوية عالية' : 'High Priority') : app.priority === 'low' ? (isAr ? 'أولوية منخفضة' : 'Low Priority') : (isAr ? 'أولوية متوسطة' : 'Medium Priority')}
            </span>
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
            <span className="text-xs font-black px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-xl">
              {typeLabel}
            </span>
            <span className="text-xs font-bold px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl">
              {days[item.dayOfWeek]}
            </span>
            <span className="text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center gap-1.5">
              <Clock size={13} /> {formatTimeRange12(item.startTime, item.endTime, isAr ? 'ar' : 'en')}
            </span>
          </div>

          {/* Alternating lectures: name the lecture this one takes turns with,
              and whether its turn is showing right now. */}
          {(() => {
            const pairs = settings.alternatingLectures || [];
            const pair = findPairForItem(item.id, pairs);
            if (!pair || !pair.active) return null;
            const partnerId = pair.itemAId === item.id ? pair.itemBId : pair.itemAId;
            const partner = scheduleItems.find(s => s.id === partnerId);
            const partnerName = partner
              ? (subjects.find(s => s.id === partner.subjectId)?.name || (isAr ? 'محاضرة أخرى' : 'another lecture'))
              : (isAr ? 'محاضرة محذوفة' : 'a deleted lecture');
            const standingDown = isItemHiddenOnDate(item.id, new Date(), pairs);
            return (
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 flex items-center gap-3 text-xs">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                  <ArrowLeftRight size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">{isAr ? 'محاضرة تبادلية مع' : 'Alternating with'}</p>
                  <p className="font-extrabold text-sm text-indigo-900 dark:text-indigo-100 truncate">{partnerName}</p>
                  <p className="text-[11px] font-bold text-indigo-600/80 dark:text-indigo-300/80 mt-0.5">
                    {standingDown
                      ? (isAr ? 'دورها حاليًا: مخفية' : 'Currently standing down')
                      : (isAr ? 'دورها حاليًا: ظاهرة' : 'Currently showing')}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {item.doctorName ? (
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 flex items-center gap-3 text-xs">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold">{isAr ? 'المحاضر / الدكتور' : 'Instructor'}</p>
                  <p className="font-extrabold text-sm text-zinc-900 dark:text-white">{item.doctorName}</p>
                </div>
              </div>
            ) : null}
            {item.location ? (
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 flex items-center gap-3 text-xs">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold">{isAr ? 'المكان / القاعة' : 'Location'}</p>
                  <p className="font-extrabold text-sm text-zinc-900 dark:text-white">{item.location}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl shrink-0">
              {badgeIcon}
            </div>
            <h3 className="font-black text-lg text-zinc-900 dark:text-white truncate">{title}</h3>
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

        <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
          {onEdit ? (
            <button
              type="button"
              onClick={() => {
                const ent = preview;
                onClose();
                onEdit(ent);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-blue-500/20"
            >
              <Edit2 size={13} />
              <span>{isAr ? 'تعديل البيانات' : 'Edit Details'}</span>
            </button>
          ) : <div />}

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

