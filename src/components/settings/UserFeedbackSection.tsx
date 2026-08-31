import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { 
  MessageSquarePlus, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  Inbox, 
  Paperclip, 
  X, 
  FileText, 
  Image as ImageIcon,
  Download
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../lib/db';
import { FeedbackSuggestion } from '../../types';
import { formatDateTime } from '../../lib/utils';

export function UserFeedbackSection() {
  const { t, i18n } = useTranslation();
  const { userId, userEmail, settings } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'suggestion' | 'complaint' | 'bug' | 'other'>('suggestion');
  const [attachments, setAttachments] = useState<{ id: string; name: string; size: number; type: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [myFeedbacks, setMyFeedbacks] = useState<FeedbackSuggestion[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadFeedbacks = async () => {
    if (!userId) return;
    try {
      setLoadingList(true);
      const list = await db.getUserFeedbacks(userId);
      setMyFeedbacks(list);
    } catch (e) {
      console.error('Error loading feedbacks:', e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, [userId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage(isAr ? `الملف ${file.name} كبير جداً (الحد الأقصى 10 ميجابايت).` : `File ${file.name} is too large (max 10MB).`);
        continue;
      }

      const fileId = uuidv4();
      let uploadedUrl = '';

      try {
        const { uploadToB2 } = await import('../../lib/backblaze');
        const b2Path = `feedback_${fileId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        uploadedUrl = await uploadToB2(file, b2Path);
      } catch (uploadErr) {
        console.warn('Direct B2 upload fallback to base64:', uploadErr);
      }

      if (uploadedUrl) {
        setAttachments((prev) => [
          ...prev,
          {
            id: fileId,
            name: file.name,
            size: file.size,
            type: file.type,
            url: uploadedUrl
          }
        ]);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Url = event.target?.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              id: fileId,
              name: file.name,
              size: file.size,
              type: file.type,
              url: base64Url
            }
          ]);
        };
        reader.readAsDataURL(file);
      }
    }

    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!title.trim() || !content.trim()) {
      setErrorMessage(isAr ? 'يرجى إدخال عنوان المقترح والتفاصيل.' : 'Please enter title and details.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const feedback: FeedbackSuggestion = {
        id: uuidv4(),
        userId,
        userEmail: userEmail || settings.email || 'student@unistudent.com',
        userName: settings.name || 'Student',
        type,
        title: title.trim(),
        content: content.trim(),
        attachments,
        createdAt: new Date().toISOString(),
        status: 'new'
      };

      await db.addFeedback(feedback);
      setMyFeedbacks((prev) => [feedback, ...prev]);
      setTitle('');
      setContent('');
      setType('suggestion');
      setAttachments([]);
      setSuccessMessage(isAr ? 'تم إرسال مقترحك إلى الأدمن بنجاح! شكراً لمساهمتك في تحسين المنصة.' : 'Your feedback was sent to Admin successfully! Thank you.');
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'حدث خطأ أثناء الإرسال.' : 'Failed to send feedback.'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: FeedbackSuggestion['status']) => {
    switch (status) {
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={12} />
            {isAr ? 'تمت المعالجة والحل' : 'Resolved'}
          </span>
        );
      case 'reviewed':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 px-2.5 py-1 rounded-full">
            <Clock size={12} />
            {isAr ? 'قيد المراجعة' : 'Under Review'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1 rounded-full">
            <Sparkles size={12} />
            {isAr ? 'جديد ومستلم' : 'Received'}
          </span>
        );
    }
  };

  const getTypeLabel = (t: FeedbackSuggestion['type']) => {
    switch (t) {
      case 'complaint':
        return isAr ? 'شكوى' : 'Complaint';
      case 'bug':
        return isAr ? 'إبلاغ عن خطأ تقني' : 'Bug Report';
      case 'other':
        return isAr ? 'أخرى' : 'Other';
      default:
        return isAr ? 'اقتراح وتطوير' : 'Suggestion';
    }
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <MessageSquarePlus size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {isAr ? 'مقترحاتك وملاحظاتك للأدمن' : 'Your Suggestions & Feedback'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isAr 
                ? 'شاركنا أفكارك، مشاكلك، أو الميزات التي ترغب في إضافتها لتطوير المنصة' 
                : 'Share ideas, report issues, or suggest new features to help improve the platform'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-2 font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Feedback Form */}
      <form onSubmit={handleSubmit} className="space-y-4 bg-zinc-50 dark:bg-zinc-800/40 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {isAr ? 'عنوان المقترح أو الملاحظة' : 'Title'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isAr ? 'مثال: إضافة ميزة تصدير الجدول إلى PDF' : 'e.g., Export schedule to PDF'}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {isAr ? 'نوع المشاركة' : 'Category'}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="suggestion">{isAr ? 'اقتراح ميزة' : 'Feature Suggestion'}</option>
              <option value="complaint">{isAr ? 'شكوى / مشكلة' : 'Complaint'}</option>
              <option value="bug">{isAr ? 'إبلاغ عن خطأ تقني' : 'Bug Report'}</option>
              <option value="other">{isAr ? 'عام / أخرى' : 'Other'}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
            {isAr ? 'التفاصيل والشرح' : 'Details'}
          </label>
          <textarea
            required
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={isAr ? 'اكتب تفاصيل مقترحك أو وصف المشكلة بدقة...' : 'Explain your idea or problem in detail...'}
            className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Attachments Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Paperclip size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>{isAr ? 'المرفقات (صور، لقطات شاشة، أو ملفات PDF)' : 'Attachments (Images, screenshots, PDF)'}</span>
            </label>
            <label className="cursor-pointer px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1">
              <Paperclip size={12} />
              <span>{isAr ? 'إرفاق ملف' : 'Attach File'}</span>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-medium"
                >
                  {att.type.startsWith('image/') ? <ImageIcon size={14} className="text-indigo-500" /> : <FileText size={14} className="text-indigo-500" />}
                  <span className="max-w-[150px] truncate text-zinc-800 dark:text-zinc-200">{att.name}</span>
                  <span className="text-[10px] text-zinc-400">({(att.size / 1024).toFixed(0)} KB)</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="p-0.5 text-zinc-400 hover:text-rose-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-zinc-400">
            {isAr ? `سيتم إرسال المقترح باسمك (${settings.name || 'طالب'}) وبريدك الإلكتروني.` : 'Will be sent with your name and email.'}
          </span>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
          >
            {loading ? <Clock className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
            <span>{isAr ? 'إرسال للأدمن' : 'Submit Feedback'}</span>
          </button>
        </div>
      </form>

      {/* Previously Submitted Feedbacks */}
      <div className="space-y-3 pt-2">
        <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Inbox size={16} />
          <span>{isAr ? 'سجل مقترحاتك السابقة' : 'Your Previous Submissions'}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {myFeedbacks.length}
          </span>
        </h3>

        {loadingList ? (
          <div className="text-center py-6 text-xs text-zinc-400">{isAr ? 'جاري تحميل المقترحات...' : 'Loading submissions...'}</div>
        ) : myFeedbacks.length > 0 ? (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {myFeedbacks.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-50/80 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{item.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium">
                      {getTypeLabel(item.type)}
                    </span>
                  </div>
                  <div>{getStatusBadge(item.status)}</div>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </p>

                {/* Status Specific Notification Banner */}
                {item.status === 'resolved' && (
                  <div className="p-3 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5 font-medium animate-in fade-in">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      {isAr 
                        ? `تم الرد على شكوتك/طلبك! برجاء مراجعة بريدك الإلكتروني (${item.userEmail || settings.email}) للاطلاع على التفاصيل والرد.`
                        : `Your feedback has been resolved! Please check your email (${item.userEmail || settings.email}) for details.`}
                    </span>
                  </div>
                )}

                {item.status === 'reviewed' && (
                  <div className="p-2.5 bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 rounded-xl text-blue-800 dark:text-blue-200 text-xs flex items-center gap-2 font-medium">
                    <Clock size={15} className="text-blue-600 shrink-0" />
                    <span>
                      {isAr 
                        ? 'طلبك قيد المراجعة والمتابعة حالياً من قبل الإدارة.'
                        : 'Your feedback is currently under review by the admin team.'}
                    </span>
                  </div>
                )}

                {/* Attachments view */}
                {item.attachments && item.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.url}
                        download={att.name}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-all"
                      >
                        <Paperclip size={12} />
                        <span className="max-w-[120px] truncate">{att.name}</span>
                        <Download size={10} className="text-zinc-400" />
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/40">
                  <span>{formatDateTime(item.createdAt, isAr)}</span>
                  {item.adminNotes && (
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {isAr ? `ملاحظة الأدمن: ${item.adminNotes}` : `Admin note: ${item.adminNotes}`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            {isAr ? 'لم تقم بإرسال أي مقترحات بعد.' : 'No suggestions submitted yet.'}
          </div>
        )}
      </div>
    </section>
  );
}
