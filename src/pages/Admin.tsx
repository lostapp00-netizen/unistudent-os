import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  Award, 
  AlertTriangle, 
  HardDrive, 
  Database, 
  MessageSquare, 
  Download, 
  Upload, 
  Mail, 
  Calendar, 
  Clock, 
  Search, 
  Eye, 
  Copy, 
  Check, 
  RefreshCw, 
  LogIn, 
  Sparkles, 
  TrendingUp, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  X, 
  BookOpen, 
  BarChart3, 
  Send,
  Trash2,
  Paperclip,
  LogOut,
  LayoutDashboard,
  Menu,
  ExternalLink,
  FileText,
  Inbox,
  EyeOff,
  HelpCircle,
  Info,
  Loader2,
  Building2,
  GraduationCap,
  Sun,
  Moon,
  Globe,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  BellRing,
  Bell,
  Plus
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { db } from '../lib/db';
import { calculateGPA, calculateSubjectGrade, getWarningThreshold, isSubjectAtWarningRisk } from '../lib/academic';
import { FeedbackSuggestion, EmailBackupConfig, DatabaseBackup } from '../types';
import { ConfirmModal } from '../components/ui/CustomModal';
import { formatDateTime, getAcademicEvaluation } from '../lib/utils';
import { AdminUniversitiesTab } from '../components/admin/AdminUniversitiesTab';

