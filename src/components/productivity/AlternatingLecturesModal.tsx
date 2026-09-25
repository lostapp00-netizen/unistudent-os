import { useMemo, useState } from 'react';
import { X, Plus, Pencil, Trash2, Repeat, Power, CalendarDays, ArrowLeftRight, ChevronLeft } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ConfirmModal } from '../ui/CustomModal';
import type { AlternatingLecture, ScheduleItem } from '../../types';
import {
  resolveAlternatingVisibility,
  nextVisibleDate,
  describeInterval,
  toCalendarDate
} from '../../lib/alternatingLectures';
import { formatTimeRange12 } from '../../lib/utils';

const TYPE_LABEL_AR: Record<string, string> = { lecture: 'محاضرة', tutorial: 'سكشن', lab: 'معمل' };
const TYPE_LABEL_EN: Record<string, string> = { lecture: 'Lecture', tutorial: 'Tutorial', lab: 'Lab' };
const DAY_LABEL_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAY_LABEL_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(iso: string, isAr: boolean): string {
  const date = toCalendarDate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = (isAr ? DAY_LABEL_AR : DAY_LABEL_EN)[date.getDay()];
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayNum = String(date.getDate()).padStart(2, '0');
  return isAr ? `${day} ${dayNum}/${month}/${date.getFullYear()}` : `${day} ${month}/${dayNum}/${date.getFullYear()}`;
}

interface AlternatingLecturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleItems: ScheduleItem[];
  subjects: { id: string; name: string }[];
  isAr: boolean;
}

