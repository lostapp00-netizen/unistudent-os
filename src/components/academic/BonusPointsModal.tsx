import React, { useMemo, useState } from 'react';
import { X, Plus, Pencil, Trash2, Award, CalendarDays, TrendingUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/useAppStore';
import { getPointsSummary } from '../../lib/academic';
import { ConfirmModal } from '../ui/CustomModal';
import type { BonusPointEntry } from '../../types';

interface BonusPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(iso: string, isAr: boolean): string {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso || '';
  const [, y, m, d] = match;
  return isAr ? `${Number(d)}/${Number(m)}/${y}` : `${y}-${m}-${d}`;
}

/**
 * النقط الإضافية (نظام النقط): نقط حصل عليها الطالب خارج درجات المواد.
 *
 * مهم: النقط دي بتتضاف على النقط المُحصَّلة فقط — التوتال الكلي اللي الطالب
 * حدده في الإعدادات ما بيتغيّرش، فالزيادة بتقرّبه من التوتال مش بتكبّره.
 */
export function BonusPointsModal({ isOpen, onClose, isAr }: BonusPointsModalProps) {
  const settings = useAppStore(s => s.settings);
  const subjects = useAppStore(s => s.subjects);
  const updateSettings = useAppStore(s => s.updateSettings);

  const entries: BonusPointEntry[] = useMemo(
    () => (Array.isArray(settings.bonusPoints) ? settings.bonusPoints : []),
    [settings.bonusPoints]
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<BonusPointEntry | null>(null);
  const [form, setForm] = useState<{ points: number | ''; note: string; date: string }>({ points: '', note: '', date: todayIso() });
  const [error, setError] = useState('');

  // نفس الحساب المستخدم في الداشبورد: النقط الإضافية جزء من المُحصَّل، والتوتال ثابت.
  const summary = useMemo(() => getPointsSummary(settings, subjects), [settings, subjects]);
  const totalBonus = summary ? summary.bonusPoints : entries.reduce((acc, entry) => acc + (Number(entry?.points) || 0), 0);
  const marksPoints = summary?.marksPoints ?? 0;
  const earnedPoints = summary?.points ?? totalBonus;
  const totalPoints = summary?.totalPoints ?? Number(settings.totalPoints || 0);

  const openAddForm = () => {
    setEditingId(null);
    setForm({ points: '', note: '', date: todayIso() });
    setError('');
    setIsFormOpen(true);
  };

  const openEditForm = (entry: BonusPointEntry) => {
    setEditingId(entry.id);
    setForm({ points: entry.points, note: entry.note || '', date: entry.date || todayIso() });
    setError('');
    setIsFormOpen(true);
  };

  const handleSave = () => {
    const points = Number(form.points);
    if (form.points === '' || !Number.isFinite(points) || points <= 0) {
      setError(isAr ? 'اكتب عدد النقط بشكل صحيح (أكبر من صفر).' : 'Enter a valid number of points (greater than zero).');
      return;
    }

    if (editingId) {
      updateSettings({
        bonusPoints: entries.map(entry => entry.id === editingId
          ? { ...entry, points, note: form.note.trim(), date: form.date || todayIso() }
          : entry)
      });
    } else {
      const newEntry: BonusPointEntry = {
        id: uuidv4(),
        points,
        note: form.note.trim(),
        date: form.date || todayIso(),
        createdAt: new Date().toISOString()
      };
      updateSettings({ bonusPoints: [...entries, newEntry] });
    }

    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleDelete = () => {
    if (!entryToDelete) return;
    updateSettings({ bonusPoints: entries.filter(entry => entry.id !== entryToDelete.id) });
    setEntryToDelete(null);
  };

  if (!isOpen) return null;

  const inputClass = "w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold";
  const labelClass = "block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5";

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
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                <Award size={20} />
              </div>
              <div>
                <h3 className="font-black text-base text-zinc-900 dark:text-white">
                  {isAr ? 'إضافة نقاط' : 'Add Points'}
                </h3>
                <p className="text-[11px] font-bold text-zinc-500">
                  {isAr ? 'نقط حصلت عليها خارج درجات المواد' : 'Points earned outside course marks'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Summary — النقط الإضافية بتزوّد المُحصَّل مش التوتال */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  {isAr ? 'مجموع النقط الإضافية' : 'Total extra points'}
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  +{totalBonus}
                </span>
              </div>
              <p className="text-[11px] font-bold text-emerald-700/80 dark:text-emerald-300/80 leading-relaxed">
                {isAr
                  ? `النقط دي بتتضاف على اللي حصلته (${marksPoints.toFixed(1)} نقطة من الدرجات) — التوتال الكلي بيفضل ${totalPoints || '--'} نقطة زي ما هو.`
                  : `These add to what you earned (${marksPoints.toFixed(1)} pts from marks) — your total stays ${totalPoints || '--'} points.`}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 pt-1 border-t border-emerald-200/70 dark:border-emerald-900/40">
                <TrendingUp size={12} />
                {isAr
                  ? `المُحصَّل بعد الإضافات: ${earnedPoints.toFixed(1)} من ${totalPoints || '--'} نقطة`
                  : `Earned with extras: ${earnedPoints.toFixed(1)} of ${totalPoints || '--'} points`}
              </div>
            </div>

            {isFormOpen ? (
              /* ── Add / edit form ── */
              <div className="space-y-4">
                <button
                  onClick={() => { setIsFormOpen(false); setEditingId(null); setError(''); }}
                  className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  {isAr ? '← رجوع للقائمة' : '← Back to list'}
                </button>

                <div>
                  <label className={labelClass}>{isAr ? 'عدد النقط' : 'Points'}</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    inputMode="decimal"
                    autoFocus
                    value={form.points === '' ? '' : form.points}
                    onChange={e => {
                      setError('');
                      setForm({ ...form, points: e.target.value === '' ? '' : Number(e.target.value) });
                    }}
                    placeholder={isAr ? 'مثال: 3' : 'e.g. 3'}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{isAr ? 'السبب (اختياري)' : 'Reason (optional)'}</label>
                  <input
                    type="text"
                    value={form.note}
                    onChange={e => setForm({ ...form, note: e.target.value })}
                    placeholder={isAr ? 'مثال: نقط بونص / نشاط / درجة خارجية' : 'e.g. bonus / activity / external mark'}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{isAr ? 'التاريخ' : 'Date'}</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className={inputClass}
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSave}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-colors cursor-pointer"
                >
                  {editingId ? (isAr ? 'حفظ التعديل' : 'Save changes') : (isAr ? 'إضافة النقط' : 'Add points')}
                </button>
              </div>
            ) : entries.length === 0 ? (
              /* ── Empty state ── */
              <div className="text-center py-8 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                  <Award size={26} />
                </div>
                <div className="space-y-1">
                  <p className="font-black text-sm text-zinc-800 dark:text-zinc-200">
                    {isAr ? 'مفيش نقط مضافة' : 'No extra points yet'}
                  </p>
                  <p className="text-[11px] font-bold text-zinc-500 max-w-xs mx-auto leading-relaxed">
                    {isAr
                      ? 'لو خدت نقط بونص أو نقط لدرجات خارجية مش جزء من درجات المواد، سجّلها هنا.'
                      : 'If you earned bonus points or points for external marks, record them here.'}
                  </p>
                </div>
                <button
                  onClick={openAddForm}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-colors cursor-pointer"
                >
                  <Plus size={16} /> {isAr ? 'إضافة نقاط' : 'Add points'}
                </button>
              </div>
            ) : (
              /* ── Entries list ── */
              <div className="space-y-3">
                <p className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">
                  {isAr ? `النقط اللي ضفتها (${entries.length})` : `Your added points (${entries.length})`}
                </p>

                {[...entries]
                  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
                  .map(entry => (
                    <div key={entry.id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-emerald-600 dark:text-emerald-400 text-lg leading-tight">
                          +{Number(entry.points) || 0} <span className="text-[11px] font-bold text-zinc-400">{isAr ? 'نقطة' : 'pts'}</span>
                        </p>
                        <p className="text-[11px] font-bold text-zinc-500 truncate flex items-center gap-1.5 mt-0.5">
                          <CalendarDays size={11} />
                          {formatDateLabel(entry.date, isAr)}
                          {entry.note ? <span className="text-zinc-400">• {entry.note}</span> : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditForm(entry)}
                          title={isAr ? 'تعديل' : 'Edit'}
                          className="p-2 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setEntryToDelete(entry)}
                          title={isAr ? 'حذف' : 'Delete'}
                          className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}

                <button
                  onClick={openAddForm}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-emerald-600 hover:border-emerald-300 dark:hover:border-emerald-800 font-black text-sm transition-colors cursor-pointer"
                >
                  <Plus size={16} /> {isAr ? 'إضافة نقاط' : 'Add points'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(entryToDelete)}
        title={isAr ? 'حذف النقط' : 'Delete points'}
        message={isAr
          ? `هتحذف ${Number(entryToDelete?.points) || 0} نقطة من إضافاتك. متأكد؟`
          : `Remove ${Number(entryToDelete?.points) || 0} points from your extras?`}
        confirmText={isAr ? 'حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        onConfirm={handleDelete}
        onCancel={() => setEntryToDelete(null)}
      />
    </>
  );
}