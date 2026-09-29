import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Megaphone, Send, Pencil, Trash2, Users, User, Clock, Eye, RefreshCw, Loader2, AlertCircle,
  CheckCircle2, BellRing, Database, Folder
} from 'lucide-react';
import { db } from '../../lib/db';
import { ConfirmModal } from '../ui/CustomModal';
import { useAppStore } from '../../store/useAppStore';
import type { StudentNotification } from '../../types';

type StudentOption = { id: string; name?: string; email?: string };

/**
 * المنشورات والرسائل العامة — two separate logs:
 *
 *  1) «سجل الرسائل والمنشورات العامة»: what the admin publishes himself (to
 *     everyone or to one student).
 *  2) «سجل رسائل التحديثات»: the notices that go out automatically whenever the
 *     database changes — an admin edit, or an approved change from the student
 *     the database was pulled from. They can be edited or deleted here too, and
 *     deleting one removes it from every linked student.
 *
 * Editing either kind keeps the SAME notification (no duplicate): the row is
 * updated and its read marks are cleared, so it comes back to students as a fresh
 * unread message.
 */
export function AdminPostsTab({ studentsList = [] }: { studentsList?: StudentOption[] }) {
  const { i18n } = useTranslation();
  const { settings } = useAppStore();
  const isAr = settings?.language === 'ar' || i18n.language === 'ar';

  const [activeLog, setActiveLog] = useState<'general' | 'database'>('general');
  const [posts, setPosts] = useState<StudentNotification[]>([]);
  const [updateNotices, setUpdateNotices] = useState<StudentNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [editingPost, setEditingPost] = useState<StudentNotification | null>(null);
  const [postToDelete, setPostToDelete] = useState<StudentNotification | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [general, database] = await Promise.all([
        db.getPostNotifications('general'),
        db.getPostNotifications('database')
      ]);
      setPosts(general);
      setUpdateNotices(database);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 4500);
    return () => clearTimeout(timer);
  }, [success]);

  const visibleLog = activeLog === 'general' ? posts : updateNotices;

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setTargetUserId('');
    setStudentQuery('');
    setEditingPost(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError(isAr ? 'اكتب عنوان الرسالة الأول.' : 'Please write a title.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingPost) {
        const result = await db.updatePostNotification(editingPost.id, { title, message });
        if (!result.ok) throw new Error(result.error || 'failed');
        setSuccess(editingPost.scope === 'database'
          ? (isAr
              ? 'تم تعديل رسالة التحديث — هتظهر للطلاب تاني كرسالة جديدة (من غير نسخة مكررة).'
              : 'Update notice edited — students see it again as a new unread message.')
          : (isAr
              ? 'تم تعديل الرسالة — هتظهر للطلاب كرسالة جديدة (من غير نسخة مكررة).'
              : 'Post updated — students see it as a fresh unread message.'));
      } else {
        const result = await db.createPostNotification({
          title,
          message,
          createdBy: 'admin',
          targetUserId: targetUserId || undefined
        });
        if (!result.ok) throw new Error(result.error || 'failed');
        setSuccess(targetUserId
          ? (isAr ? 'تم إرسال الرسالة للطالب.' : 'Message sent to the student.')
          : (isAr ? 'تم نشر الرسالة لكل الطلاب.' : 'Published to all students.'));
      }
      resetForm();
      await load();
    } catch (err: any) {
      setError(err?.message || (isAr ? 'تعذّر الحفظ — اتأكد إن migration الإشعارات متشغّل.' : 'Could not save.'));
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (notification: StudentNotification) => {
    setActiveLog(notification.scope === 'database' ? 'database' : 'general');
    setEditingPost(notification);
    setTitle(notification.title);
    setMessage(notification.message);
    setTargetUserId('');
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (!postToDelete) return;
    const wasUpdateNotice = postToDelete.scope === 'database';
    const result = await db.deletePostNotification(postToDelete.id);
    if (!result.ok) setError(result.error || 'failed');
    else setSuccess(wasUpdateNotice
      ? (isAr ? 'تم حذف رسالة التحديث — اختفت من عند كل الطلاب المربوطين.' : 'Update notice deleted for every student.')
      : (isAr ? 'تم حذف الرسالة — اختفت من عند الطلاب.' : 'Post deleted.'));
    setPostToDelete(null);
    await load();
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-US', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return value;
    }
  };

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return studentsList;
    return studentsList.filter(s =>
      (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
  }, [studentsList, studentQuery]);

  const selectedStudent = studentsList.find(s => s.id === targetUserId);

  const typeStyle = (type: string) => {
    switch (type) {
      case 'add': return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-800/50';
      case 'delete': return 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/70 dark:border-rose-800/50';
      case 'rename': return 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/70 dark:border-amber-800/50';
      case 'update': return 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/70 dark:border-blue-800/50';
      default: return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
    }
  };

  const logItem = (entry: StudentNotification) => {
    const isUpdateNotice = entry.scope === 'database';
    const audienceLabel = entry.audience === 'user'
      ? (studentsList.find(s => s.id === entry.userId)?.name || entry.userId || '')
      : (isAr ? 'كل الطلاب' : 'All students');
    const readers = entry.readers || 0;

    return (
      <li key={entry.id} className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 ${typeStyle(entry.type)}`}>
                {isUpdateNotice ? <Database size={13} /> : <Megaphone size={13} />}
              </span>
              <p className="text-sm font-black text-zinc-900 dark:text-white break-words">{entry.title}</p>
              {isUpdateNotice ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50">
                  <Database size={11} />
                  {entry.databaseLabel || (isAr ? 'قاعدة بيانات' : 'Database')}
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                  entry.audience === 'user'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/50'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50'
                }`}>
                  {entry.audience === 'user' ? <User size={11} /> : <Users size={11} />}
                  {audienceLabel}
                </span>
              )}
            </div>

            {entry.message && (
              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1.5 leading-relaxed break-words">{entry.message}</p>
            )}

            <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-400 font-bold flex-wrap">
              <span className="flex items-center gap-1"><Clock size={11} />{formatDate(entry.createdAt)}</span>
              {entry.updatedAt && entry.updatedAt !== entry.createdAt && (
                <span className="text-amber-600 dark:text-amber-400">
                  {isAr ? `آخر تعديل: ${formatDate(entry.updatedAt)}` : `edited ${formatDate(entry.updatedAt)}`}
                </span>
              )}
              {entry.audience !== 'user' && (
                <span className="flex items-center gap-1">
                  <Eye size={11} />{isAr ? `قرأها ${readers} طالب` : `${readers} read`}
                </span>
              )}
              {isUpdateNotice && (
                <span className="flex items-center gap-1">
                  <Folder size={11} />
                  {isAr ? 'اتبعتها تلقائيًا قاعدة البيانات' : 'automatic'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => startEdit(entry)}
              title={isAr ? 'تعديل الرسالة' : 'Edit'}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPostToDelete(entry)}
              title={isAr ? 'حذف الرسالة' : 'Delete'}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* السجلّين */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => { setActiveLog('general'); resetForm(); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-colors ${
            activeLog === 'general'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300'
          }`}
        >
          <Megaphone size={15} />
          <span>{isAr ? 'سجل الرسائل والمنشورات العامة' : 'Posts & messages log'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeLog === 'general' ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
          }`}>{posts.length}</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveLog('database'); resetForm(); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-colors ${
            activeLog === 'database'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300'
          }`}
        >
          <BellRing size={15} />
          <span>{isAr ? 'سجل رسائل التحديثات' : 'Database update notices'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeLog === 'database' ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
          }`}>{updateNotices.length}</span>
        </button>
      </div>

      {/* نموذج النشر — للسجل العام فقط */}
      {activeLog === 'general' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Megaphone size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                {editingPost ? (isAr ? 'تعديل منشور' : 'Edit post') : (isAr ? 'منشور / رسالة عامة جديدة' : 'New post / message')}
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {isAr
                  ? 'الرسالة بتظهر في جرس الإشعارات عند الطلاب. التعديل بيحدّث نفس الرسالة (مش نسخة جديدة) ويرجّعها unread عندهم.'
                  : 'Students see it in their notification bell. Editing keeps the same message (no duplicate) and marks it unread again.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-3 flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-600 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'عنوان الرسالة' : 'Title'}
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: تم تحديث درايف الكلية' : 'e.g. College drive updated'}
                  className="w-full border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-600 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'المرسل إليه' : 'Audience'}
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  disabled={!!editingPost}
                  className="w-full border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                >
                  <option value="">{isAr ? 'كل الطلاب' : 'All students'}</option>
                  {filteredStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name || s.email || s.id}</option>
                  ))}
                </select>
                {editingPost && (
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {isAr ? 'المرسل إليه ما بيتغيّرش بعد النشر.' : 'Audience cannot change after publishing.'}
                  </p>
                )}
              </div>
            </div>

            {studentsList.length > 8 && !editingPost && (
              <div>
                <label className="block text-[11px] font-black text-zinc-600 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'ابحث عن طالب (لو عايز تبعت لطالب واحد)' : 'Search a student'}
                </label>
                <input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder={isAr ? 'اسم الطالب أو الإيميل…' : 'Student name or email…'}
                  className="w-full border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-black text-zinc-600 dark:text-zinc-300 mb-1.5">
                {isAr ? 'نص الرسالة' : 'Message'}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder={isAr ? 'اكتب المعلومة اللي عايز توصلها للطلاب…' : 'Write the message…'}
                className="w-full border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-colors"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : (editingPost ? <Pencil size={15} /> : <Send size={15} />)}
                <span>{editingPost ? (isAr ? 'حفظ التعديل' : 'Save changes') : (isAr ? 'نشر الرسالة' : 'Publish')}</span>
              </button>
              {(editingPost || title || message) && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              )}
              {selectedStudent && !editingPost && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  <User size={13} />
                  {selectedStudent.name || selectedStudent.email}
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* تعديل رسالة تحديث */}
      {activeLog === 'database' && editingPost && (
        <div className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/60 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Pencil size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-white">
                {isAr ? 'تعديل رسالة تحديث' : 'Edit an update notice'}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                {isAr
                  ? `الرسالة دي اتبعتت تلقائي لطلاب (${editingPost.databaseLabel || 'قاعدة بيانات'}). بعد الحفظ هتظهر لهم تاني كرسالة جديدة unread.`
                  : 'Students of this database see it again as a new unread message after saving.'}
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
            <div className="flex items-center gap-2.5">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md shadow-amber-500/20 transition-colors"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
                <span>{isAr ? 'حفظ التعديل' : 'Save changes'}</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && activeLog === 'database' && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">{error}</p>
        </div>
      )}
      {success && activeLog === 'database' && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-3 flex items-start gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{success}</p>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
              {activeLog === 'general'
                ? (isAr ? 'سجل الرسائل والمنشورات العامة' : 'Posts & messages log')
                : (isAr ? 'سجل رسائل التحديثات' : 'Database update notices log')}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              {activeLog === 'general'
                ? (isAr ? `${posts.length} رسالة منشورة` : `${posts.length} posts`)
                : (isAr
                    ? `${updateNotices.length} رسالة اتبعتت تلقائيًا لما حصل تغيير في قاعدة البيانات — تقدر تعدّلها أو تمسحها وهتختفي فورًا من عند كل الطلاب المربوطين.`
                    : `${updateNotices.length} notices sent automatically on database changes.`)}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>

        {isLoading && visibleLog.length === 0 ? (
          <p className="p-8 text-center text-xs text-zinc-400">{isAr ? 'جاري التحميل…' : 'Loading…'}</p>
        ) : visibleLog.length === 0 ? (
          <div className="p-10 text-center text-zinc-400">
            {activeLog === 'general'
              ? <Megaphone size={44} className="mx-auto mb-3 opacity-25" />
              : <BellRing size={44} className="mx-auto mb-3 opacity-25" />}
            <p className="text-xs font-bold">
              {activeLog === 'general'
                ? (isAr ? 'لسه مفيش منشورات' : 'Nothing published yet')
                : (isAr ? 'لسه مفيش رسائل تحديثات' : 'No update notices yet')}
            </p>
            <p className="text-[11px] mt-1">
              {activeLog === 'general'
                ? (isAr ? 'أول رسالة تنشرها هتظهر هنا وفي جرس الطلاب.' : "Your first post will show here and in the students' bell.")
                : (isAr
                    ? 'لما توافق على تحديث من الطالب المصدر، أو تعدّل/تحذف/تنقل حاجة في قاعدة البيانات بنفسك، الرسالة اللي بتوصل الطلاب بتتسجل هنا.'
                    : 'Approving a change — or editing the database yourself — logs the notice students received right here.')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">{visibleLog.map(logItem)}</ul>
        )}
      </div>

      <ConfirmModal
        isOpen={!!postToDelete}
        title={postToDelete?.scope === 'database'
          ? (isAr ? 'حذف رسالة تحديث' : 'Delete update notice')
          : (isAr ? 'حذف الرسالة' : 'Delete post')}
        message={postToDelete?.scope === 'database'
          ? (isAr
              ? `هل أنت متأكد من حذف «${postToDelete?.title || ''}»؟ الرسالة دي وصلت لكل الطلاب المربوطين بالقاعدة (${postToDelete?.databaseLabel || ''}) وهتختفي فورًا من عندهم.`
              : 'This notice went to every student of that database and will disappear from their bell.')
          : (isAr
              ? `هل أنت متأكد من حذف «${postToDelete?.title || ''}»؟ هتختفي فورًا من جرس إشعارات الطلاب.`
              : `Delete "${postToDelete?.title || ''}"? It disappears from every student's bell.`)}
        confirmText={isAr ? 'نعم، احذف' : 'Yes, delete'}
        cancelText={isAr ? 'تراجع' : 'Cancel'}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setPostToDelete(null)}
      />
    </div>
  );
}