export function AlternatingLecturesModal({ isOpen, onClose, scheduleItems, subjects, isAr }: AlternatingLecturesModalProps) {
  const settings = useAppStore(s => s.settings);
  const addAlternatingLecture = useAppStore(s => s.addAlternatingLecture);
  const updateAlternatingLecture = useAppStore(s => s.updateAlternatingLecture);
  const deleteAlternatingLecture = useAppStore(s => s.deleteAlternatingLecture);

  const pairs = settings.alternatingLectures || [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pairToDelete, setPairToDelete] = useState<AlternatingLecture | null>(null);
  const [error, setError] = useState('');

  const emptyForm = {
    itemAId: '',
    itemBId: '',
    startItemId: '',
    startDate: todayIso(),
    intervalDays: 7,
    active: true
  };
  const [form, setForm] = useState(emptyForm);

  const itemById = useMemo(() => {
    const map = new Map<string, ScheduleItem>();
    scheduleItems.forEach(item => map.set(item.id, item));
    return map;
  }, [scheduleItems]);

  const describeItem = (id: string): string => {
    const item = itemById.get(id);
    if (!item) return isAr ? 'محاضرة محذوفة' : 'Deleted lecture';
    const subject = subjects.find(s => s.id === item.subjectId);
    const typeText = (isAr ? TYPE_LABEL_AR : TYPE_LABEL_EN)[item.type] || item.type;
    const day = (isAr ? DAY_LABEL_AR : DAY_LABEL_EN)[item.dayOfWeek] ?? '';
    return `${subject?.name || (isAr ? 'مادة' : 'Course')} · ${typeText} · ${day} ${formatTimeRange12(item.startTime, item.endTime, isAr ? 'ar' : 'en')}`;
  };

  // The lecture that is expected to show right now, per pair.
  const currentVisible = (pair: AlternatingLecture) => resolveAlternatingVisibility(pair, new Date());

  if (!isOpen) return null;

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setIsFormOpen(true);
  };

  const openEditForm = (pair: AlternatingLecture) => {
    setEditingId(pair.id);
    setForm({
      itemAId: pair.itemAId,
      itemBId: pair.itemBId,
      startItemId: pair.startItemId,
      startDate: pair.startDate,
      intervalDays: pair.intervalDays,
      active: pair.active
    });
    setError('');
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (!form.itemAId || !form.itemBId) {
      setError(isAr ? 'اختار المحاضرتين الأول.' : 'Pick both lectures first.');
      return;
    }
    if (form.itemAId === form.itemBId) {
      setError(isAr ? 'لازم تختار محاضرتين مختلفتين.' : 'The two lectures must be different.');
      return;
    }
    const interval = Number(form.intervalDays);
    if (!Number.isFinite(interval) || interval < 1) {
      setError(isAr ? 'المدة لازم تكون يوم واحد على الأقل.' : 'The interval must be at least 1 day.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)) {
      setError(isAr ? 'اختار تاريخ بداية صحيح.' : 'Pick a valid start date.');
      return;
    }

    // Never let one lecture sit in two pairs at once: that would make the
    // visible/hidden result depend on pair order.
    const conflicting = pairs.find(p => {
      if (editingId && p.id === editingId) return false;
      const ids = [p.itemAId, p.itemBId];
      return ids.includes(form.itemAId) || ids.includes(form.itemBId);
    });
    if (conflicting) {
      const clashingId = [form.itemAId, form.itemBId].find(id => [conflicting.itemAId, conflicting.itemBId].includes(id));
      setError(
        isAr
          ? `"${describeItem(clashingId || '')}" مشترك مع زوج تبادلي تاني. شيله من الزوج التاني الأول.`
          : `"${describeItem(clashingId || '')}" is already part of another pair. Remove it from that pair first.`
      );
      return;
    }

    const startItemId = form.startItemId === form.itemBId ? form.itemBId : form.itemAId;

    if (editingId) {
      updateAlternatingLecture(editingId, {
        itemAId: form.itemAId,
        itemBId: form.itemBId,
        startItemId,
        startDate: form.startDate,
        intervalDays: interval,
        active: form.active
      });
    } else {
      addAlternatingLecture({
        id: `alt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        itemAId: form.itemAId,
        itemBId: form.itemBId,
        startItemId,
        startDate: form.startDate,
        intervalDays: interval,
        active: form.active,
        createdAt: new Date().toISOString()
      });
    }
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleDelete = () => {
    if (!pairToDelete) return;
    deleteAlternatingLecture(pairToDelete.id);
    setPairToDelete(null);
  };

  const inputClass = "w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold";
  const labelClass = "block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5";

  const renderItemOptions = () => (
    <>
      <option value="">{isAr ? '— اختار محاضرة —' : '— Pick a lecture —'}</option>
      {scheduleItems.map(item => (
        <option key={item.id} value={item.id}>{describeItem(item.id)}</option>
      ))}
    </>
  );

  return (
    <>
      <div
        className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h3 className="font-black text-base text-zinc-900 dark:text-white">
                {isAr ? 'المحاضرات التبادلية' : 'Alternating Lectures'}
              </h3>
              <p className="text-[11px] font-bold text-zinc-500">
                {isAr ? 'محاضرتان تتبادلان الظهور في الجدول' : 'Two lectures taking turns in the schedule'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isFormOpen ? (
            /* ── Add / edit form ── */
            <div className="space-y-4">
              <button
                onClick={() => { setIsFormOpen(false); setEditingId(null); setError(''); }}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                <ChevronLeft size={14} /> {isAr ? 'رجوع للقائمة' : 'Back to list'}
              </button>

              {scheduleItems.length < 2 ? (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs font-bold text-amber-700 dark:text-amber-300">
                  {isAr ? 'محتاج على الأقل محاضرتين في الجدول الأول.' : 'You need at least two lectures in the schedule first.'}
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelClass}>{isAr ? 'المحاضرة الأولى' : 'First lecture'}</label>
                    <select value={form.itemAId} onChange={e => setForm({ ...form, itemAId: e.target.value })} className={inputClass}>
                      {renderItemOptions()}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>{isAr ? 'المحاضرة الثانية' : 'Second lecture'}</label>
                    <select value={form.itemBId} onChange={e => setForm({ ...form, itemBId: e.target.value })} className={inputClass}>
                      {renderItemOptions()}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>{isAr ? 'نبدأ بأنهي محاضرة؟' : 'Which one starts?'}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[form.itemAId, form.itemBId].map((id, idx) => {
                        if (!id) return null;
                        const isSelected = (form.startItemId || form.itemAId) === id;
                        return (
                          <button
                            key={`${id}-${idx}`}
                            type="button"
                            onClick={() => setForm({ ...form, startItemId: id })}
                            className={`p-3 rounded-xl border text-[11px] font-bold text-start transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {describeItem(id)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>{isAr ? 'يبدأ من' : 'Starts on'}</label>
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={e => setForm({ ...form, startDate: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{isAr ? 'التبديل كل' : 'Swap every'}</label>
                      <select
                        value={form.intervalDays}
                        onChange={e => setForm({ ...form, intervalDays: Number(e.target.value) })}
                        className={inputClass}
                      >
                        <option value={1}>{isAr ? 'كل يوم' : 'Every day'}</option>
                        <option value={7}>{isAr ? 'كل أسبوع' : 'Every week'}</option>
                        <option value={14}>{isAr ? 'كل أسبوعين' : 'Every 2 weeks'}</option>
                        <option value={30}>{isAr ? 'كل شهر' : 'Every month'}</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={e => setForm({ ...form, active: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {isAr ? 'مفعّل' : 'Active'}
                    </span>
                  </label>

                  {error && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleSave}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition-colors"
                  >
                    {editingId ? (isAr ? 'حفظ التعديل' : 'Save changes') : (isAr ? 'إضافة التبادل' : 'Add pair')}
                  </button>
                </>
              )}
            </div>
          ) : pairs.length === 0 ? (
            /* ── Empty state ── */
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                <Repeat size={26} />
              </div>
              <div className="space-y-1">
                <p className="font-black text-sm text-zinc-800 dark:text-zinc-200">
                  {isAr ? 'مفيش محاضرات تبادلية' : 'No alternating lectures yet'}
                </p>
                <p className="text-[11px] font-bold text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  {isAr
                    ? 'لو عندك محاضرتين بيتبدلوا مع بعض، أضفهم هنا ونظّم تبديلهم.'
                    : 'If two lectures take turns, add them here and set up the swap.'}
                </p>
              </div>
              <button
                onClick={openAddForm}
                disabled={scheduleItems.length < 2}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition-colors"
              >
                <Plus size={16} /> {isAr ? 'إضافة محاضرات تبادلية' : 'Add alternating lectures'}
              </button>
            </div>
          ) : (
            /* ── Pair list ── */
            <div className="space-y-3">
              {pairs.map(pair => {
                const resolved = currentVisible(pair);
                const visibleId = resolved?.visibleId;
                const hiddenId = resolved?.hiddenId;
                const nextForHidden = hiddenId ? nextVisibleDate(hiddenId, pair, new Date()) : null;
                return (
                  <div key={pair.id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className={`text-[11px] font-bold truncate flex items-center gap-1.5 ${visibleId === pair.itemAId ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                          {describeItem(pair.itemAId)}
                        </div>
                        <div className="flex items-center justify-center text-zinc-300 dark:text-zinc-600">
                          <ArrowLeftRight size={12} />
                        </div>
                        <div className={`text-[11px] font-bold truncate flex items-center gap-1.5 ${visibleId === pair.itemBId ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                          {describeItem(pair.itemBId)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateAlternatingLecture(pair.id, { active: !pair.active })}
                          title={pair.active ? (isAr ? 'إيقاف مؤقت' : 'Pause') : (isAr ? 'تفعيل' : 'Activate')}
                          className={`p-2 rounded-lg transition-colors ${pair.active ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                        >
                          <Power size={15} />
                        </button>
                        <button
                          onClick={() => openEditForm(pair)}
                          title={isAr ? 'تعديل' : 'Edit'}
                          className="p-2 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setPairToDelete(pair)}
                          title={isAr ? 'حذف' : 'Delete'}
                          className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-zinc-500 pt-2 border-t border-zinc-200/70 dark:border-zinc-700/50">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={11} /> {isAr ? 'يبدأ' : 'From'} {formatDateLabel(pair.startDate, isAr)}
                      </span>
                      <span>{describeInterval(pair.intervalDays, isAr)}</span>
                      {!pair.active && (
                        <span className="px-1.5 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                          {isAr ? 'موقوف' : 'Paused'}
                        </span>
                      )}
                    </div>

                    {pair.active && (
                      <div className="text-[10px] font-bold text-zinc-500 leading-relaxed">
                        {resolved ? (
                          <>
                            {isAr ? 'الظاهر حاليًا: ' : 'Showing now: '}
                            <span className="text-emerald-600 dark:text-emerald-400">{describeItem(resolved.visibleId)}</span>
                          </>
                        ) : (
                          <span className="text-zinc-400">
                            {isAr ? 'لسه بدأش — المحاضرتين ظاهرين حاليًا.' : 'Not started yet — both are visible.'}
                          </span>
                        )}
                        {nextForHidden && (
                          <span className="block text-zinc-400 mt-0.5">
                            {isAr ? 'ترجع تظهر يوم: ' : 'Hidden one returns on: '}
                            {formatDateLabel(`${nextForHidden.getFullYear()}-${String(nextForHidden.getMonth() + 1).padStart(2, '0')}-${String(nextForHidden.getDate()).padStart(2, '0')}`, isAr)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={openAddForm}
                disabled={scheduleItems.length < 2}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed font-black text-sm transition-colors"
              >
                <Plus size={16} /> {isAr ? 'إضافة محاضرات تبادلية' : 'Add alternating lectures'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

      <ConfirmModal
        isOpen={Boolean(pairToDelete)}
        title={isAr ? 'حذف التبادل' : 'Delete pair'}
        message={isAr
          ? 'هتحذف التبادل ده، والمحاضرتين هيرجعوا يظهروا عادي في الجدول. متأكد؟'
          : 'This removes the pair and both lectures go back to showing normally. Sure?'}
        confirmText={isAr ? 'حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        onConfirm={handleDelete}
        onCancel={() => setPairToDelete(null)}
      />
    </>
  );
}