export function Admin() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings, updateTheme, updateLanguage } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const toggleTheme = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateTheme(newTheme);
  };

  const toggleLanguage = () => {
    const newLang = settings.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    updateLanguage(newLang);
  };

  // --- Auth & Access State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('unistudent_admin_auth') === 'true';
  });

  // --- Sidebar & Tabs ---
  type TabType = 'overview' | 'students' | 'universities' | 'suggestions' | 'backup';
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    try {
      const saved = sessionStorage.getItem('unistudent_admin_active_tab') as TabType;
      if (saved && ['overview', 'students', 'universities', 'suggestions', 'backup'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'overview';
  });

  const [universitySubTab, setUniversitySubTab] = useState<'universities' | 'updates'>(() => {
    try {
      const saved = sessionStorage.getItem('unistudent_admin_uni_subtab');
      if (saved === 'updates' || saved === 'universities') return saved as any;
    } catch {}
    return 'universities';
  });

  const [universitiesExpanded, setUniversitiesExpanded] = useState<boolean>(true);
  const [pendingUniUpdatesCount, setPendingUniUpdatesCount] = useState<number>(0);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('unistudent_admin_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem('unistudent_admin_uni_subtab', universitySubTab);
    } catch {}
  }, [universitySubTab]);

  // --- Data State ---
  const [loading, setLoading] = useState(true);
  const [adminData, setAdminData] = useState<{
    userIds: string[];
    rawSettings: any[];
    rawSubjects: any[];
    rawTasks: any[];
    rawNotes: any[];
    rawAppointments: any[];
    rawSchedule: any[];
    rawGroups: any[];
    rawFiles: any[];
    feedbacks: FeedbackSuggestion[];
  } | null>(null);

  // --- Students Search & Filters ---
  const [searchQuery, setSearchQuery] = useState('');
  const [studentUniFilter, setStudentUniFilter] = useState('all');
  const [studentCollegeFilter, setStudentCollegeFilter] = useState('all');
  const [gpaFilter, setGpaFilter] = useState<'all' | 'honor' | 'warning' | 'good'>('all');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // --- Suggestions Filter & Modals ---
  const [feedbackSubTab, setFeedbackSubTab] = useState<'new' | 'reviewed' | 'resolved'>('new');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackSuggestion | null>(null);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSavedSuccess, setNoteSavedSuccess] = useState(false);
  const [suggestionTypeFilter, setSuggestionTypeFilter] = useState<string>('all');
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<string>('all');
  const [feedbackToDelete, setFeedbackToDelete] = useState<string | null>(null);

  // --- Backup & Email State ---
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailBackupConfig>(() => db.getEmailBackupConfig());
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false);
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);

  // Load Admin Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [data, pendingUpdates] = await Promise.all([
        db.getAdminAllData(),
        db.getPendingUpdates()
      ]);
      setAdminData(data);
      setPendingUniUpdatesCount(pendingUpdates.filter(p => p.status === 'pending').length);
    } catch (e) {
      console.error('Error loading admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleLogout = async () => {
    sessionStorage.removeItem('unistudent_admin_auth');
    try {
      const { supabase } = await import('../lib/supabase');
      await supabase.auth.signOut();
    } catch {}
    navigate('/auth', { replace: true });
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(id);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Aggregate student objects from raw data
  const studentsList = React.useMemo(() => {
    if (!adminData) return [];

    return adminData.userIds.map((uid) => {
      const userSettingsRow = adminData.rawSettings.find(s => s.user_id === uid) || {};
      const userSubjects = adminData.rawSubjects.filter(s => s.user_id === uid);
      const userTasks = adminData.rawTasks.filter(t => t.user_id === uid);
      const userNotes = adminData.rawNotes.filter(n => n.user_id === uid);
      const userAppointments = adminData.rawAppointments.filter(a => a.user_id === uid);
      const userSchedule = adminData.rawSchedule.filter(sc => sc.user_id === uid);
      const userFiles = adminData.rawFiles.filter(f => f.user_id === uid && f.type !== 'folder');
      const userFeedbacks = adminData.feedbacks.filter(fb => fb.userId === uid);

      const savedEmail = localStorage.getItem(`unistudent_user_email_${uid}`) || '';
      let knownEmail = '';
      try {
        const knownRaw = localStorage.getItem('unistudent_known_users');
        if (knownRaw) {
          const list = JSON.parse(knownRaw);
          const found = list.find((u: any) => u.id === uid);
          if (found?.email) knownEmail = found.email;
        }
      } catch {}

      const feedbackEmail = userFeedbacks.find(fb => fb.userEmail)?.userEmail || '';
      const finalEmail = userSettingsRow.email || savedEmail || knownEmail || feedbackEmail || (isAr ? 'لم يحدد بريد' : 'No email');

      const gradingScale = userSettingsRow.grading_scale || settings.gradingScale || [];
      const semesters = userSettingsRow.semesters || [];
      const currentSem = semesters.find((s: any) => s.isCurrent);

      const cgpa = calculateGPA(
        userSubjects,
        gradingScale,
        undefined,
        undefined,
        userSettingsRow.initial_cumulative_gpa,
        userSettingsRow.initial_completed_credit_hours
      );

      const semesterGPA = currentSem
        ? calculateGPA(userSubjects, gradingScale, currentSem.yearIndex, currentSem.semesterIndex)
        : 0;

      const registeredCreditHours = userSubjects.reduce((acc, s) => acc + (Number(s.credit_hours) || 0), 0);
      const passedCreditHours = userSubjects.reduce((acc, s) => {
        const gr = calculateSubjectGrade(s, gradingScale);
        return gr && gr.letter !== 'F' ? acc + (Number(s.credit_hours) || 0) : acc;
      }, 0);

      const warningThreshold = getWarningThreshold({
        warningGradeLetter: userSettingsRow.warning_grade_letter,
        warningGpaPoints: userSettingsRow.warning_gpa_points,
        gradingScale
      });

      const warningSubjects = userSubjects.filter(s => 
        isSubjectAtWarningRisk(s, gradingScale, warningThreshold.points)
      );

      const totalStorageBytes = userFiles.reduce((acc, f) => acc + (Number(f.size) || 0), 0);

      return {
        id: uid,
        name: userSettingsRow.name || userSettingsRow.user_name || (isAr ? 'طالب مسجل' : 'Registered Student'),
        email: finalEmail,
        university: userSettingsRow.university || (isAr ? 'غير محدد' : 'Not specified'),
        college: userSettingsRow.college || (isAr ? 'غير محدد' : 'Not specified'),
        enrollmentDate: userSettingsRow.enrollment_date || '',
        totalYears: userSettingsRow.total_years || 4,
        semestersPerYear: userSettingsRow.semesters_per_year || 2,
        currentYear: currentSem ? currentSem.yearIndex : 1,
        currentSemester: currentSem ? currentSem.semesterIndex : 1,
        cgpa,
        semesterGPA,
        registeredCreditHours,
        passedCreditHours,
        warningCount: warningSubjects.length,
        warningSubjects,
        totalStorageBytes,
        subjectsCount: userSubjects.length,
        finishedSubjectsCount: userSubjects.filter(s => s.status === 'finished').length,
        tasksCount: userTasks.length,
        notesCount: userNotes.length,
        appointmentsCount: userAppointments.length,
        scheduleCount: userSchedule.length,
        filesCount: userFiles.length,
        feedbacksCount: userFeedbacks.length,
        gradingScale: gradingScale,
        subjects: userSubjects.map(s => ({
          id: s.id,
          code: s.code || '',
          name: s.name,
          creditHours: Number(s.credit_hours || s.creditHours || 3),
          totalMarks: Number(s.total_marks || s.totalMarks || 100),
          yearIndex: Number(s.year_index || s.yearIndex || 1),
          semesterIndex: Number(s.semester_index || s.semesterIndex || 1),
          distributions: s.distributions || [],
          status: s.status || 'current',
          includeInGpa: s.include_in_gpa !== false && s.includeInGpa !== false
        })),
        files: (adminData.rawFiles.filter(f => f.user_id === uid)).map(f => ({
          id: f.id,
          name: f.name,
          size: Number(f.size || 0),
          type: f.type || 'file',
          url: f.url || '',
          createdAt: f.upload_date || f.created_at || new Date().toISOString(),
          parentId: f.parent_id || f.parentId || null,
          b2FileId: f.b2_file_id || f.b2FileId
        })),
        raw: {
          settings: userSettingsRow,
          subjects: userSubjects,
          tasks: userTasks,
          notes: userNotes,
          appointments: userAppointments,
          schedule: userSchedule,
          files: userFiles,
          feedbacks: userFeedbacks
        }
      };
    });
  }, [adminData, isAr, settings.gradingScale]);

  const availableStudentUnis = React.useMemo(() => {
    return Array.from(new Set(studentsList.map(s => s.university).filter(u => u && u !== 'غير محدد' && u !== 'Not specified')));
  }, [studentsList]);

  const availableStudentColleges = React.useMemo(() => {
    return Array.from(new Set(studentsList.map(s => s.college).filter(c => c && c !== 'غير محدد' && c !== 'Not specified')));
  }, [studentsList]);

  const filteredStudents = React.useMemo(() => {
    return studentsList.filter(student => {
      if (studentUniFilter !== 'all' && student.university !== studentUniFilter) return false;
      if (studentCollegeFilter !== 'all' && student.college !== studentCollegeFilter) return false;

      const matchesSearch = 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.university.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.college.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (gpaFilter === 'honor') return student.cgpa >= 3.5;
      if (gpaFilter === 'warning') return student.warningCount > 0;
      if (gpaFilter === 'good') return student.cgpa >= 2.5 && student.cgpa < 3.5;

      return true;
    });
  }, [studentsList, searchQuery, gpaFilter, studentUniFilter, studentCollegeFilter]);

  // Overview Metrics
  const totalStudents = studentsList.length;
  const honorStudents = studentsList.filter(s => s.cgpa >= 3.5).length;
  const warningStudents = studentsList.filter(s => s.warningCount > 0).length;
  const avgCgpa = totalStudents > 0 ? (studentsList.reduce((acc, s) => acc + s.cgpa, 0) / totalStudents).toFixed(2) : '0.00';
  const uniquePlatformFiles = React.useMemo(() => {
    if (!adminData?.rawFiles) return [];
    const seen = new Set<string>();
    const unique: any[] = [];
    adminData.rawFiles.forEach(f => {
      if (f.type === 'folder') return;
      const key = f.b2_file_id || f.url || `${f.name}_${f.size}`;
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(f);
      }
    });
    return unique;
  }, [adminData]);

  const totalPlatformStorageBytes = uniquePlatformFiles.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
  const totalPlatformUniqueFilesCount = uniquePlatformFiles.length;
  
  const formatAdminStorage = (bytes: number) => {
    if (!bytes || bytes === 0) return '0.0 MB';
    if (bytes < 1024 * 1024) {
      const kb = (bytes / 1024).toFixed(1);
      return `${kb} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const pendingFeedbacks = adminData?.feedbacks.filter(f => f.status === 'new').length || 0;
  const reviewedFeedbacks = adminData?.feedbacks.filter(f => f.status === 'reviewed').length || 0;
  const resolvedFeedbacks = adminData?.feedbacks.filter(f => f.status === 'resolved').length || 0;

  // Filtered Suggestions
  const filteredSuggestions = React.useMemo(() => {
    if (!adminData) return [];
    return adminData.feedbacks.filter(fb => {
      if (feedbackSubTab === 'new' && fb.status !== 'new') return false;
      if (feedbackSubTab === 'reviewed' && fb.status !== 'reviewed') return false;
      if (feedbackSubTab === 'resolved' && fb.status !== 'resolved') return false;
      if (suggestionTypeFilter !== 'all' && fb.type !== suggestionTypeFilter) return false;
      if (feedbackSearch.trim()) {
        const q = feedbackSearch.toLowerCase();
        const student = studentsList.find(s => s.id === fb.userId);
        const studentName = student?.name || fb.userName || '';
        const studentEmail = student?.email || fb.userEmail || '';
        const studentUni = student?.university || '';
        const studentCollege = student?.college || '';
        const matches = 
          fb.title.toLowerCase().includes(q) ||
          fb.content.toLowerCase().includes(q) ||
          studentEmail.toLowerCase().includes(q) ||
          studentName.toLowerCase().includes(q) ||
          studentUni.toLowerCase().includes(q) ||
          studentCollege.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [adminData, feedbackSubTab, suggestionTypeFilter, feedbackSearch, studentsList]);

  // Instant optimistic feedback updates
  const handleUpdateFeedbackStatus = async (id: string, newStatus: FeedbackSuggestion['status']) => {
    setAdminData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        feedbacks: prev.feedbacks.map(f => f.id === id ? { ...f, status: newStatus } : f)
      };
    });
    setSelectedFeedback(prev => (prev && prev.id === id ? { ...prev, status: newStatus } : prev));
    try {
      await db.updateFeedback(id, { status: newStatus });
    } catch (e) {
      console.error('Error updating feedback status:', e);
    }
  };

  const handleUpdateFeedbackType = async (id: string, newType: FeedbackSuggestion['type']) => {
    setAdminData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        feedbacks: prev.feedbacks.map(f => f.id === id ? { ...f, type: newType } : f)
      };
    });
    setSelectedFeedback(prev => (prev && prev.id === id ? { ...prev, type: newType } : prev));
    try {
      await db.updateFeedback(id, { type: newType });
    } catch (e) {
      console.error('Error updating feedback type:', e);
    }
  };

  // Export Backup
  const handleExportBackup = async () => {
    try {
      setBackupLoading(true);
      setBackupMessage(null);
      const backup = await db.exportFullDatabaseBackup();
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `unistudent_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupMessage({
        type: 'success',
        text: isAr ? 'تم تنزيل النسخة الاحتياطية بنجاح على جهازك!' : 'Database backup downloaded successfully!'
      });
    } catch (err: any) {
      setBackupMessage({
        type: 'error',
        text: err.message || (isAr ? 'حدث خطأ أثناء تنزيل النسخة الاحتياطية.' : 'Failed to export backup.')
      });
    } finally {
      setBackupLoading(false);
    }
  };

  // Import Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBackupLoading(true);
      setBackupMessage(null);

      const text = await file.text();
      const backup: DatabaseBackup = JSON.parse(text);

      if (!backup || !backup.data) {
        throw new Error(isAr ? 'صيغة ملف النسخة الاحتياطية غير صالحة.' : 'Invalid backup file format.');
      }

      const result = await db.restoreDatabaseFromBackup(backup, 'merge');
      setBackupMessage({
        type: result.success ? 'success' : 'error',
        text: result.message
      });

      await fetchData();
    } catch (err: any) {
      setBackupMessage({
        type: 'error',
        text: err.message || (isAr ? 'حدث خطأ أثناء استعادة النسخة الاحتياطية.' : 'Failed to restore backup.')
      });
    } finally {
      setBackupLoading(false);
      e.target.value = '';
    }
  };

  // Save Email Config
  const handleSaveEmailConfig = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveEmailBackupConfig(emailConfig);
    setEmailSaveSuccess(true);
    setTimeout(() => setEmailSaveSuccess(false), 3000);
  };

  // Send Backup Email Immediately (via Gmail SMTP with JSON attachment)
  const handleSendBackupEmailNow = async () => {
    try {
      if (!emailConfig.targetEmail || !emailConfig.targetEmail.trim()) {
        setBackupMessage({
          type: 'error',
          text: isAr ? 'يرجى كتابة البريد الإلكتروني المستلم للنسخة أولاً.' : 'Please enter recipient email first.'
        });
        return;
      }
      if (!emailConfig.senderEmail || !emailConfig.senderEmail.trim()) {
        setBackupMessage({
          type: 'error',
          text: isAr ? 'يرجى إدخال بريد Gmail المرسل.' : 'Please enter sender Gmail address.'
        });
        return;
      }
      if (!emailConfig.appPassword || !emailConfig.appPassword.trim()) {
        setBackupMessage({
          type: 'error',
          text: isAr ? 'يرجى إدخال كلمة مرور تطبيقات جوجل (Google App Password).' : 'Please enter your Google App Password.'
        });
        return;
      }

      setBackupLoading(true);
      setBackupMessage(null);

      const { sendDatabaseBackupEmail } = await import('../lib/emailBackup');
      const result = await sendDatabaseBackupEmail(emailConfig);

      setBackupMessage({
        type: 'success',
        text: result.message
      });

      const updatedConfig: EmailBackupConfig = {
        ...emailConfig,
        lastSentAt: new Date().toISOString(),
        status: 'active'
      };
      setEmailConfig(updatedConfig);
      db.saveEmailBackupConfig(updatedConfig);
    } catch (e: any) {
      setBackupMessage({
        type: 'error',
        text: e.message || (isAr ? 'حدث خطأ أثناء إرسال النسخة الاحتياطية.' : 'Error triggering backup email.')
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDeleteFeedbackConfirmed = async () => {
    if (!feedbackToDelete) return;
    await db.deleteFeedback(feedbackToDelete);
    setFeedbackToDelete(null);
    await fetchData();
  };

  // Navigation Items for Admin Sidebar
  const navItems = [
    { id: 'overview' as TabType, label: isAr ? 'الإحصائيات العامة' : 'Overview', icon: BarChart3 },
    { id: 'students' as TabType, label: isAr ? 'سجل الطلاب' : 'Students Directory', icon: Users, badge: studentsList.length },
    { id: 'universities' as TabType, label: isAr ? 'قواعد بيانات الجامعات' : 'University Databases', icon: Building2 },
    { id: 'suggestions' as TabType, label: isAr ? 'المقترحات والشكاوى' : 'Feedback Hub', icon: MessageSquare, badge: pendingFeedbacks > 0 ? pendingFeedbacks : undefined, badgeColor: 'bg-rose-500 text-white' },
    { id: 'backup' as TabType, label: isAr ? 'النسخ الاحتياطي والأتمتة' : 'Backup & Email', icon: Database },
  ];

  // --- Redirect to unified /auth if not logged in ---
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 overflow-hidden font-sans">
      
      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs" 
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* --- ADMIN SIDEBAR --- */}
      <aside className={`fixed inset-y-0 z-50 flex-shrink-0 w-64 bg-white dark:bg-zinc-900 flex flex-col transition-all duration-300 ease-in-out md:relative shadow-xl md:shadow-none ${
        isAr 
          ? 'right-0 border-l border-zinc-200 dark:border-zinc-800' 
          : 'left-0 border-r border-zinc-200 dark:border-zinc-800'
      } ${
        isMobileSidebarOpen 
          ? 'translate-x-0' 
          : (isAr ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0')
      }`}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-zinc-900 dark:text-white">Admin OS</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">{isAr ? 'لوحة تحكم الإدارة' : 'Platform Control'}</p>
            </div>
          </div>

          <button onClick={() => setIsMobileSidebarOpen(false)} className="md:hidden p-1.5 text-zinc-400 hover:text-zinc-600">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {/* 1. Overview */}
          <button
            onClick={() => {
              setActiveTab('overview');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-xs border border-blue-200/80 dark:border-blue-800/60 font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className={`w-4 h-4 ${activeTab === 'overview' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`} />
              <span>{isAr ? 'الإحصائيات العامة' : 'Overview'}</span>
            </div>
          </button>

          {/* 2. Students Directory */}
          <button
            onClick={() => {
              setActiveTab('students');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'students'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-xs border border-blue-200/80 dark:border-blue-800/60 font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className={`w-4 h-4 ${activeTab === 'students' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`} />
              <span>{isAr ? 'سجل الطلاب' : 'Students Directory'}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {studentsList.length}
            </span>
          </button>

          {/* 3. University Databases Collapsible Dropdown */}
          <div className="space-y-1">
            <button
              onClick={() => {
                if (activeTab !== 'universities') {
                  setActiveTab('universities');
                }
                setUniversitiesExpanded(!universitiesExpanded);
                window.dispatchEvent(new CustomEvent('reset-universities-view'));
              }}
              className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'universities'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-xs border border-blue-200/80 dark:border-blue-800/60 font-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 className={`w-4 h-4 ${activeTab === 'universities' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`} />
                <span>{isAr ? 'قواعد بيانات الجامعات' : 'University Hub'}</span>
                {pendingUniUpdatesCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-black bg-amber-500 text-white rounded-full animate-pulse">
                    {pendingUniUpdatesCount}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${universitiesExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Sub-menu items */}
            {universitiesExpanded && (
              <div className="mt-1 mr-4 rtl:mr-4 rtl:ml-0 ml-4 border-r-2 rtl:border-r-2 rtl:border-l-0 border-l-2 border-zinc-200 dark:border-zinc-800 pr-3 rtl:pr-3 rtl:pl-0 pl-3 space-y-1">
                <button
                  onClick={() => {
                    setActiveTab('universities');
                    setUniversitySubTab('universities');
                    setIsMobileSidebarOpen(false);
                    window.dispatchEvent(new CustomEvent('reset-universities-view'));
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded-xl text-xs transition-all cursor-pointer ${
                    activeTab === 'universities' && universitySubTab === 'universities'
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-900/30 font-black'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-bold'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'لوحة وإدارة الجامعات' : 'Universities Directory'}</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('universities');
                    setUniversitySubTab('updates');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all cursor-pointer ${
                    activeTab === 'universities' && universitySubTab === 'updates'
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-900/30 font-black'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BellRing className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تحديثات قاعدة البيانات' : 'Database Updates'}</span>
                  </div>
                  {pendingUniUpdatesCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-black bg-amber-500 text-white rounded-full">
                      {pendingUniUpdatesCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 4. Suggestions / Feedbacks */}
          <button
            onClick={() => {
              setActiveTab('suggestions');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'suggestions'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-xs border border-blue-200/80 dark:border-blue-800/60 font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <MessageSquare className={`w-4 h-4 ${activeTab === 'suggestions' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`} />
              <span>{isAr ? 'المقترحات والشكاوى' : 'Feedback Hub'}</span>
            </div>
            {pendingFeedbacks > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                {pendingFeedbacks}
              </span>
            )}
          </button>

          {/* 5. Backup & Email */}
          <button
            onClick={() => {
              setActiveTab('backup');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-xs border border-blue-200/80 dark:border-blue-800/60 font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Database className={`w-4 h-4 ${activeTab === 'backup' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`} />
              <span>{isAr ? 'النسخ الاحتياطي والأتمتة' : 'Backup & Email'}</span>
            </div>
          </button>
        </nav>

        {/* Sidebar Footer - Matching Layout.tsx */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors flex items-center justify-center cursor-pointer"
              title={settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {settings.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <button 
              onClick={toggleLanguage}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors uppercase tracking-wider cursor-pointer"
            >
              {settings.language === 'ar' ? 'EN' : 'عربي'}
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2 px-3 py-1.5 text-xs font-bold bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title={settings.language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
          >
            <LogOut className="w-4 h-4" />
            <span>{isAr ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN ADMIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* Top Header Bar */}
        <header className="p-4 sm:p-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
                {navItems.find(n => n.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-zinc-400 hidden sm:block">
                {isAr ? 'إدارة وتحكم متكامل في قاعدة بيانات منصة UniStudent' : 'Complete platform management & database control'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2"></div>
        </header>

        {/* Tab Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{isAr ? 'إجمالي الطلاب' : 'Total Students'}</p>
                    <h3 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">{totalStudents}</h3>
                    <p className="text-[11px] text-zinc-500 mt-1">{isAr ? 'حسابات مسجلة بالمنصة' : 'Registered accounts'}</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Users size={28} />
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{isAr ? 'متوسط المعدل العام' : 'Platform Avg CGPA'}</p>
                    <h3 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">{avgCgpa} <span className="text-xs font-medium text-zinc-400">/ 4.0</span></h3>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                      {honorStudents} {isAr ? 'طلاب متفوقين (امتياز)' : 'Honor students'}
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Award size={28} />
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{isAr ? 'تحت الإنذار الأكاديمي' : 'At Warning Risk'}</p>
                    <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">{warningStudents}</h3>
                    <p className="text-[11px] text-zinc-500 mt-1">{isAr ? 'طلاب يحتاجون لخطة تعويض' : 'Students needing recovery'}</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <AlertTriangle size={28} />
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{isAr ? 'استهلاك التخزين السحابي' : 'Storage Used'}</p>
                    <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{formatAdminStorage(totalPlatformStorageBytes)}</h3>
                    <p className="text-[11px] text-zinc-500 mt-1">{adminData?.rawFiles.filter(f => f.type !== 'folder').length || 0} {isAr ? 'ملفات درايف' : 'drive files'}</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <HardDrive size={28} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-5">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
                    <span>{isAr ? 'ملخص الأداء الأكاديمي للطلاب' : 'Academic Performance Breakdown'}</span>
                  </h3>

                  <div className="space-y-4">
                    {(() => {
                      const goodStudents = studentsList.filter(s => s.cgpa >= 2.5 && s.cgpa < 3.5).length;
                      const honorPct = totalStudents > 0 ? Math.round((honorStudents / totalStudents) * 100) : 0;
                      const goodPct = totalStudents > 0 ? Math.round((goodStudents / totalStudents) * 100) : 0;
                      const warningPct = totalStudents > 0 ? Math.round((warningStudents / totalStudents) * 100) : 0;

                      return (
                        <>
                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1.5">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {isAr ? 'متفوقين (CGPA ≥ 3.50)' : 'Honor Tier (CGPA ≥ 3.50)'}
                              </span>
                              <span className="font-black text-zinc-900 dark:text-white">
                                {honorStudents} {isAr ? (honorStudents === 1 ? 'طالب' : 'طلاب') : (honorStudents === 1 ? 'student' : 'students')} <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">({honorPct}%)</span>
                              </span>
                            </div>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${honorPct}%` }}></div>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1.5">
                              <span className="text-indigo-600 dark:text-indigo-400">
                                {isAr ? 'أداء مستقر وجيد (2.50 - 3.49)' : 'Good Standing (2.50 - 3.49)'}
                              </span>
                              <span className="font-black text-zinc-900 dark:text-white">
                                {goodStudents} {isAr ? (goodStudents === 1 ? 'طالب' : 'طلاب') : (goodStudents === 1 ? 'student' : 'students')} <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">({goodPct}%)</span>
                              </span>
                            </div>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                              <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${goodPct}%` }}></div>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1.5">
                              <span className="text-rose-600 dark:text-rose-400">
                                {isAr ? 'تحت خطر الإنذار (CGPA < 2.00 أو مواد متعثرة)' : 'Under Warning Risk'}
                              </span>
                              <span className="font-black text-zinc-900 dark:text-white">
                                {warningStudents} {isAr ? (warningStudents === 1 ? 'طالب' : 'طلاب') : (warningStudents === 1 ? 'student' : 'students')} <span className="text-rose-600 dark:text-rose-400 font-extrabold">({warningPct}%)</span>
                              </span>
                            </div>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                              <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${warningPct}%` }}></div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-900/10 via-indigo-900/5 to-transparent dark:from-blue-950/30 dark:via-zinc-900 dark:to-zinc-900 p-6 sm:p-7 rounded-3xl border border-blue-200/60 dark:border-blue-900/40 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold mb-2">
                      <Sparkles size={18} />
                      <span>{isAr ? 'إجراءات سريعة للأدمن' : 'Admin Quick Actions'}</span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                      {isAr 
                        ? 'تنزيل أرشيف البيانات كاملاً بضغطة زر أو مراجعة مقترحات وشكاوى الطلاب المسجلة.' 
                        : 'Download complete platform snapshot or review user feedback submissions.'}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      onClick={handleExportBackup}
                      disabled={backupLoading}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
                    >
                      <Download size={14} />
                      <span>{isAr ? 'تنزيل نسخة احتياطية فوراً' : 'Download Backup JSON'}</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('suggestions')}
                      className="w-full py-2.5 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700 transition-all"
                    >
                      <MessageSquare size={14} />
                      <span>{isAr ? 'عرض المقترحات والشكاوى' : 'View Feedback'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STUDENTS DIRECTORY */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 rtl:left-auto rtl:right-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isAr ? 'بحث باسم الطالب، الإيميل، الكلية، أو الجامعة...' : 'Search student by name, email, college...'}
                    className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {availableStudentUnis.length > 0 && (
                    <select
                      value={studentUniFilter}
                      onChange={(e) => setStudentUniFilter(e.target.value)}
                      className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">{isAr ? 'كل الجامعات' : 'All Universities'}</option>
                      {availableStudentUnis.map(uni => (
                        <option key={uni} value={uni}>{uni}</option>
                      ))}
                    </select>
                  )}

                  {availableStudentColleges.length > 0 && (
                    <select
                      value={studentCollegeFilter}
                      onChange={(e) => setStudentCollegeFilter(e.target.value)}
                      className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">{isAr ? 'كل الكليات' : 'All Colleges'}</option>
                      {availableStudentColleges.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  )}

                  <select
                    value={gpaFilter}
                    onChange={(e) => setGpaFilter(e.target.value as any)}
                    className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">{isAr ? 'كل التقديرات' : 'All GPA Tiers'}</option>
                    <option value="honor">{isAr ? 'المتفوقين (امتياز)' : 'Honor (≥ 3.5)'}</option>
                    <option value="good">{isAr ? 'أداء مستقر (2.5 - 3.49)' : 'Good (2.5 - 3.49)'}</option>
                    <option value="warning">{isAr ? 'تحت الإنذار' : 'Under Warning'}</option>
                  </select>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
                <div className="overflow-x-auto">
                  <table className={`w-full text-sm ${isAr ? 'text-right' : 'text-left'} whitespace-nowrap`} dir={isAr ? 'rtl' : 'ltr'}>
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-4 px-6 font-bold">{isAr ? 'اسم الطالب' : 'Student Name'}</th>
                        <th className="py-4 px-6 font-bold">{isAr ? 'الجامعة والكلية' : 'University & College'}</th>
                        <th className="py-4 px-6 font-bold text-center">{isAr ? 'المستوى' : 'Level'}</th>
                        <th className="py-4 px-6 font-bold text-center">{isAr ? 'المواد والساعات' : 'Subjects & Credits'}</th>
                        <th className="py-4 px-6 font-bold text-center">{isAr ? 'المعدل التراكمي CGPA' : 'CGPA'}</th>
                        <th className="py-4 px-6 font-bold text-center">{isAr ? 'الإنذارات' : 'Warnings'}</th>
                        <th className="py-4 px-6 font-bold text-center">{isAr ? 'التخزين' : 'Storage'}</th>
                        <th className="py-4 px-6 font-bold text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                      {filteredStudents.map((st) => (
                        <tr key={st.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-4 px-6">
                            <div>
                              <p className="font-bold text-zinc-900 dark:text-white text-sm">{st.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 text-zinc-400">
                                <span>{st.email}</span>
                                <button
                                  onClick={() => handleCopy(st.email, st.id)}
                                  className="text-zinc-400 hover:text-blue-600 transition-colors"
                                  title={isAr ? 'نسخ الإيميل' : 'Copy Email'}
                                >
                                  {copiedEmail === st.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                </button>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <p className="font-semibold text-zinc-800 dark:text-zinc-200">{st.university}</p>
                            <p className="text-[11px] text-zinc-400">{st.college}</p>
                          </td>

                          <td className="py-4 px-6 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-700 dark:text-zinc-300">
                              {isAr ? `سنة ${st.currentYear} ف${st.currentSemester}` : `Y${st.currentYear} S${st.currentSemester}`}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-center">
                            <p className="font-bold text-zinc-800 dark:text-zinc-200">{st.subjectsCount} {isAr ? 'مواد' : 'subjects'}</p>
                            <p className="text-[11px] text-zinc-400">{st.registeredCreditHours} {isAr ? 'ساعات معتمدة' : 'credits'}</p>
                          </td>

                          <td className="py-4 px-6 text-center">
                            <span className={`px-2.5 py-1 rounded-xl font-black text-xs ${
                              st.cgpa >= 3.5 
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60' 
                                : (st.cgpa >= 2.0 
                                    ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60' 
                                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60')
                            }`}>
                              {st.cgpa.toFixed(2)} CGPA
                            </span>
                          </td>

                          <td className="py-4 px-6 text-center">
                            {st.warningCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800">
                                <AlertTriangle size={12} />
                                <span>{st.warningCount} {isAr ? 'إنذار' : 'warnings'}</span>
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{isAr ? 'سليم ومستقر' : 'Stable'}</span>
                            )}
                          </td>

                          <td className="py-4 px-6 text-center text-zinc-500 font-medium">
                            {formatAdminStorage(st.totalStorageBytes)}
                          </td>

                          <td className="py-4 px-6 text-center">
                            <button
                              onClick={() => setSelectedStudent(st)}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold rounded-xl border border-blue-200 dark:border-blue-800/60 transition-all flex items-center gap-1.5 mx-auto shadow-2xs"
                            >
                              <Eye size={14} />
                              <span>{isAr ? 'عرض الملف' : 'View Profile'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}

                      {filteredStudents.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-zinc-400">
                            {isAr ? 'لا توجد بيانات طلاب مطابقة.' : 'No students found.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: UNIVERSITIES & COLLEGES DATABASE */}
          {activeTab === 'universities' && (
            <AdminUniversitiesTab
              studentsList={studentsList}
              onRefreshAllData={fetchData}
              subTab={universitySubTab}
              onSubTabChange={(st) => setUniversitySubTab(st)}
            />
          )}

          {/* TAB 4: SUGGESTIONS & FEEDBACK HUB */}
          {activeTab === 'suggestions' && (
            <div className="space-y-6">
              {/* Sub-Tabs: الرئيسية / قيد المراجعة / تم الرد عليها */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 flex-wrap">
                  <button
                    onClick={() => setFeedbackSubTab('new')}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                      feedbackSubTab === 'new'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Inbox size={15} />
                    <span>{isAr ? 'الرئيسية (الرسائل الواردة)' : 'Inbox (New)'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black">
                      {pendingFeedbacks}
                    </span>
                  </button>

                  <button
                    onClick={() => setFeedbackSubTab('reviewed')}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                      feedbackSubTab === 'reviewed'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Clock size={15} />
                    <span>{isAr ? 'قيد المراجعة' : 'Under Review'}</span>
                    {reviewedFeedbacks > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-black">
                        {reviewedFeedbacks}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setFeedbackSubTab('resolved')}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                      feedbackSubTab === 'resolved'
                        ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <CheckCircle2 size={15} />
                    <span>{isAr ? 'تم الرد عليها' : 'Resolved & Replied'}</span>
                    {resolvedFeedbacks > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-black">
                        {resolvedFeedbacks}
                      </span>
                    )}
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-zinc-400 w-3.5 h-3.5" />
                    <input
                      type="text"
                      value={feedbackSearch}
                      onChange={(e) => setFeedbackSearch(e.target.value)}
                      placeholder={isAr ? 'بحث في الشكاوى أو الطلاب أو الجامعات...' : 'Search feedback, students...'}
                      className="pl-9 rtl:pr-9 rtl:pl-3 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-64 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <select
                    value={suggestionTypeFilter}
                    onChange={(e) => setSuggestionTypeFilter(e.target.value)}
                    className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none text-zinc-800 dark:text-zinc-200"
                  >
                    <option value="all">{isAr ? 'كل التصنيفات' : 'All Categories'}</option>
                    <option value="suggestion">{isAr ? 'اقتراح وتطوير' : 'Suggestions'}</option>
                    <option value="complaint">{isAr ? 'شكاوى ومشاكل' : 'Complaints'}</option>
                    <option value="bug">{isAr ? 'أخطاء تقنية' : 'Bug Reports'}</option>
                    <option value="other">{isAr ? 'أخرى / استفسار' : 'Other'}</option>
                  </select>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredSuggestions.map((fb) => {
                  const student = studentsList.find(s => s.id === fb.userId);
                  
                  // Accurate student name resolution
                  let studentName = '';
                  if (student?.name && student.name !== 'طالب مسجل' && student.name !== 'Registered Student') {
                    studentName = student.name;
                  } else if (fb.userName && fb.userName !== 'طالب مسجل' && fb.userName !== 'Student' && fb.userName !== 'طالب') {
                    studentName = fb.userName;
                  } else if (student?.email && student.email !== 'لم يحدد بريد' && student.email !== 'No email' && student.email.includes('@')) {
                    studentName = student.email.split('@')[0];
                  } else if (fb.userEmail && fb.userEmail !== 'student@unistudent.com' && fb.userEmail.includes('@')) {
                    studentName = fb.userEmail.split('@')[0];
                  } else {
                    studentName = isAr ? 'طالب مسجل' : 'Registered Student';
                  }

                  // Accurate student email resolution
                  let studentEmail = '';
                  if (student?.email && student.email !== 'لم يحدد بريد' && student.email !== 'No email') {
                    studentEmail = student.email;
                  } else if (fb.userEmail && fb.userEmail !== 'student@unistudent.com') {
                    studentEmail = fb.userEmail;
                  } else {
                    studentEmail = isAr ? 'لم يحدد بريد' : 'No email';
                  }

                  const studentUni = (student?.university && student.university !== 'غير محدد') ? student.university : (isAr ? 'جامعة غير محددة' : 'Not specified');
                  const studentCollege = (student?.college && student.college !== 'غير محدد') ? student.college : '';
                  const studentCgpa = student?.cgpa !== undefined ? student.cgpa : 0;
                  const subjectsCount = student?.subjectsCount || 0;
                  const registeredHours = student?.registeredCreditHours || 0;
                  const passedHours = student?.passedCreditHours || 0;
                  const studentEvaluation = getAcademicEvaluation(studentCgpa, isAr);

                  return (
                    <div
                      key={fb.id}
                      onClick={() => {
                        setSelectedFeedback(fb);
                        setAdminNoteInput(fb.adminNotes || '');
                        setNoteSavedSuccess(false);
                      }}
                      className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700/60 transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative"
                    >
                      <div className="space-y-3.5">
                        {/* Header Badges with Interactive Category and Status Switcher */}
                        <div className="flex items-start justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Interactive Category Selector Pills */}
                            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
                              {(['complaint', 'suggestion', 'bug', 'other'] as const).map((tType) => (
                                <button
                                  key={tType}
                                  type="button"
                                  onClick={() => handleUpdateFeedbackType(fb.id, tType)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                    fb.type === tType
                                      ? (tType === 'complaint'
                                          ? 'bg-rose-600 text-white shadow-2xs'
                                          : tType === 'bug'
                                          ? 'bg-amber-600 text-white shadow-2xs'
                                          : tType === 'suggestion'
                                          ? 'bg-indigo-600 text-white shadow-2xs'
                                          : 'bg-zinc-700 text-white shadow-2xs')
                                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                  }`}
                                  title={isAr ? 'تغيير التصنيف فوراً' : 'Change category'}
                                >
                                  {tType === 'complaint' ? (isAr ? 'شكوى' : 'Complaint') : tType === 'bug' ? (isAr ? 'عطل' : 'Bug') : tType === 'suggestion' ? (isAr ? 'مقترح' : 'Suggestion') : (isAr ? 'أخرى' : 'Other')}
                                </button>
                              ))}
                            </div>

                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${
                              fb.status === 'resolved' 
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                                : fb.status === 'reviewed' 
                                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' 
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            }`}>
                              {fb.status === 'resolved' && <CheckCircle2 size={12} />}
                              {fb.status === 'reviewed' && <Clock size={12} />}
                              {fb.status === 'new' && <Inbox size={12} />}
                              <span>{fb.status === 'resolved' ? (isAr ? 'تم الرد والحل' : 'Resolved') : fb.status === 'reviewed' ? (isAr ? 'قيد المراجعة' : 'Under Review') : (isAr ? 'جديد (الوارد)' : 'New')}</span>
                            </span>
                          </div>

                          <span className="text-[11px] text-zinc-400 font-medium shrink-0">
                            {formatDateTime(fb.createdAt, isAr)}
                          </span>
                        </div>

                        {/* Student Profile Card Header */}
                        <div className="p-4 bg-gradient-to-r from-zinc-50 to-blue-50/40 dark:from-zinc-800/40 dark:to-blue-950/20 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                                {studentName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{studentName}</p>
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate dir-ltr text-right rtl:text-right">{studentEmail}</p>
                                <p className="text-[11px] text-zinc-400 truncate">{studentUni} {studentCollege && `• ${studentCollege}`}</p>
                              </div>
                            </div>

                            <div className="text-right rtl:text-left shrink-0">
                              <span className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black border ${
                                studentCgpa >= 3.5 
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' 
                                  : studentCgpa >= 2.0 
                                  ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800' 
                                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                              }`}>
                                {studentCgpa.toFixed(2)} CGPA
                              </span>
                              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                                {studentEvaluation}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/50 text-[11px] text-zinc-600 dark:text-zinc-300">
                            <div>
                              <span className="text-zinc-400">{isAr ? 'عدد الساعات: ' : 'Credit Hours: '}</span>
                              <span className="font-bold">{registeredHours} {isAr ? 'ساعة' : 'hrs'}</span>
                              {passedHours > 0 && <span className="text-[10px] text-zinc-400"> ({passedHours} {isAr ? 'مجتازة' : 'passed'})</span>}
                            </div>
                            <div>
                              <span className="text-zinc-400">{isAr ? 'عدد المواد: ' : 'Subjects: '}</span>
                              <span className="font-bold">{subjectsCount} {isAr ? 'مواد مسجلة' : 'courses'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Complaint / Message Title & Content */}
                        <div className="space-y-1.5">
                          <h4 className="font-bold text-base text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {fb.title}
                          </h4>
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed bg-zinc-50/70 dark:bg-zinc-800/30 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
                            {fb.content}
                          </p>
                        </div>

                        {/* Attachments & Admin Note Indicators */}
                        <div className="flex items-center gap-3 flex-wrap text-xs">
                          {fb.attachments && fb.attachments.length > 0 && (
                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold">
                              <Paperclip size={13} />
                              <span>{fb.attachments.length} {isAr ? 'مرفقات مرفوعة' : 'attachments'}</span>
                            </div>
                          )}
                          {fb.adminNotes && (
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                              <CheckCircle2 size={13} />
                              <span>{isAr ? 'تم تدوين رد/ملاحظة أدمن' : 'Admin replied'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedFeedback(fb);
                            setAdminNoteInput(fb.adminNotes || '');
                            setNoteSavedSuccess(false);
                          }}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800/60 transition-all flex items-center gap-1.5 shadow-2xs"
                        >
                          <Eye size={13} />
                          <span>{isAr ? 'عرض التفاصيل والمواد' : 'View Details & Courses'}</span>
                        </button>

                        {/* Instant Status Switcher Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {fb.status !== 'new' && (
                            <button
                              onClick={() => handleUpdateFeedbackStatus(fb.id, 'new')}
                              className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-[11px] font-bold rounded-xl border border-blue-200 dark:border-blue-800/40 transition-all"
                              title={isAr ? 'إرجاع للرئيسية (الوارد)' : 'Move to Inbox'}
                            >
                              {isAr ? 'إرجاع للرئيسية' : 'To Inbox'}
                            </button>
                          )}

                          {fb.status !== 'reviewed' && (
                            <button
                              onClick={() => handleUpdateFeedbackStatus(fb.id, 'reviewed')}
                              className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-[11px] font-bold rounded-xl border border-blue-200 dark:border-blue-800/40 transition-all"
                              title={isAr ? 'نقل لقيد المراجعة' : 'Move to Under Review'}
                            >
                              {isAr ? 'قيد المراجعة' : 'To Review'}
                            </button>
                          )}

                          {fb.status !== 'resolved' && (
                            <button
                              onClick={() => handleUpdateFeedbackStatus(fb.id, 'resolved')}
                              className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/40 transition-all"
                              title={isAr ? 'تم الرد والحل' : 'Mark as Resolved'}
                            >
                              {isAr ? 'تم الرد' : 'Resolve'}
                            </button>
                          )}

                          <button
                            onClick={() => setFeedbackToDelete(fb.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title={isAr ? 'حذف' : 'Delete'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredSuggestions.length === 0 && (
                  <div className="col-span-full py-16 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                    <MessageSquare size={48} className="mx-auto mb-3 opacity-30 text-zinc-500" />
                    <p className="font-bold text-sm text-zinc-600 dark:text-zinc-400">{isAr ? 'لا توجد مقترحات أو شكاوى في هذا القسم.' : 'No feedback found in this category.'}</p>
                    <p className="text-xs text-zinc-400 mt-1">{isAr ? 'يمكنك تغيير التبويب أو تصفية البحث.' : 'Try changing filters or search.'}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BACKUP & EMAIL SCHEDULER */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {backupMessage && (
                <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-2 ${
                  backupMessage.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300' 
                    : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300'
                }`}>
                  {backupMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <span>{backupMessage.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                      <Database size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                        {isAr ? 'تنزيل واستعادة النسخة الاحتياطية' : 'Full Backup & Restore'}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {isAr ? 'تنزيل ملف JSON كامل لكل جداول المنصة أو استعادته مباشرة' : 'Download or upload full database JSON backup directly'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-zinc-800 dark:text-zinc-200">{isAr ? 'تصدير نسخة احتياطية كاملة' : 'Export Full Snapshot'}</h4>
                        <p className="text-[11px] text-zinc-400">{isAr ? 'تنزيل كافة الإعدادات، المواد، المهام، والملاحظات' : 'All students data, settings, and files'}</p>
                      </div>
                      <button
                        onClick={handleExportBackup}
                        disabled={backupLoading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <Download size={14} />
                        <span>{backupLoading ? (isAr ? 'جاري التجهيز...' : 'Preparing...') : (isAr ? 'تنزيل JSON' : 'Export')}</span>
                      </button>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-zinc-800 dark:text-zinc-200">{isAr ? 'استعادة قاعدة البيانات' : 'Restore from Backup'}</h4>
                        <p className="text-[11px] text-zinc-400">{isAr ? 'رفع ملف JSON تم تصديره سابقاً لاسترجاعه' : 'Upload a previously exported JSON backup'}</p>
                      </div>
                      <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer">
                        <Upload size={14} />
                        <span>{isAr ? 'رفع واستعادة' : 'Upload JSON'}</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportBackup}
                          disabled={backupLoading}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                        {isAr ? 'جدولة إرسال النسخ الاحتياطية للإيميل' : 'Automated Email Backup Scheduler'}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {isAr ? 'حدد البريد وتوقيت الإرسال التلقائي للنسخة الاحتياطية' : 'Configure scheduled automated backup delivery to your email'}
                      </p>
                    </div>
                  </div>

                  {emailSaveSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                      <Check size={14} />
                      <span>{isAr ? 'تم حفظ إعدادات البريد والجدولة بنجاح!' : 'Email backup settings saved!'}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveEmailConfig} className="space-y-4">
                    {/* Sender Gmail Credentials */}
                    <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail size={15} className="text-blue-600 dark:text-blue-400" />
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                            {isAr ? 'بيانات بريد Gmail المرسل (Sender Gmail)' : 'Sender Gmail Configuration'}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowGoogleGuide(!showGoogleGuide)}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <HelpCircle size={13} />
                          <span>{isAr ? 'كيف تستخرج كلمة مرور التطبيقات؟' : 'How to get App Password?'}</span>
                        </button>
                      </div>

                      {/* Google App Password Guide Helper */}
                      {showGoogleGuide && (
                        <div className="p-3.5 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded-xl text-xs space-y-2 text-zinc-700 dark:text-zinc-300">
                          <p className="font-bold text-blue-600 dark:text-blue-400">
                            {isAr ? 'خطوات تفعيل إرسال الإيميل من حسابك الجيميل (في 30 ثانية):' : 'Steps to get your Gmail App Password (30 seconds):'}
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400 pr-1">
                            <li>{isAr ? 'ادخل على إعدادات حساب جوجل الخاص بك: myaccount.google.com' : 'Open your Google Account: myaccount.google.com'}</li>
                            <li>{isAr ? 'اضغط على قسم «الأمان (Security)» وتأكد من تفعيل «التحقق بخطوتين (2-Step Verification)».' : 'Go to Security and make sure 2-Step Verification is turned ON.'}</li>
                            <li>{isAr ? 'ابحث في شريط البحث بالأعلى عن «كلمات مرور التطبيقات (App Passwords)» أو ادخل عليها مباشرة.' : 'Search for "App Passwords" in the top search bar.'}</li>
                            <li>{isAr ? 'اكتب اسماً للتطبيق مثل "UniStudent OS" واضغط إنشاء، وانسخ الـ 16 حرفاً الناتجة وضعها في الحقل بالأسفل.' : 'Enter app name "UniStudent OS", generate password, copy the 16 characters and paste below.'}</li>
                          </ol>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                            {isAr ? 'بريد Gmail المرسل' : 'Sender Gmail Address'}
                          </label>
                          <input
                            type="email"
                            required
                            value={emailConfig.senderEmail || ''}
                            onChange={(e) => setEmailConfig({ ...emailConfig, senderEmail: e.target.value })}
                            placeholder="yourname@gmail.com"
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                            {isAr ? 'كلمة مرور التطبيقات (App Password)' : 'Gmail App Password (16 chars)'}
                          </label>
                          <div className="relative">
                            <input
                              type={showAppPassword ? 'text' : 'password'}
                              required
                              value={emailConfig.appPassword || ''}
                              onChange={(e) => setEmailConfig({ ...emailConfig, appPassword: e.target.value })}
                              placeholder="xxxx xxxx xxxx xxxx"
                              className="w-full px-3.5 py-2.5 pr-9 rtl:pr-3.5 rtl:pl-9 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAppPassword(!showAppPassword)}
                              className="absolute top-1/2 -translate-y-1/2 right-2.5 rtl:right-auto rtl:left-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                            >
                              {showAppPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Target / Recipient Email */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        {isAr ? 'البريد الإلكتروني المستلم للنسخة الاحتياطية' : 'Recipient Email Address (Where backups will be delivered)'}
                      </label>
                      <input
                        type="email"
                        required
                        value={emailConfig.targetEmail}
                        onChange={(e) => setEmailConfig({ ...emailConfig, targetEmail: e.target.value })}
                        placeholder="admin@example.com"
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Schedule Timing & Frequency */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          {isAr ? 'وتيرة الإرسال' : 'Frequency'}
                        </label>
                        <select
                          value={emailConfig.frequency}
                          onChange={(e) => setEmailConfig({ ...emailConfig, frequency: e.target.value as any })}
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none"
                        >
                          <option value="thursday">{isAr ? 'أسبوعياً كل يوم خميس (Every Thursday)' : 'Weekly (Every Thursday)'}</option>
                          <option value="daily">{isAr ? 'يومياً (Daily)' : 'Daily'}</option>
                          <option value="weekly">{isAr ? 'أسبوعياً (Weekly)' : 'Weekly'}</option>
                          <option value="monthly">{isAr ? 'شهرياً (Monthly)' : 'Monthly'}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          {isAr ? 'بدءاً من تاريخ' : 'Start Date'}
                        </label>
                        <input
                          type="date"
                          value={emailConfig.startDate}
                          onChange={(e) => setEmailConfig({ ...emailConfig, startDate: e.target.value })}
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          {isAr ? 'الساعة' : 'Time'}
                        </label>
                        <input
                          type="time"
                          value={emailConfig.startTime}
                          onChange={(e) => setEmailConfig({ ...emailConfig, startTime: e.target.value })}
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailConfig.enabled}
                          onChange={(e) => setEmailConfig({ ...emailConfig, enabled: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {isAr ? 'تفعيل الإرسال المجدول تلقائياً' : 'Enable Automated Schedule'}
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={backupLoading}
                          onClick={handleSendBackupEmailNow}
                          className="px-3.5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          {backupLoading ? <Loader2 size={13} className="animate-spin text-blue-600" /> : <Send size={13} />}
                          <span>{backupLoading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال تجريبي الآن' : 'Send Test Now')}</span>
                        </button>

                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          {isAr ? 'حفظ الإعدادات والجدولة' : 'Save Settings'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- STUDENT DETAILS MODAL --- */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-7 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-black text-xl flex items-center justify-center">
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{selectedStudent.name}</h3>
                  <p className="text-xs text-zinc-400">{selectedStudent.email} • {selectedStudent.university} ({selectedStudent.college})</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 text-center">
                <span className="text-[10px] text-zinc-400 block font-medium">{isAr ? 'المعدل التراكمي CGPA' : 'CGPA'}</span>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">{selectedStudent.cgpa.toFixed(2)}</span>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 text-center">
                <span className="text-[10px] text-zinc-400 block font-medium">{isAr ? 'الساعات المعتمدة' : 'Credits'}</span>
                <span className="text-xl font-black text-zinc-800 dark:text-zinc-200">{selectedStudent.registeredCreditHours}</span>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 text-center">
                <span className="text-[10px] text-zinc-400 block font-medium">{isAr ? 'عدد المواد' : 'Subjects'}</span>
                <span className="text-xl font-black text-zinc-800 dark:text-zinc-200">{selectedStudent.subjectsCount}</span>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 text-center">
                <span className="text-[10px] text-zinc-400 block font-medium">{isAr ? 'الإنذارات' : 'Warnings'}</span>
                <span className={`text-xl font-black ${selectedStudent.warningCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {selectedStudent.warningCount}
                </span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-3 flex items-center gap-2">
                <BookOpen size={16} />
                <span>{isAr ? 'المواد الدراسية المسجلة للطالب' : 'Registered Subjects'}</span>
              </h4>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {selectedStudent.raw.subjects.map((sub: any) => {
                  const gr = calculateSubjectGrade(sub, selectedStudent.raw.settings.grading_scale || settings.gradingScale || []);
                  return (
                    <div
                      key={sub.id}
                      className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{sub.name}</p>
                        <p className="text-[10px] text-zinc-400">{sub.code} • {sub.credit_hours} {isAr ? 'ساعات' : 'credits'}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-500">
                          {gr?.totalAchieved || 0} / {sub.total_marks} ({Math.round(gr?.percentage || 0)}%)
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-black">
                          {gr?.letter || 'F'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {selectedStudent.raw.subjects.length === 0 && (
                  <p className="text-center py-6 text-xs text-zinc-400">{isAr ? 'لا توجد مواد مسجلة لهذا الطالب.' : 'No subjects registered.'}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DETAILED FEEDBACK & STUDENT COURSES MODAL --- */}
      {selectedFeedback && (() => {
        const student = studentsList.find(s => s.id === selectedFeedback.userId);
        
        let studentName = '';
        if (student?.name && student.name !== 'طالب مسجل' && student.name !== 'Registered Student') {
          studentName = student.name;
        } else if (selectedFeedback.userName && selectedFeedback.userName !== 'طالب مسجل' && selectedFeedback.userName !== 'Student' && selectedFeedback.userName !== 'طالب') {
          studentName = selectedFeedback.userName;
        } else if (student?.email && student.email !== 'لم يحدد بريد' && student.email !== 'No email' && student.email.includes('@')) {
          studentName = student.email.split('@')[0];
        } else if (selectedFeedback.userEmail && selectedFeedback.userEmail !== 'student@unistudent.com' && selectedFeedback.userEmail.includes('@')) {
          studentName = selectedFeedback.userEmail.split('@')[0];
        } else {
          studentName = isAr ? 'طالب مسجل' : 'Registered Student';
        }

        let studentEmail = '';
        if (student?.email && student.email !== 'لم يحدد بريد' && student.email !== 'No email') {
          studentEmail = student.email;
        } else if (selectedFeedback.userEmail && selectedFeedback.userEmail !== 'student@unistudent.com') {
          studentEmail = selectedFeedback.userEmail;
        } else {
          studentEmail = isAr ? 'لم يحدد بريد' : 'No email';
        }

        const studentUni = (student?.university && student.university !== 'غير محدد') ? student.university : (isAr ? 'جامعة غير محددة' : 'Not specified');
        const studentCollege = (student?.college && student.college !== 'غير محدد') ? student.college : '';
        const studentCgpa = student?.cgpa !== undefined ? student.cgpa : 0;
        const studentSubjects: any[] = student?.raw?.subjects || [];
        const gradingScale = student?.raw?.settings?.grading_scale || settings.gradingScale || [];
        const studentEvaluation = getAcademicEvaluation(studentCgpa, isAr);
        const registeredHours = student?.registeredCreditHours || 0;
        const passedHours = student?.passedCreditHours || 0;

        const handleSaveAdminNote = async () => {
          try {
            setSavingNote(true);
            await db.updateFeedback(selectedFeedback.id, { adminNotes: adminNoteInput });
            setSelectedFeedback((prev: any) => prev ? { ...prev, adminNotes: adminNoteInput } : null);
            setAdminData(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                feedbacks: prev.feedbacks.map(f => f.id === selectedFeedback.id ? { ...f, adminNotes: adminNoteInput } : f)
              };
            });
            setNoteSavedSuccess(true);
            setTimeout(() => setNoteSavedSuccess(false), 2500);
          } catch (e) {
            console.error('Failed to save note:', e);
          } finally {
            setSavingNote(false);
          }
        };

        const handlePreviewAttachment = async (att: any) => {
          try {
            const { previewFile } = await import('../lib/backblaze');
            await previewFile(att);
          } catch (e) {
            if (att.url) window.open(att.url, '_blank');
          }
        };

        const handleDownloadAttachment = async (att: any) => {
          try {
            const { downloadFile } = await import('../lib/backblaze');
            await downloadFile(att);
          } catch (e) {
            if (att.url) window.open(att.url, '_blank');
          }
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 sm:p-7 space-y-6">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Category Selector */}
                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                      <span className="text-[10px] font-bold text-zinc-400 px-1.5">{isAr ? 'التصنيف:' : 'Type:'}</span>
                      {(['complaint', 'suggestion', 'bug', 'other'] as const).map((tType) => (
                        <button
                          key={tType}
                          onClick={() => handleUpdateFeedbackType(selectedFeedback.id, tType)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                            selectedFeedback.type === tType
                              ? (tType === 'complaint' 
                                  ? 'bg-rose-600 text-white shadow-xs' 
                                  : tType === 'bug' 
                                  ? 'bg-amber-600 text-white shadow-xs' 
                                  : tType === 'suggestion' 
                                  ? 'bg-indigo-600 text-white shadow-xs' 
                                  : 'bg-zinc-700 text-white shadow-xs')
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          {tType === 'complaint' ? (isAr ? 'شكوى' : 'Complaint') : tType === 'bug' ? (isAr ? 'عطل تقني' : 'Bug') : tType === 'suggestion' ? (isAr ? 'اقتراح' : 'Suggestion') : (isAr ? 'أخرى' : 'Other')}
                        </button>
                      ))}
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase flex items-center gap-1 ${
                      selectedFeedback.status === 'resolved'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : selectedFeedback.status === 'reviewed'
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    }`}>
                      {selectedFeedback.status === 'resolved' && <CheckCircle2 size={12} />}
                      {selectedFeedback.status === 'reviewed' && <Clock size={12} />}
                      {selectedFeedback.status === 'new' && <Inbox size={12} />}
                      <span>{selectedFeedback.status === 'resolved' ? (isAr ? 'تم الحل والرد' : 'Resolved') : selectedFeedback.status === 'reviewed' ? (isAr ? 'قيد المراجعة' : 'Under Review') : (isAr ? 'جديد (الوارد)' : 'New')}</span>
                    </span>

                    <span className="text-xs text-zinc-400">
                      {formatDateTime(selectedFeedback.createdAt, isAr)}
                    </span>
                  </div>

                  <h3 className="font-black text-lg sm:text-xl text-zinc-900 dark:text-white">
                    {selectedFeedback.title}
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Student Overview Profile */}
              <div className="p-4 bg-gradient-to-br from-blue-500/10 via-zinc-50 dark:via-zinc-800/50 to-blue-500/5 rounded-3xl border border-blue-200/60 dark:border-blue-900/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                      {studentName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-base text-zinc-900 dark:text-white">{studentName}</h4>
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 dir-ltr text-right rtl:text-right">{studentEmail}</p>
                      <p className="text-xs text-zinc-400">{studentUni} {studentCollege && `• ${studentCollege}`}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-3.5 py-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 text-center shadow-2xs">
                      <span className="text-[10px] text-zinc-400 block font-medium">{isAr ? 'المعدل التراكمي' : 'CGPA'}</span>
                      <span className="text-base font-black text-blue-600 dark:text-blue-400">{studentCgpa.toFixed(2)}</span>
                    </div>

                    <div className="px-3.5 py-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 text-center shadow-2xs">
                      <span className="text-[10px] text-zinc-400 block font-medium">{isAr ? 'التقدير العام' : 'Evaluation'}</span>
                      <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">{studentEvaluation}</span>
                    </div>

                    <div className="px-3.5 py-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 text-center shadow-2xs">
                      <span className="text-[10px] text-zinc-400 block font-medium">{isAr ? 'الساعات المسجلة' : 'Credit Hours'}</span>
                      <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">{registeredHours} ({passedHours} {isAr ? 'مجتازة' : 'passed'})</span>
                    </div>

                    <div className="px-3.5 py-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 text-center shadow-2xs">
                      <span className="text-[10px] text-zinc-400 block font-medium">{isAr ? 'المواد المسجلة' : 'Subjects'}</span>
                      <span className="text-base font-black text-zinc-800 dark:text-zinc-200">{studentSubjects.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Details & Attachments */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                  <MessageSquare size={16} className="text-blue-500" />
                  <span>{isAr ? 'شرح وتفاصيل الرسالة بالكامل:' : 'Full Message Details & Description:'}</span>
                </h4>
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {selectedFeedback.content}
                </div>

                {/* Uploaded Attachments */}
                {selectedFeedback.attachments && selectedFeedback.attachments.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h5 className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                      <Paperclip size={14} className="text-blue-500" />
                      <span>{isAr ? 'الملفات المرفقة مع الطلب:' : 'Attached Files:'}</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedFeedback.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-3 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={16} className="text-blue-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200 truncate">{att.name}</p>
                              <p className="text-[10px] text-zinc-400">{Math.round(att.size / 1024)} KB</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handlePreviewAttachment(att)}
                              className="p-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title={isAr ? 'معاينة في نافذة جديدة' : 'Preview'}
                            >
                              <ExternalLink size={12} />
                              <span>{isAr ? 'معاينة' : 'View'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(att)}
                              className="p-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs cursor-pointer transition-colors"
                              title={isAr ? 'تنزيل' : 'Download'}
                            >
                              <Download size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Student's Current Registered Courses with Detailed Breakdown */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BookOpen size={16} className="text-blue-500" />
                    <span>{isAr ? 'مواد الطالب وتفاصيل تقسيم الدرجات في كل مادة:' : 'Student Courses & Grading Breakdown:'}</span>
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">
                    {studentSubjects.length} {isAr ? 'مادة مسجلة' : 'subjects'}
                  </span>
                </h4>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {studentSubjects.map((sub: any) => {
                    const gr = calculateSubjectGrade(sub, gradingScale);
                    return (
                      <div
                        key={sub.id}
                        className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm text-zinc-900 dark:text-white">{sub.name}</p>
                            <p className="text-[11px] text-zinc-400">
                              {sub.code} • {sub.credit_hours || sub.creditHours} {isAr ? 'ساعات معتمدة' : 'credits'} • {sub.total_marks || sub.totalMarks} {isAr ? 'درجة إجمالية' : 'total marks'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-zinc-600 dark:text-zinc-300">
                              {gr?.totalAchieved || 0} / {sub.total_marks || sub.totalMarks} ({Math.round(gr?.percentage || 0)}%)
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-black text-xs">
                              {gr?.letter || 'F'}
                            </span>
                          </div>
                        </div>

                        {/* Distributions Breakdown */}
                        {sub.distributions && sub.distributions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-200/50 dark:border-zinc-700/40">
                            {sub.distributions.map((d: any, idx: number) => (
                              <div
                                key={idx}
                                className="px-2.5 py-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700/60 text-[11px] flex items-center gap-1.5 shadow-2xs"
                              >
                                <span className="font-bold text-zinc-700 dark:text-zinc-300">{d.name}:</span>
                                <span className="font-black text-blue-600 dark:text-blue-400">
                                  {d.achievedMarks !== null && d.achievedMarks !== undefined ? d.achievedMarks : '-'} / {d.maxMarks}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold ${
                                  d.status === 'final' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                }`}>
                                  {d.status === 'final' ? (isAr ? 'نهائي' : 'Final') : (isAr ? 'أعمال سنة/حالي' : 'Current')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {studentSubjects.length === 0 && (
                    <p className="text-center py-6 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl">
                      {isAr ? 'لا توجد مواد مسجلة لهذا الطالب حالياً.' : 'No courses registered.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Admin Note / Response Box & Status Updates */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{isAr ? 'تغيير حالة الطلب والتنقل بين الأقسام:' : 'Update Ticket Status:'}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateFeedbackStatus(selectedFeedback.id, 'new')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedFeedback.status === 'new'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-blue-100'
                      }`}
                    >
                      {isAr ? 'جديد (الرئيسية)' : 'Set New'}
                    </button>

                    <button
                      onClick={() => handleUpdateFeedbackStatus(selectedFeedback.id, 'reviewed')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedFeedback.status === 'reviewed'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-blue-100'
                      }`}
                    >
                      {isAr ? 'قيد المراجعة' : 'In Review'}
                    </button>

                    <button
                      onClick={() => handleUpdateFeedbackStatus(selectedFeedback.id, 'resolved')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedFeedback.status === 'resolved'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-100'
                      }`}
                    >
                      {isAr ? 'تم الرد والحل' : 'Mark Resolved'}
                    </button>
                  </div>
                </div>

                {/* Admin Note Input */}
                <div className="space-y-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/40">
                  <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 flex items-center justify-between">
                    <span>{isAr ? 'ملاحظة الإدارة أو نص الرد الداخلي:' : 'Admin Notes & Internal Reply:'}</span>
                    {noteSavedSuccess && (
                      <span className="text-emerald-600 text-[11px] font-bold flex items-center gap-1">
                        <CheckCircle2 size={13} /> {isAr ? 'تم الحفظ بنجاح!' : 'Saved successfully!'}
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={adminNoteInput}
                      onChange={(e) => setAdminNoteInput(e.target.value)}
                      placeholder={isAr ? 'اكتب ملاحظة أو رداً هنا...' : 'Type admin notes or reply...'}
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                    />
                    <button
                      onClick={handleSaveAdminNote}
                      disabled={savingNote}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      {savingNote ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الملاحظة' : 'Save Note')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => {
                    const id = selectedFeedback.id;
                    setSelectedFeedback(null);
                    setFeedbackToDelete(id);
                  }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800/50 transition-all flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>{isAr ? 'حذف الشكوى' : 'Delete Feedback'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${studentEmail}?subject=${encodeURIComponent(`رد إدارة UniStudent بخصوص: ${selectedFeedback.title}`)}&body=${encodeURIComponent(`مرحباً ${studentName}،\n\nبخصوص طلبك/شكوتك بعنوان "${selectedFeedback.title}":\n\n`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2"
                  >
                    <Mail size={14} />
                    <span>{isAr ? 'الرد على الطالب عبر البريد' : 'Reply via Email'}</span>
                  </a>

                  <button
                    onClick={() => setSelectedFeedback(null)}
                    className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl transition-all"
                  >
                    {isAr ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Feedback Confirmation Modal */}
      <ConfirmModal
        isOpen={!!feedbackToDelete}
        title={isAr ? 'حذف المقترح' : 'Delete Feedback'}
        message={isAr ? 'هل أنت متأكد من رغبتك في حذف هذا المقترح نهائياً؟' : 'Are you sure you want to permanently delete this feedback?'}
        confirmText={isAr ? 'نعم، حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={handleDeleteFeedbackConfirmed}
        onCancel={() => setFeedbackToDelete(null)}
      />
    </div>
  );
}
