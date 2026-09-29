import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Megaphone, Send, Pencil, Trash2, Users, User, Clock, Eye, RefreshCw, Loader2, AlertCircle, CheckCircle2
} from 'lucide-react';
import { db } from '../../lib/db';
import { ConfirmModal } from '../ui/CustomModal';
import { useAppStore } from '../../store/useAppStore';
import type { StudentNotification } from '../../types';

type StudentOption = { id: string; name?: string; email?: string };

/**
 * المنشورات والرسائل العامة — the admin publishes a message that shows up in
 * every student's notification bell (or to one chosen student).
 *
 * Editing a post does NOT publish a second copy: the same notification is
 * updated and its "read" marks are cleared, so it comes back to students as a
 * fresh unread message instead of a duplicate.
 */
export function AdminPostsTab({ studentsList = [] }: { studentsList?: StudentOption[] }) {
  const { i18n } = useTranslation();
  const { settings } = useAppStore();
  const isAr = settings?.language === 'ar' || i18n.language === 'ar';

  const [posts, setPosts] = useState<StudentNotification[]>([]);
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
      setPosts(await db.getPostNotifications());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [success]);

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
        setSuccess(isAr
          ? 'تم تعديل الرسالة — هتظهر للطلاب كرسالة جديدة (من غير نسخة مكررة).'
          : 'Post updated — students will see it as a fresh unread message.');
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

  const startEdit = (post: StudentNotification) => {
    setEditingPost(post);
    setTitle(post.title);
    setMessage(post.message);
    setTargetUserId('');
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (!postToDelete) return;
    const result = await db.deletePostNotification(postToDelete.id);
    if (!result.ok) setError(result.error || 'failed');
    else setSuccess(isAr ? 'تم حذف الرسالة — اختفت من عند الطلاب.' : 'Post deleted.');
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

  const filteredStudents = studentQuery.trim()
    ? studentsList.filter(s =>
        (s.name || '').toLowerCase().includes(studentQuery.trim().toLowerCase()) ||
        (s.email || '').toLowerCase().includes(studentQuery.trim().toLowerCase()))
    : studentsList;

  const selectedStudent = studentsList.find(s => s.id === targetUserId);

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Megaphone size={22} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
              {editingPost
                ? (isAr ? 'تعديل منشور' : 'Edit post')
                : (isAr ? 'منشور / رسالة عامة جديدة' : 'New post / message')}
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {isAr
                ? 'الرسالة بتظهر في جرس الإشعارات عند الطلاب. التعديل بعد النشر بيحدّث نفس الرسالة (مش نسخة جديدة) ويرجّعها unread عندهم.'
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
                {studentsList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.email || s.id}
                  </option>
                ))}
              </select>
              {editingPost && (
                <p className="text-[10px] text-zinc-400 mt-1">
                  {isAr ? 'المرسل إليه ما بيتغيّرش بعد النشر.' : 'Audience cannot change after publishing.'}
                </p>
              )}
            </div>
          </div>

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

          <div className="flex items-center gap-2.5">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-colors"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : (editingPost ? <Pencil size={15} /> : <Send size={15} />)}
              <span>
                {editingPost
                  ? (isAr ? 'حفظ التعديل' : 'Save changes')
                  : (isAr ? 'نشر الرسالة' : 'Publish')}
              </span>
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

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
              {isAr ? 'سجل المنشورات' : 'Published log'}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              {isAr ? `${posts.length} رسالة منشورة` : `${posts.length} posts`}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>

        {isLoading && posts.length === 0 ? (
          <p className="p-8 text-center text-xs text-zinc-400">{isAr ? 'جاري التحميل…' : 'Loading…'}</p>
        ) : posts.length === 0 ? (
          <div className="p-10 text-center text-zinc-400">
            <Megaphone size={44} className="mx-auto mb-3 opacity-25" />
            <p className="text-xs font-bold">{isAr ? 'لسه مفيش منشورات' : 'Nothing published yet'}</p>
            <p className="text-[11px] mt-1">{isAr ? 'أول رسالة تنشرها هتظهر هنا وفي جرس الطلاب.' : 'Your first post will show here and in the students\' bell.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {posts.map(post => {
              const readerCount = post.readers || 0;
              const audienceLabel = post.audience === 'user'
                ? (studentsList.find(s => s.id === post.userId)?.name || post.userId || '')
                : (isAr ? 'كل الطلاب' : 'All students');
              return (
                <li key={post.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-zinc-900 dark:text-white break-words">{post.title}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          post.audience === 'user'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/50'
                            : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50'
                        }`}>
                          {post.audience === 'user' ? <User size={11} /> : <Users size={11} />}
                          {audienceLabel}
                        </span>
                      </div>
                      {post.message && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1.5 leading-relaxed break-words">{post.message}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-400 font-bold">
                        <span className="flex items-center gap-1"><Clock size={11} />{formatDate(post.createdAt)}</span>
                        {post.updatedAt && post.updatedAt !== post.createdAt && (
                          <span>{isAr ? `آخر تعديل: ${formatDate(post.updatedAt)}` : `edited ${formatDate(post.updatedAt)}`}</span>
                        )}
                        {post.audience !== 'user' && (
                          <span className="flex items-center gap-1"><Eye size={11} />{isAr ? `قرأها ${readerCount} طالب` : `${readerCount} read`}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(post)}
                        title={isAr ? 'تعديل الرسالة' : 'Edit'}
                        className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPostToDelete(post)}
                        title={isAr ? 'حذف الرسالة' : 'Delete'}
                        className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmModal
        isOpen={!!postToDelete}
        title={isAr ? 'حذف الرسالة' : 'Delete post'}
        message={isAr
          ? `هل أنت متأكد من حذف «${postToDelete?.title || ''}»؟ هتختفي فوراً من جرس إشعارات الطلاب.`
          : `Delete "${postToDelete?.title || ''}"? It disappears from every student's bell.`}
        confirmText={isAr ? 'نعم، احذف' : 'Yes, delete'}
        cancelText={isAr ? 'تراجع' : 'Cancel'}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setPostToDelete(null)}
      />
    </div>
  );
}
