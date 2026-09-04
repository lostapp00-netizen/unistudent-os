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
  Download,
  Eye,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../lib/db';
import { FeedbackSuggestion } from '../../types';
import { formatDateTime } from '../../lib/utils';
import { ConfirmModal } from '../ui/CustomModal';

export function UserFeedbackSection() {
  const { t, i18n } = useTranslation();
  const { userId, userEmail, settings } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'suggestion' | 'complaint' | 'bug' | 'other'>('suggestion');
  const [attachments, setAttachments] = useState<{ id: string; name: string; size: number; type: string; url: string; b2FileId?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [myFeedbacks, setMyFeedbacks] = useState<FeedbackSuggestion[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showAllFeedbacks, setShowAllFeedbacks] = useState(false);

  // Edit State
  const [editingFeedback, setEditingFeedback] = useState<FeedbackSuggestion | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState<'suggestion' | 'complaint' | 'bug' | 'other'>('suggestion');
  const [editAttachments, setEditAttachments] = useState<any[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editUploading, setEditUploading] = useState(false);

  // Delete State
  const [feedbackToDelete, setFeedbackToDelete] = useState<FeedbackSuggestion | null>(null);

  // Accurate student email & name
  const savedEmail = userId ? localStorage.getItem(`unistudent_user_email_${userId}`) || '' : '';
  const currentEmail = userEmail || settings.email || savedEmail || '';
  const currentName = settings.name || (currentEmail ? currentEmail.split('@')[0] : (isAr ? 'طالب' : 'Student'));

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (isEditMode) setEditUploading(true);
    else setUploadingAttachment(true);

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage(isAr ? `الملف ${file.name} كبير جداً (الحد الأقصى 10 ميجابايت).` : `File ${file.name} is too large (max 10MB).`);
        continue;
      }

      const fileId = uuidv4();
      const b2Path = `feedback_${fileId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      let uploadedUrl = '';

      try {
        const { uploadToB2 } = await import('../../lib/backblaze');
        uploadedUrl = await uploadToB2(file, b2Path);
      } catch (uploadErr) {
        console.warn('Direct B2 upload fallback to base64:', uploadErr);
      }

      if (uploadedUrl) {
        const newAtt = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          url: uploadedUrl,
          b2FileId: b2Path
        };
        if (isEditMode) {
          setEditAttachments((prev) => [...prev, newAtt]);
        } else {
          setAttachments((prev) => [...prev, newAtt]);
        }
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Url = event.target?.result as string;
          const newAtt = {
            id: fileId,
            name: file.name,
            size: file.size,
            type: file.type,
            url: base64Url
          };
          if (isEditMode) {
            setEditAttachments((prev) => [...prev, newAtt]);
          } else {
            setAttachments((prev) => [...prev, newAtt]);
          }
        };
        reader.readAsDataURL(file);
      }
    }

    if (isEditMode) setEditUploading(false);
    else setUploadingAttachment(false);
    e.target.value = '';
  };

  const removeAttachment = async (id: string, isEditMode: boolean = false) => {
    const list = isEditMode ? editAttachments : attachments;
    const target = list.find((a) => a.id === id);
    if (target) {
      const key = (target as any).b2FileId || (target as any).b2_file_id || (target.url ? (await import('../../lib/backblaze')).extractB2KeyFromUrl(target.url) : null);
      if (key) {
        try {
          const { deleteFromB2 } = await import('../../lib/backblaze');
          await deleteFromB2(key);
        } catch (err) {
          console.error('Error deleting feedback attachment from B2:', err);
        }
      }
    }

    if (isEditMode) {
      setEditAttachments((prev) => prev.filter((a) => a.id !== id));
    } else {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    }
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
        userEmail: currentEmail || 'student@unistudent.com',
        userName: currentName,
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
      setSuccessMessage(isAr ? 'تم إرسال مقترحك/شكواك إلى الأدمن بنجاح! شكراً لمساهمتك في تحسين المنصة.' : 'Your feedback was sent to Admin successfully! Thank you.');
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'حدث خطأ أثناء الإرسال.' : 'Failed to send feedback.'));
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (fb: FeedbackSuggestion) => {
    setEditingFeedback(fb);
    setEditTitle(fb.title);
    setEditContent(fb.content);
    setEditType(fb.type);
    setEditAttachments(fb.attachments || []);
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingFeedback || !editTitle.trim() || !editContent.trim()) return;

    try {
      setSavingEdit(true);
      await db.updateFeedback(editingFeedback.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        type: editType,
        attachments: editAttachments
      });

      setMyFeedbacks((prev) =>
        prev.map((f) =>
          f.id === editingFeedback.id
            ? {
                ...f,
                title: editTitle.trim(),
                content: editContent.trim(),
                type: editType,
                attachments: editAttachments
              }
            : f
        )
      );

      setEditingFeedback(null);
      setSuccessMessage(isAr ? 'تم تعديل الشكوى/المقترح بنجاح.' : 'Feedback updated successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'حدث خطأ أثناء حفظ التعديل.' : 'Failed to update feedback.'));
    } finally {
      setSavingEdit(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!feedbackToDelete) return;
    try {
      await db.deleteFeedback(feedbackToDelete.id);
      setMyFeedbacks((prev) => prev.filter((f) => f.id !== feedbackToDelete.id));
      setFeedbackToDelete(null);
      setSuccessMessage(isAr ? 'تم حذف الشكوى بنجاح.' : 'Feedback deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      setErrorMessage(e.message || (isAr ? 'حدث خطأ أثناء الحذف.' : 'Failed to delete.'));
    }
  };

  const handlePreviewAttachment = async (att: any) => {
    try {
      const { previewFile } = await import('../../lib/backblaze');
      await previewFile(att);
    } catch (e) {
      if (att.url) window.open(att.url, '_blank');
      else alert(isAr ? 'تعذر معاينة الملف.' : 'Failed to preview file.');
    }
  };

  const handleDownloadAttachment = async (att: any) => {
    try {
      const { downloadFile } = await import('../../lib/backblaze');
      await downloadFile(att);
    } catch (e) {
      if (att.url) window.open(att.url, '_blank');
      else alert(isAr ? 'تعذر تنزيل الملف.' : 'Failed to download file.');
    }
  };

  const getStatusBadge = (status: FeedbackSuggestion['status']) => {
    switch (status) {
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={12} />
            {isAr ? 'تمت المعالجة والرد' : 'Resolved'}
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

  // Collapsible list logic: show first 3 by default
  const visibleFeedbacks = showAllFeedbacks ? myFeedbacks : myFeedbacks.slice(0, 3);
  const hiddenCount = myFeedbacks.length - 3;

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <MessageSquarePlus size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {isAr ? 'مقترحاتك وشكاواك للأدمن' : 'Your Suggestions & Feedback'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isAr 
                ? 'شاركنا أفكارك، مشاكلك، أو الميزات التي ترغب في إضافتها لتطوير المنصة ومتابعتها' 
                : 'Share ideas, report issues, or suggest new features to help improve the platform'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2 font-medium animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-2 font-medium animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Feedback Form */}
      <form onSubmit={handleSubmit} className="space-y-4 bg-zinc-50 dark:bg-zinc-800/40 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {isAr ? 'عنوان المقترح أو الشكوى' : 'Title'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isAr ? 'مثال: مشكلة في حساب درجات الفصل أو إضافة ميزة جديدة' : 'e.g., Issue with GPA calculation or feature request'}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {isAr ? 'نوع المشاركة / التصنيف' : 'Category'}
            </label>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'suggestion', label: isAr ? 'اقتراح' : 'Suggestion' },
                { id: 'complaint', label: isAr ? 'شكوى' : 'Complaint' },
                { id: 'bug', label: isAr ? 'عطل' : 'Bug' },
                { id: 'other', label: isAr ? 'أخرى' : 'Other' }
              ].map(cat => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setType(cat.id as any)}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    type === cat.id
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
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
              {uploadingAttachment ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
              <span>{uploadingAttachment ? (isAr ? 'جاري الرفع...' : 'Uploading...') : (isAr ? 'إرفاق ملف' : 'Attach File')}</span>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={(e) => handleFileUpload(e, false)}
                disabled={uploadingAttachment}
                className="hidden"
              />
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-medium shadow-2xs"
                >
                  {att.type?.startsWith('image/') ? <ImageIcon size={14} className="text-indigo-500" /> : <FileText size={14} className="text-indigo-500" />}
                  <span className="max-w-[150px] truncate text-zinc-800 dark:text-zinc-200">{att.name}</span>
                  <span className="text-[10px] text-zinc-400">({(att.size / 1024).toFixed(0)} KB)</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id, false)}
                    className="p-0.5 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                    title={isAr ? 'حذف' : 'Remove'}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 max-w-full min-w-0">
            <span className="shrink-0">{isAr ? 'المرسل:' : 'Sender:'}</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 shrink-0">{currentName}</span>
            {currentEmail && (
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium break-all truncate max-w-full">({currentEmail})</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            {loading ? <Clock className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
            <span>{isAr ? 'إرسال للأدمن' : 'Submit Feedback'}</span>
          </button>
        </div>
      </form>

      {/* Previously Submitted Feedbacks */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Inbox size={16} />
            <span>{isAr ? 'سجل مقترحاتك وشكاواك السابقة' : 'Your Previous Submissions'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
              {myFeedbacks.length}
            </span>
          </h3>

          {myFeedbacks.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllFeedbacks(!showAllFeedbacks)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{showAllFeedbacks ? (isAr ? 'طي القائمة (عرض الأحدث فقط)' : 'Show Less') : (isAr ? `عرض الكل (${myFeedbacks.length})` : 'Show All')}</span>
              {showAllFeedbacks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>

        {loadingList ? (
          <div className="text-center py-8 text-xs text-zinc-400 flex flex-col items-center gap-2">
            <Loader2 className="animate-spin w-5 h-5 text-indigo-500" />
            <span>{isAr ? 'جاري تحميل المقترحات...' : 'Loading submissions...'}</span>
          </div>
        ) : myFeedbacks.length > 0 ? (
          <div className="space-y-3">
            {visibleFeedbacks.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-50/90 dark:bg-zinc-800/40 p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 flex flex-col gap-3 transition-all hover:border-zinc-300 dark:hover:border-zinc-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{item.title}</span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold">
                      {getTypeLabel(item.type)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div>{getStatusBadge(item.status)}</div>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-600 transition-colors cursor-pointer"
                      title={isAr ? 'تعديل الشكوى' : 'Edit feedback'}
                    >
                      <Edit2 size={13} />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setFeedbackToDelete(item)}
                      className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700/80 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-zinc-600 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 border border-zinc-200 dark:border-zinc-600 transition-colors cursor-pointer"
                      title={isAr ? 'حذف الشكوى' : 'Delete feedback'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </p>

                {/* Status Specific Notification Banner */}
                {item.status === 'resolved' && (
                  <div className="p-3 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5 font-medium animate-in fade-in">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      {isAr 
                        ? `تم الرد على طلبك! برجاء مراجعة بريدك الإلكتروني (${item.userEmail || currentEmail}) للاطلاع على التفاصيل والرد.`
                        : `Your feedback has been resolved! Please check your email (${item.userEmail || currentEmail}) for details.`}
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

                {/* Attachments view with universal preview & download */}
                {item.attachments && item.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-2xs"
                      >
                        <Paperclip size={13} className="text-indigo-500" />
                        <span className="max-w-[130px] truncate">{att.name}</span>
                        <div className="flex items-center gap-1 mr-1 rtl:mr-0 rtl:ml-1">
                          <button
                            type="button"
                            onClick={() => handlePreviewAttachment(att)}
                            className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                            title={isAr ? 'معاينة' : 'Preview'}
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(att)}
                            className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors cursor-pointer"
                            title={isAr ? 'تنزيل' : 'Download'}
                          >
                            <Download size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/40">
                  <span>{formatDateTime(item.createdAt, isAr)}</span>
                  {item.adminNotes && (
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {isAr ? `ملاحظة الأدمن: ${item.adminNotes}` : `Admin note: ${item.adminNotes}`}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Expand / Collapse Button if more than 3 */}
            {myFeedbacks.length > 3 && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllFeedbacks(!showAllFeedbacks)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-all shadow-xs cursor-pointer"
                >
                  <span>
                    {showAllFeedbacks
                      ? (isAr ? 'طي الشكاوى القديمة (عرض الأحدث فقط)' : 'Collapse Older Submissions')
                      : (isAr ? `عرض باقي الشكاوى السابقة (${hiddenCount} إضافية)` : `View Older Submissions (${hiddenCount} more)`)}
                  </span>
                  {showAllFeedbacks ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
            {isAr ? 'لم تقم بإرسال أي مقترحات أو شكاوى بعد.' : 'No suggestions or complaints submitted yet.'}
          </div>
        )}
      </div>

      {/* --- EDIT COMPLAINT MODAL --- */}
      {editingFeedback && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-xl w-full border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Edit2 size={18} />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  {isAr ? 'تعديل الشكوى / المقترح' : 'Edit Feedback'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingFeedback(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'العنوان' : 'Title'}
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'التصنيف' : 'Category'}
                </label>
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'suggestion', label: isAr ? 'اقتراح' : 'Suggestion' },
                    { id: 'complaint', label: isAr ? 'شكوى' : 'Complaint' },
                    { id: 'bug', label: isAr ? 'عطل' : 'Bug' },
                    { id: 'other', label: isAr ? 'أخرى' : 'Other' }
                  ].map(cat => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setEditType(cat.id as any)}
                      className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        editType === cat.id
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'التفاصيل والشرح' : 'Details'}
                </label>
                <textarea
                  rows={4}
                  required
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Edit Attachments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Paperclip size={14} className="text-indigo-600" />
                    <span>{isAr ? 'المرفقات' : 'Attachments'}</span>
                  </label>
                  <label className="cursor-pointer px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1">
                    {editUploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                    <span>{editUploading ? (isAr ? 'جاري الرفع...' : 'Uploading...') : (isAr ? 'إضافة مرفق' : 'Add File')}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={(e) => handleFileUpload(e, true)}
                      disabled={editUploading}
                      className="hidden"
                    />
                  </label>
                </div>

                {editAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 max-h-32 overflow-y-auto">
                    {editAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium"
                      >
                        <FileText size={14} className="text-indigo-500" />
                        <span className="max-w-[140px] truncate text-zinc-800 dark:text-zinc-200">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id, true)}
                          className="p-0.5 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingFeedback(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit || !editTitle.trim() || !editContent.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>{isAr ? 'حفظ التعديلات' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!feedbackToDelete}
        title={isAr ? 'حذف الشكوى / المقترح' : 'Delete Feedback'}
        message={isAr ? `هل أنت متأكد من رغبتك في حذف الشكوى "${feedbackToDelete?.title}" نهائياً؟` : `Are you sure you want to delete "${feedbackToDelete?.title}"?`}
        confirmText={isAr ? 'نعم، حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setFeedbackToDelete(null)}
      />
    </section>
  );
}
