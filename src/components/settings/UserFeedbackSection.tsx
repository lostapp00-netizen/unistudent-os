import React, { useState, useEffect, useRef } from 'react';
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
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldCheck,
  User,
  MessageCircle,
  HelpCircle,
  Bug,
  Lightbulb,
  CheckCheck,
  Lock,
  ArrowDownCircle,
  CornerDownLeft
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { db, subscribeToFeedbackUpdates } from '../../lib/db';
import { FeedbackSuggestion, FeedbackMessage } from '../../types';
import { formatDateTime } from '../../lib/utils';
import { ConfirmModal } from '../ui/CustomModal';

export function UserFeedbackSection() {
  const { t, i18n } = useTranslation();
  const { userId, userEmail, settings } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';

  // Form State (New Ticket)
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<FeedbackSuggestion['type']>('suggestion');
  const [attachments, setAttachments] = useState<{ id: string; name: string; size: number; type: string; url: string; b2FileId?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Feedbacks List
  const [myFeedbacks, setMyFeedbacks] = useState<FeedbackSuggestion[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Active Chat State
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<{ id: string; name: string; size: number; type: string; url: string; b2FileId?: string }[]>([]);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyUploading, setReplyUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Modals
  const [closingChat, setClosingChat] = useState<FeedbackSuggestion | null>(null);
  const [feedbackToDelete, setFeedbackToDelete] = useState<FeedbackSuggestion | null>(null);

  // Expanded Closed Conversations Accordion (Set of IDs)
  const [expandedClosedIds, setExpandedClosedIds] = useState<Record<string, boolean>>({});

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

  // Real-time listener for support chat updates
  useEffect(() => {
    const unsubscribe = subscribeToFeedbackUpdates((payload) => {
      if (!payload || !payload.feedbackId) return;

      if (payload.action === 'new_message' && payload.message) {
        setMyFeedbacks((prev) =>
          prev.map((fb) => {
            if (fb.id === payload.feedbackId) {
              const currentMsgs = fb.messages || [];
              const exists = currentMsgs.some((m) => m.id === payload.message.id);
              if (exists) return fb;
              return {
                ...fb,
                messages: [...currentMsgs, payload.message],
                status: payload.message.sender === 'admin' && fb.status === 'new' ? 'reviewed' : fb.status
              };
            }
            return fb;
          })
        );
      } else if (payload.action === 'closed') {
        setMyFeedbacks((prev) =>
          prev.map((fb) =>
            fb.id === payload.feedbackId
              ? {
                  ...fb,
                  status: 'resolved',
                  closedAt: payload.closedAt || new Date().toISOString(),
                  closedBy: payload.closedBy || 'admin'
                }
              : fb
          )
        );
      } else if (payload.action === 'reopened') {
        setMyFeedbacks((prev) =>
          prev.map((fb) =>
            fb.id === payload.feedbackId
              ? { ...fb, status: 'reviewed', closedAt: undefined, closedBy: undefined }
              : fb
          )
        );
      } else {
        loadFeedbacks();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  // Active chat is the first non-resolved feedback
  const activeChat = myFeedbacks.find((f) => f.status !== 'resolved');
  const closedFeedbacks = myFeedbacks.filter((f) => f.status === 'resolved');

  // Auto scroll chat to bottom when active chat messages change
  useEffect(() => {
    if (activeChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat?.messages?.length, activeChat?.id]);

  // File upload handler
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isReply: boolean = false
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (isReply) setReplyUploading(true);
    else setUploadingAttachment(true);

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage(
          isAr
            ? `الملف ${file.name} كبير جداً (الحد الأقصى 10 ميجابايت).`
            : `File ${file.name} is too large (max 10MB).`
        );
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
        if (isReply) {
          setReplyAttachments((prev) => [...prev, newAtt]);
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
          if (isReply) {
            setReplyAttachments((prev) => [...prev, newAtt]);
          } else {
            setAttachments((prev) => [...prev, newAtt]);
          }
        };
        reader.readAsDataURL(file);
      }
    }

    if (isReply) setReplyUploading(false);
    else setUploadingAttachment(false);
    e.target.value = '';
  };

  const removeAttachment = async (id: string, isReply: boolean = false) => {
    const list = isReply ? replyAttachments : attachments;
    const target = list.find((a) => a.id === id);
    if (target) {
      const key =
        (target as any).b2FileId ||
        (target as any).b2_file_id ||
        (target.url ? (await import('../../lib/backblaze')).extractB2KeyFromUrl(target.url) : null);
      if (key) {
        try {
          const { deleteFromB2 } = await import('../../lib/backblaze');
          await deleteFromB2(key);
        } catch (err) {
          console.error('Error deleting attachment from B2:', err);
        }
      }
    }

    if (isReply) {
      setReplyAttachments((prev) => prev.filter((a) => a.id !== id));
    } else {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  // Create New Feedback / Conversation
  const handleSubmitNewFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!title.trim() || !content.trim()) {
      setErrorMessage(isAr ? 'يرجى إدخال عنوان المحادثة والتفاصيل.' : 'Please enter title and details.');
      return;
    }

    if (activeChat) {
      setErrorMessage(
        isAr
          ? 'لديك محادثة نشطة بالفعل. يرجى إنهاء المحادثة الحالية قبل إنشاء محادثة جديدة.'
          : 'You already have an active conversation. Please finish it before creating a new one.'
      );
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const newFeedback: FeedbackSuggestion = {
        id: uuidv4(),
        userId,
        userEmail: currentEmail || '',
        userName: currentName,
        type,
        title: title.trim(),
        content: content.trim(),
        attachments,
        createdAt: new Date().toISOString(),
        status: 'new',
        messages: []
      };

      await db.addFeedback(newFeedback);
      setMyFeedbacks((prev) => [newFeedback, ...prev]);
      setTitle('');
      setContent('');
      setType('suggestion');
      setAttachments([]);
      setSuccessMessage(
        isAr
          ? 'تم إنشاء المحادثة وبدء الشات بنجاح! سيتم الرد عليك خلال 24 ساعة بمشيئة الله.'
          : 'Conversation created successfully! We will reply within 24 hours.'
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'حدث خطأ أثناء الإرسال.' : 'Failed to send feedback.'));
    } finally {
      setLoading(false);
    }
  };

  // Student sends reply in active chat
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || (!replyText.trim() && replyAttachments.length === 0)) return;

    try {
      setSendingReply(true);
      const newMsg: FeedbackMessage = {
        id: uuidv4(),
        sender: 'student',
        senderName: currentName,
        senderEmail: currentEmail,
        content: replyText.trim(),
        attachments: replyAttachments,
        createdAt: new Date().toISOString()
      };

      const currentFeedbackId = activeChat.id;
      setReplyText('');
      setReplyAttachments([]);

      // Optimistic update
      setMyFeedbacks((prev) =>
        prev.map((fb) =>
          fb.id === currentFeedbackId
            ? { ...fb, messages: [...(fb.messages || []), newMsg] }
            : fb
        )
      );

      await db.addFeedbackMessage(currentFeedbackId, newMsg);
    } catch (err: any) {
      console.error('Error sending reply:', err);
      setErrorMessage(isAr ? 'حدث خطأ أثناء إرسال الرسالة.' : 'Failed to send message.');
    } finally {
      setSendingReply(false);
    }
  };

  // Close / End Active Conversation
  const handleConfirmCloseChat = async () => {
    if (!closingChat) return;
    try {
      const targetId = closingChat.id;
      const closedAt = new Date().toISOString();

      setMyFeedbacks((prev) =>
        prev.map((fb) =>
          fb.id === targetId
            ? { ...fb, status: 'resolved', closedAt, closedBy: 'student' }
            : fb
        )
      );

      await db.closeFeedbackConversation(targetId, 'student');
      setClosingChat(null);
      setSuccessMessage(
        isAr
          ? 'تم إنهاء المحادثة وإغلاق التذكرة بنجاح. تم نقلها إلى سجل المحادثات المنتهية.'
          : 'Conversation finished and moved to closed archive.'
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(isAr ? 'حدث خطأ أثناء إنهاء المحادثة.' : 'Failed to end conversation.');
    }
  };

  // Delete Feedback from user archive
  const handleConfirmDelete = async () => {
    if (!feedbackToDelete) return;
    try {
      await db.deleteFeedback(feedbackToDelete.id);
      setMyFeedbacks((prev) => prev.filter((f) => f.id !== feedbackToDelete.id));
      setFeedbackToDelete(null);
      setSuccessMessage(isAr ? 'تم حذف المحادثة بنجاح.' : 'Feedback deleted successfully.');
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

  const toggleExpandClosed = (id: string) => {
    setExpandedClosedIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getTypeBadge = (t: FeedbackSuggestion['type']) => {
    switch (t) {
      case 'complaint':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle size={12} />
            {isAr ? 'شكوى' : 'Complaint'}
          </span>
        );
      case 'bug':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
            <Bug size={12} />
            {isAr ? 'عطل تقني' : 'Bug Report'}
          </span>
        );
      case 'inquiry':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/50">
            <HelpCircle size={12} />
            {isAr ? 'استفسار ومساعدة' : 'Inquiry'}
          </span>
        );
      case 'other':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <MessageCircle size={12} />
            {isAr ? 'أخرى' : 'Other'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50">
            <Lightbulb size={12} />
            {isAr ? 'اقتراح وتطوير' : 'Suggestion'}
          </span>
        );
    }
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl shadow-xs border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 lg:p-7 space-y-6">
      
      {/* --- SECTION HEADER & 24H GUARANTEE BANNER --- */}
      <div className="space-y-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20 shrink-0">
              <MessageSquarePlus size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg lg:text-xl font-black text-zinc-900 dark:text-white">
                  {isAr ? 'محادثات الدعم والشكاوى والاقتراحات' : 'Support & Feedback Hub'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  LIVE CHAT
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isAr
                  ? 'تواصل مباشر وتفاعلي مع إدارة منصة UniStudent OS لمتابعة استفساراتك وشكاواك لحظة بلحظة'
                  : 'Direct interactive communication with UniStudent OS Administration'}
              </p>
            </div>
          </div>
        </div>

        {/* 24h Reply Guarantee Banner */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/80 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 text-blue-900 dark:text-blue-200 font-bold">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 animate-pulse" />
            <span>
              {isAr
                ? '⚡ الرد خلال 24 ساعة بمشيئة الله — يتم مراجعة جميع المحادثات والرد مباشرة داخل الموقع.'
                : '⚡ Replies guaranteed within 24 hours — All inquiries are answered directly inside the website.'}
            </span>
          </div>
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-blue-100/80 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
            <ShieldCheck size={14} />
            {isAr ? 'دعم فني مباشر' : 'Official Support'}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center gap-2 font-medium animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2 font-medium animate-in fade-in">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ACTIVE CHAT VIEW (When student has an ongoing active conversation)     */}
      {/* ========================================================================= */}
      {activeChat ? (
        <div className="space-y-4 bg-zinc-50/90 dark:bg-zinc-800/40 p-4 sm:p-6 rounded-3xl border-2 border-indigo-500/30 dark:border-indigo-500/20 shadow-sm relative">
          
          {/* Active Chat Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200/80 dark:border-zinc-700/60">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {isAr ? 'محادثة نشطة حالياً' : 'Active Conversation'}
                </span>
                {getTypeBadge(activeChat.type)}
                <span className="text-xs text-zinc-400 font-medium">
                  {formatDateTime(activeChat.createdAt, isAr)}
                </span>
              </div>

              <h3 className="font-black text-base sm:text-lg text-zinc-900 dark:text-white truncate">
                {activeChat.title}
              </h3>
            </div>

            {/* End Conversation Button */}
            <button
              type="button"
              onClick={() => setClosingChat(activeChat)}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800/60 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs shrink-0 self-start sm:self-auto"
            >
              <Lock size={14} />
              <span>{isAr ? 'إنهاء المحادثة وإغلاقها' : 'End Conversation'}</span>
            </button>
          </div>

          {/* Original Problem / Issue Card */}
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                <User size={13} className="text-indigo-600" />
                <span>{isAr ? 'نص المشكلة / الطلب الأساسي من قبلك:' : 'Initial inquiry description:'}</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {activeChat.content}
            </p>

            {/* Initial Attachments */}
            {activeChat.attachments && activeChat.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                {activeChat.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200"
                  >
                    <Paperclip size={13} className="text-indigo-500" />
                    <span className="max-w-[130px] truncate">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => handlePreviewAttachment(att)}
                      className="p-1 text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      title={isAr ? 'معاينة' : 'Preview'}
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadAttachment(att)}
                      className="p-1 text-emerald-600 hover:text-emerald-800 cursor-pointer"
                      title={isAr ? 'تنزيل' : 'Download'}
                    >
                      <Download size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messages Thread */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
              <MessageCircle size={14} className="text-indigo-500" />
              <span>{isAr ? 'الرسائل والردود المتبادلة:' : 'Live Conversation Thread:'}</span>
            </h4>

            <div className="space-y-3 max-h-[380px] overflow-y-auto p-3 sm:p-4 bg-white/70 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60">
              {(!activeChat.messages || activeChat.messages.length === 0) ? (
                <div className="text-center py-6 text-xs text-zinc-400 flex flex-col items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400 animate-bounce" />
                  <span>{isAr ? 'تم استلام طلبك بنجاح. سيظهر رد الإدارة هنا فور إرساله، ويمكنك كتابة أي ملاحظة إضافية بالأسفل.' : 'Your request is received. Admin reply will appear here.'}</span>
                </div>
              ) : (
                activeChat.messages.map((msg) => {
                  const isAdmin = msg.sender === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'} space-y-1`}
                    >
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium px-1">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/40">
                            <ShieldCheck size={12} />
                            {isAr ? 'إدارة المنصة (Admin)' : 'Admin Support'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 font-bold">
                            <User size={12} />
                            {msg.senderName || (isAr ? 'أنت' : 'You')}
                          </span>
                        )}
                        <span>{formatDateTime(msg.createdAt, isAr)}</span>
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl max-w-[85%] sm:max-w-[75%] text-xs sm:text-sm leading-relaxed space-y-2 shadow-2xs ${
                          isAdmin
                            ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-tr-none rtl:rounded-tr-2xl rtl:rounded-tl-none font-medium'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none rtl:rounded-tl-2xl rtl:rounded-tr-none border border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {/* Attachments inside message */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/20 dark:border-zinc-700">
                            {msg.attachments.map((att) => (
                              <div
                                key={att.id}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${
                                  isAdmin
                                    ? 'bg-white/20 text-white hover:bg-white/30'
                                    : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700'
                                }`}
                              >
                                <Paperclip size={12} />
                                <span className="max-w-[110px] truncate">{att.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handlePreviewAttachment(att)}
                                  className="p-0.5 hover:opacity-75 cursor-pointer"
                                  title={isAr ? 'معاينة' : 'Preview'}
                                >
                                  <Eye size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(att)}
                                  className="p-0.5 hover:opacity-75 cursor-pointer"
                                  title={isAr ? 'تنزيل' : 'Download'}
                                >
                                  <Download size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Reply Composer Form */}
          <form onSubmit={handleSendReply} className="space-y-3 pt-2">
            <div className="relative">
              <textarea
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={isAr ? 'اكتب ردك أو استفسارك الإضافي هنا...' : 'Type your follow-up reply...'}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-2xs"
              />
            </div>

            {/* Reply Attachments list */}
            {replyAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {replyAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-medium shadow-2xs"
                  >
                    {att.type?.startsWith('image/') ? <ImageIcon size={14} className="text-indigo-500" /> : <FileText size={14} className="text-indigo-500" />}
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

            <div className="flex items-center justify-between gap-2">
              <label className="cursor-pointer px-3.5 py-2 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs">
                {replyUploading ? <Loader2 size={13} className="animate-spin text-indigo-500" /> : <Paperclip size={13} className="text-indigo-500" />}
                <span>{replyUploading ? (isAr ? 'جاري الرفع...' : 'Uploading...') : (isAr ? 'إرفاق صورة / ملف' : 'Attach File')}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={(e) => handleFileUpload(e, true)}
                  disabled={replyUploading}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={sendingReply || (!replyText.trim() && replyAttachments.length === 0)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {sendingReply ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{isAr ? 'إرسال الرسالة' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. NEW CONVERSATION FORM (Shown when student has NO active conversation)  */
        /* ========================================================================= */
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
            <MessageSquarePlus size={16} className="text-indigo-600" />
            <span>{isAr ? 'إنشاء محادثة / شكوى / استفسار جديدة:' : 'Start New Conversation / Ticket:'}</span>
          </div>

          <form onSubmit={handleSubmitNewFeedback} className="space-y-4 bg-zinc-50/80 dark:bg-zinc-800/40 p-4 sm:p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'عنوان المحادثة / المشكلة' : 'Title'}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: استفسار عن حساب التقدير، أو مشكلة في إضافة مادة' : 'e.g., Issue with GPA calculation or feature request'}
                  className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'نوع المشاركة / التصنيف' : 'Category'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: 'suggestion', label: isAr ? 'اقتراح' : 'Suggestion' },
                    { id: 'complaint', label: isAr ? 'شكوى' : 'Complaint' },
                    { id: 'inquiry', label: isAr ? 'استفسار' : 'Inquiry' },
                    { id: 'bug', label: isAr ? 'عطل' : 'Bug' },
                    { id: 'other', label: isAr ? 'أخرى' : 'Other' }
                  ].map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setType(cat.id as any)}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer text-center ${
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
                {isAr ? 'التفاصيل والشرح بالتفصيل' : 'Details'}
              </label>
              <textarea
                required
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={isAr ? 'اكتب تفاصيل مقترحك أو وصف المشكلة بدقة لكي تتمكن الإدارة من مساعدتك...' : 'Explain your idea or problem in detail...'}
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Attachments Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Paperclip size={14} className="text-indigo-600 dark:text-indigo-400" />
                  <span>{isAr ? 'المرفقات (لقطات شاشة أو ملفات PDF)' : 'Attachments (Images, screenshots, PDF)'}</span>
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
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                <span>{isAr ? 'المرسل:' : 'Sender:'}</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{currentName}</span>
                {currentEmail && (
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">({currentEmail})</span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
                <span>{isAr ? 'إرسال وبدء المحادثة' : 'Submit & Start Chat'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CLOSED / RESOLVED CONVERSATIONS ARCHIVE (Accordion View)               */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Inbox size={16} className="text-zinc-400" />
            <span>{isAr ? 'سجل المحادثات المنتهية والسابقة' : 'Resolved Conversations Archive'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-black">
              {closedFeedbacks.length}
            </span>
          </h3>
        </div>

        {loadingList ? (
          <div className="text-center py-6 text-xs text-zinc-400 flex flex-col items-center gap-2">
            <Loader2 className="animate-spin w-5 h-5 text-indigo-500" />
            <span>{isAr ? 'جاري تحميل السجل...' : 'Loading history...'}</span>
          </div>
        ) : closedFeedbacks.length > 0 ? (
          <div className="space-y-3">
            {closedFeedbacks.map((fb) => {
              const isExpanded = !!expandedClosedIds[fb.id];
              return (
                <div
                  key={fb.id}
                  className="bg-zinc-50/90 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 overflow-hidden transition-all"
                >
                  {/* Collapsed Label Header */}
                  <div
                    onClick={() => toggleExpandClosed(fb.id)}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-zinc-100/80 dark:hover:bg-zinc-800/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800/60 shrink-0">
                        <CheckCheck size={12} />
                        {isAr ? 'تم الرد والانتهاء' : 'Resolved'}
                      </span>
                      {getTypeBadge(fb.type)}
                      <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                        {fb.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-zinc-400 hidden sm:inline-block">
                        {formatDateTime(fb.closedAt || fb.createdAt, isAr)}
                      </span>
                      <div className="p-1 rounded-lg bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Chat History */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 border-t border-zinc-200/70 dark:border-zinc-700/50 space-y-4 bg-white dark:bg-zinc-900/60 animate-in fade-in duration-200">
                      
                      {/* Initial Ticket */}
                      <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                        <span className="text-[11px] font-bold text-zinc-400 block">
                          {isAr ? 'الوصف الأساسي:' : 'Initial Description:'}
                        </span>
                        <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                          {fb.content}
                        </p>

                        {fb.attachments && fb.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/40">
                            {fb.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 rounded-lg text-xs font-bold border border-zinc-200 dark:border-zinc-700"
                              >
                                <Paperclip size={12} className="text-indigo-500" />
                                <span className="max-w-[120px] truncate">{att.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handlePreviewAttachment(att)}
                                  className="p-0.5 text-indigo-600 cursor-pointer"
                                >
                                  <Eye size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(att)}
                                  className="p-0.5 text-emerald-600 cursor-pointer"
                                >
                                  <Download size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Chat Messages Thread */}
                      {fb.messages && fb.messages.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-xs font-bold text-zinc-500 block">
                            {isAr ? 'سجل الرسائل والردود:' : 'Message Thread:'}
                          </span>
                          <div className="space-y-2.5 max-h-60 overflow-y-auto p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            {fb.messages.map((m) => {
                              const isAdmin = m.sender === 'admin';
                              return (
                                <div
                                  key={m.id}
                                  className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'} space-y-1`}
                                >
                                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                    <span className="font-bold">
                                      {isAdmin ? (isAr ? 'الإدارة' : 'Admin') : (m.senderName || (isAr ? 'أنت' : 'You'))}
                                    </span>
                                    <span>•</span>
                                    <span>{formatDateTime(m.createdAt, isAr)}</span>
                                  </div>
                                  <div
                                    className={`p-3 rounded-xl max-w-[80%] text-xs ${
                                      isAdmin
                                        ? 'bg-indigo-600 text-white rounded-tr-none rtl:rounded-tr-xl rtl:rounded-tl-none font-medium'
                                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-tl-none rtl:rounded-tl-xl rtl:rounded-tr-none'
                                    }`}
                                  >
                                    <p className="whitespace-pre-wrap">{m.content}</p>
                                    {m.attachments && m.attachments.length > 0 && (
                                      <div className="flex flex-wrap gap-1 pt-1.5 border-t border-white/20 dark:border-zinc-600">
                                        {m.attachments.map((att) => (
                                          <div
                                            key={att.id}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-white/20 text-white font-bold"
                                          >
                                            <Paperclip size={10} />
                                            <span className="max-w-[100px] truncate">{att.name}</span>
                                            <button
                                              type="button"
                                              onClick={() => handlePreviewAttachment(att)}
                                              className="cursor-pointer"
                                            >
                                              <Eye size={10} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Closed Status Banner */}
                      <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span>
                            {isAr
                              ? `تم إنهاء هذه المحادثة وحفظها بالأرشيف (${fb.closedBy === 'student' ? 'بواسطتك' : 'بواسطة الإدارة'}).`
                              : 'This conversation was resolved and archived.'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setFeedbackToDelete(fb)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer shrink-0"
                          title={isAr ? 'حذف من السجل' : 'Delete from history'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            {isAr ? 'لا توجد محادثات منتهية في الأرشيف.' : 'No resolved conversations in archive.'}
          </div>
        )}
      </div>

      {/* --- CONFIRM CLOSE ACTIVE CONVERSATION MODAL --- */}
      <ConfirmModal
        isOpen={!!closingChat}
        title={isAr ? 'إنهاء المحادثة وإغلاق التذكرة' : 'End Conversation'}
        message={
          isAr
            ? `هل أنت متأكد من إنهاء المحادثة "${closingChat?.title}"؟ بعد الإنهاء سيتم نقلها للأرشيف ولن تتمكن من إرسال رسائل إضافية فيها، لكن يمكنك بدء محادثة جديدة في أي وقت.`
            : `Are you sure you want to end "${closingChat?.title}"? You will be able to start a new conversation.`
        }
        confirmText={isAr ? 'نعم، إنهاء المحادثة' : 'Yes, End Chat'}
        cancelText={isAr ? 'تراجع' : 'Cancel'}
        variant="danger"
        onConfirm={handleConfirmCloseChat}
        onCancel={() => setClosingChat(null)}
      />

      {/* --- CONFIRM DELETE MODAL --- */}
      <ConfirmModal
        isOpen={!!feedbackToDelete}
        title={isAr ? 'حذف المحادثة' : 'Delete Conversation'}
        message={
          isAr
            ? `هل أنت متأكد من رغبتك في حذف "${feedbackToDelete?.title}" نهائياً؟`
            : `Are you sure you want to delete "${feedbackToDelete?.title}"?`
        }
        confirmText={isAr ? 'نعم، حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setFeedbackToDelete(null)}
      />
    </section>
  );
}
