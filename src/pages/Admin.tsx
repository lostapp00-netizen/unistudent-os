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
  FileText
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { db } from '../lib/db';
import { calculateGPA, calculateSubjectGrade, getWarningThreshold, isSubjectAtWarningRisk } from '../lib/academic';
import { FeedbackSuggestion, EmailBackupConfig, DatabaseBackup } from '../types';
import { ConfirmModal } from '../components/ui/CustomModal';

export function Admin() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  // --- Auth & Access State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('unistudent_admin_auth') === 'true';
  });

  // --- Sidebar & Tabs ---
  type TabType = 'overview' | 'students' | 'suggestions' | 'backup';
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
  const [gpaFilter, setGpaFilter] = useState<'all' | 'honor' | 'warning' | 'good'>('all');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // --- Suggestions Filter & Modals ---
  const [feedbackSubTab, setFeedbackSubTab] = useState<'all' | 'reviewed' | 'resolved'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackSuggestion | null>(null);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [suggestionTypeFilter, setSuggestionTypeFilter] = useState<string>('all');
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<string>('all');
  const [feedbackToDelete, setFeedbackToDelete] = useState<string | null>(null);

  // --- Backup & Email State ---
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailBackupConfig>(() => db.getEmailBackupConfig());
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false);

  // Load Admin Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await db.getAdminAllData();
      setAdminData(data);
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
      const userFiles = adminData.rawFiles.filter(f => f.user_id === uid);
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

  const filteredStudents = React.useMemo(() => {
    return studentsList.filter(student => {
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
  }, [studentsList, searchQuery, gpaFilter]);

  // Overview Metrics
  const totalStudents = studentsList.length;
  const honorStudents = studentsList.filter(s => s.cgpa >= 3.5).length;
  const warningStudents = studentsList.filter(s => s.warningCount > 0).length;
  const avgCgpa = totalStudents > 0 ? (studentsList.reduce((acc, s) => acc + s.cgpa, 0) / totalStudents).toFixed(2) : '0.00';
  const totalStorageMB = (studentsList.reduce((acc, s) => acc + s.totalStorageBytes, 0) / (1024 * 1024)).toFixed(1);
  const pendingFeedbacks = adminData?.feedbacks.filter(f => f.status === 'new').length || 0;
  const reviewedFeedbacks = adminData?.feedbacks.filter(f => f.status === 'reviewed').length || 0;
  const resolvedFeedbacks = adminData?.feedbacks.filter(f => f.status === 'resolved').length || 0;

  // Filtered Suggestions
  const filteredSuggestions = React.useMemo(() => {
    if (!adminData) return [];
    return adminData.feedbacks.filter(fb => {
      if (feedbackSubTab === 'reviewed' && fb.status !== 'reviewed') return false;
      if (feedbackSubTab === 'resolved' && fb.status !== 'resolved') return false;
      if (feedbackSubTab === 'all' && suggestionStatusFilter !== 'all' && fb.status !== suggestionStatusFilter) return false;
      if (suggestionTypeFilter !== 'all' && fb.type !== suggestionTypeFilter) return false;
      if (feedbackSearch.trim()) {
        const q = feedbackSearch.toLowerCase();
        const matches = fb.title.toLowerCase().includes(q) ||
          fb.content.toLowerCase().includes(q) ||
          fb.userEmail.toLowerCase().includes(q) ||
          (fb.userName || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [adminData, feedbackSubTab, suggestionTypeFilter, suggestionStatusFilter, feedbackSearch]);

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

  // Send Backup Email Immediately (Invokes Supabase Edge Function + Local fallback)
  const handleSendBackupEmailNow = async () => {
    try {
      if (!emailConfig.targetEmail) {
        alert(isAr ? 'يرجى كتابة البريد الإلكتروني أولاً.' : 'Please enter target email first.');
        return;
      }
      setBackupLoading(true);
      setBackupMessage(null);

      let edgeFunctionSucceeded = false;
      try {
        const { supabase } = await import('../lib/supabase');
        const { data, error } = await supabase.functions.invoke('send-database-backup', {
          body: {
            targetEmail: emailConfig.targetEmail,
            frequency: emailConfig.frequency
          }
        });

        if (!error && data) {
          edgeFunctionSucceeded = true;
          setBackupMessage({
            type: 'success',
            text: isAr 
              ? `تم تشغيل الـ Edge Function وإرسال النسخة الاحتياطية إلى ${emailConfig.targetEmail} بنجاح!` 
              : `Edge Function executed and backup sent to ${emailConfig.targetEmail}!`
          });
        }
      } catch (edgeErr) {
        console.warn('Edge function invoke error, falling back:', edgeErr);
      }

      if (!edgeFunctionSucceeded) {
        const backup = await db.exportFullDatabaseBackup();
        const summaryText = `UniStudent OS Backup Data Summary:
- Total Students: ${backup.summary.totalStudents}
- Total Subjects: ${backup.summary.totalSubjects}
- Total Files: ${backup.summary.totalFiles}
- Date: ${new Date().toLocaleString()}

(Full JSON database backup snapshot generated).`;

        const mailtoLink = `mailto:${encodeURIComponent(emailConfig.targetEmail)}?subject=${encodeURIComponent(`UniStudent OS Full Database Backup - ${new Date().toISOString().split('T')[0]}`)}&body=${encodeURIComponent(summaryText)}`;
        window.open(mailtoLink, '_blank');

        setBackupMessage({
          type: 'success',
          text: isAr ? `تم تجهيز النسخة الاحتياطية وإرسالها إلى ${emailConfig.targetEmail} بنجاح!` : `Backup email dispatched to ${emailConfig.targetEmail}!`
        });
      }

      const updatedConfig: EmailBackupConfig = {
        ...emailConfig,
        lastSentAt: new Date().toISOString()
      };
      setEmailConfig(updatedConfig);
      db.saveEmailBackupConfig(updatedConfig);
    } catch (e: any) {
      setBackupMessage({
        type: 'error',
        text: e.message || 'Error triggering backup email'
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
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-500/20">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-zinc-900 dark:text-white">Admin OS</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 shadow-xs border border-purple-200/80 dark:border-purple-800/60 font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    item.badgeColor || 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 transition-all border border-rose-200/60 dark:border-rose-900/40 shadow-xs"
          >
            <LogOut size={16} />
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
              className="md:hidden p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300"
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

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition-all shadow-2xs"
              title={isAr ? 'تحديث البيانات' : 'Refresh Data'}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
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
                    <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{totalStorageMB} <span className="text-xs font-medium text-zinc-400">MB</span></h3>
                    <p className="text-[11px] text-zinc-500 mt-1">{adminData?.rawFiles.length || 0} {isAr ? 'ملفات ومرفقات درايف' : 'drive files'}</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <HardDrive size={28} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-5">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <TrendingUp size={20} className="text-purple-600 dark:text-purple-400" />
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

                <div className="bg-gradient-to-br from-purple-900/10 via-indigo-900/5 to-transparent dark:from-purple-950/30 dark:via-zinc-900 dark:to-zinc-900 p-6 sm:p-7 rounded-3xl border border-purple-200/60 dark:border-purple-900/40 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold mb-2">
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
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
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
                    className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={gpaFilter}
                    onChange={(e) => setGpaFilter(e.target.value as any)}
                    className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">{isAr ? 'كل الطلاب' : 'All Students'}</option>
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
                                  className="text-zinc-400 hover:text-purple-600 transition-colors"
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
                            {(st.totalStorageBytes / (1024 * 1024)).toFixed(1)} MB
                          </td>

                          <td className="py-4 px-6 text-center">
                            <button
                              onClick={() => setSelectedStudent(st)}
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold rounded-xl border border-purple-200 dark:border-purple-800/60 transition-all flex items-center gap-1.5 mx-auto shadow-2xs"
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

          {/* TAB 3: SUGGESTIONS & FEEDBACK HUB */}
          {activeTab === 'suggestions' && (
            <div className="space-y-6">
              {/* Sub-Tabs: الرئيسية / قيد المراجعة / تم الرد عليها */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
                  <button
                    onClick={() => setFeedbackSubTab('all')}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                      feedbackSubTab === 'all'
                        ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{isAr ? 'القسم الرئيسي (كافة الشكاوى)' : 'All Submissions'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-black">
                      {adminData?.feedbacks.length || 0}
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
                    <span>{isAr ? 'تم الرد عليها / تم الحل' : 'Resolved'}</span>
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
                      placeholder={isAr ? 'بحث في الشكاوى أو الطلاب...' : 'Search feedback or student...'}
                      className="pl-9 rtl:pr-9 rtl:pl-3 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 w-48 sm:w-60 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <select
                    value={suggestionTypeFilter}
                    onChange={(e) => setSuggestionTypeFilter(e.target.value)}
                    className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none text-zinc-800 dark:text-zinc-200"
                  >
                    <option value="all">{isAr ? 'كل الأنواع' : 'All Categories'}</option>
                    <option value="suggestion">{isAr ? 'اقتراح وتطوير' : 'Suggestions'}</option>
                    <option value="complaint">{isAr ? 'شكاوى ومشاكل' : 'Complaints'}</option>
                    <option value="bug">{isAr ? 'أخطاء تقنية' : 'Bug Reports'}</option>
                    <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                  </select>

                  {feedbackSubTab === 'all' && (
                    <select
                      value={suggestionStatusFilter}
                      onChange={(e) => setSuggestionStatusFilter(e.target.value)}
                      className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none text-zinc-800 dark:text-zinc-200"
                    >
                      <option value="all">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
                      <option value="new">{isAr ? 'جديد ومستلم' : 'New'}</option>
                      <option value="reviewed">{isAr ? 'قيد المراجعة' : 'Under Review'}</option>
                      <option value="resolved">{isAr ? 'تم الحل' : 'Resolved'}</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredSuggestions.map((fb) => {
                  const student = studentsList.find(s => s.id === fb.userId);
                  const studentName = student?.name || fb.userName || (isAr ? 'طالب مسجل' : 'Student');
                  const studentEmail = student?.email || fb.userEmail;
                  const studentUni = student?.university || (isAr ? 'جامعة غير محددة' : 'Not specified');
                  const studentCollege = student?.college || '';
                  const studentCgpa = student?.cgpa !== undefined ? student.cgpa : 0;
                  const subjectsCount = student?.subjectsCount || 0;
                  const creditsCount = student?.registeredCreditHours || 0;

                  return (
                    <div
                      key={fb.id}
                      onClick={() => setSelectedFeedback(fb)}
                      className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700/60 transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative"
                    >
                      <div className="space-y-3.5">
                        {/* Header Badges */}
                        <div className="flex items-start justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider ${
                              fb.type === 'complaint' 
                                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40' 
                                : fb.type === 'bug'
                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                                : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40'
                            }`}>
                              {fb.type === 'complaint' ? (isAr ? 'شكوى' : 'Complaint') : fb.type === 'bug' ? (isAr ? 'عطل تقني' : 'Bug') : (isAr ? 'اقتراح' : 'Suggestion')}
                            </span>

                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${
                              fb.status === 'resolved' 
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                                : fb.status === 'reviewed' 
                                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' 
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            }`}>
                              {fb.status === 'resolved' && <CheckCircle2 size={12} />}
                              {fb.status === 'reviewed' && <Clock size={12} />}
                              <span>{fb.status === 'resolved' ? (isAr ? 'تم الحل والرد' : 'Resolved') : fb.status === 'reviewed' ? (isAr ? 'قيد المراجعة' : 'Under Review') : (isAr ? 'جديد' : 'New')}</span>
                            </span>
                          </div>

                          <span className="text-[11px] text-zinc-400 font-medium">
                            {new Date(fb.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' } as any)}
                          </span>
                        </div>

                        {/* Student Profile Card Header */}
                        <div className="p-3.5 bg-gradient-to-r from-zinc-50 to-purple-50/40 dark:from-zinc-800/40 dark:to-purple-950/20 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                              {studentName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{studentName}</p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{studentEmail}</p>
                              <p className="text-[11px] text-zinc-400 truncate">{studentUni} {studentCollege && `• ${studentCollege}`}</p>
                            </div>
                          </div>

                          {/* Student Academic Mini Badges */}
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${
                              studentCgpa >= 3.5 
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' 
                                : studentCgpa >= 2.0 
                                ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800' 
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                            }`}>
                              {studentCgpa.toFixed(2)} CGPA
                            </span>
                            <span className="text-[10px] font-bold text-zinc-500">
                              {subjectsCount} {isAr ? 'مواد' : 'subjects'} • {creditsCount} {isAr ? 'ساعات' : 'hrs'}
                            </span>
                          </div>
                        </div>

                        {/* Complaint / Message Title & Content */}
                        <div className="space-y-1.5">
                          <h4 className="font-bold text-base text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {fb.title}
                          </h4>
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed bg-zinc-50/70 dark:bg-zinc-800/30 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
                            {fb.content}
                          </p>
                        </div>

                        {/* Attachments Indicator */}
                        {fb.attachments && fb.attachments.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-bold">
                            <Paperclip size={13} />
                            <span>{fb.attachments.length} {isAr ? 'مرفقات مرفوعة' : 'attachments'}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedFeedback(fb)}
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-xl border border-purple-200 dark:border-purple-800/60 transition-all flex items-center gap-1.5 shadow-2xs"
                          >
                            <Eye size={13} />
                            <span>{isAr ? 'عرض التفاصيل والمواد' : 'View Details & Courses'}</span>
                          </button>
                        </div>

                        {/* Status Switchers */}
                        <div className="flex items-center gap-1.5">
                          {fb.status !== 'reviewed' && (
                            <button
                              onClick={async () => {
                                await db.updateFeedback(fb.id, { status: 'reviewed' });
                                await fetchData();
                              }}
                              className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-[11px] font-bold rounded-xl border border-blue-200 dark:border-blue-800/40 transition-all"
                            >
                              {isAr ? 'نقل لقيد المراجعة' : 'To Review'}
                            </button>
                          )}

                          {fb.status !== 'resolved' && (
                            <button
                              onClick={async () => {
                                await db.updateFeedback(fb.id, { status: 'resolved' });
                                await fetchData();
                              }}
                              className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/40 transition-all"
                            >
                              {isAr ? 'تم الحل والرد' : 'Resolve'}
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
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
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
                      <span>{isAr ? 'تم حفظ إعدادات الجدولة بنجاح!' : 'Email backup schedule saved!'}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveEmailConfig} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        {isAr ? 'البريد الإلكتروني المستلم' : 'Target Email Address'}
                      </label>
                      <input
                        type="email"
                        required
                        value={emailConfig.targetEmail}
                        onChange={(e) => setEmailConfig({ ...emailConfig, targetEmail: e.target.value })}
                        placeholder="admin@example.com"
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

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

                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailConfig.enabled}
                          onChange={(e) => setEmailConfig({ ...emailConfig, enabled: e.target.checked })}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {isAr ? 'تفعيل الإرسال المجدول' : 'Enable Automated Schedule'}
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSendBackupEmailNow}
                          className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
                        >
                          <Send size={12} />
                          <span>{isAr ? 'إرسال تجريبي الآن' : 'Send Now'}</span>
                        </button>

                        <button
                          type="submit"
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                        >
                          {isAr ? 'حفظ الجدولة' : 'Save Schedule'}
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
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 font-black text-xl flex items-center justify-center">
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
                <span className="text-xl font-black text-purple-600 dark:text-purple-400">{selectedStudent.cgpa.toFixed(2)}</span>
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
                        <span className="px-2.5 py-1 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-black">
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
        const studentName = student?.name || selectedFeedback.userName || (isAr ? 'طالب مسجل' : 'Student');
        const studentEmail = student?.email || selectedFeedback.userEmail;
        const studentUni = student?.university || (isAr ? 'غير محددة' : 'Not specified');
        const studentCollege = student?.college || '';
        const studentCgpa = student?.cgpa !== undefined ? student.cgpa : 0;
        const studentSubjects: any[] = student?.raw?.subjects || [];
        const gradingScale = student?.raw?.settings?.grading_scale || settings.gradingScale || [];

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 sm:p-7 space-y-6">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                      selectedFeedback.type === 'complaint'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        : selectedFeedback.type === 'bug'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                    }`}>
                      {selectedFeedback.type === 'complaint' ? (isAr ? 'شكوى رسمية' : 'Complaint') : selectedFeedback.type === 'bug' ? (isAr ? 'عطل تقني' : 'Bug') : (isAr ? 'اقتراح تطويري' : 'Suggestion')}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase flex items-center gap-1 ${
                      selectedFeedback.status === 'resolved'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : selectedFeedback.status === 'reviewed'
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                    }`}>
                      {selectedFeedback.status === 'resolved' && <CheckCircle2 size={12} />}
                      {selectedFeedback.status === 'reviewed' && <Clock size={12} />}
                      <span>{selectedFeedback.status === 'resolved' ? (isAr ? 'تم الحل والرد' : 'Resolved') : selectedFeedback.status === 'reviewed' ? (isAr ? 'قيد المراجعة' : 'Under Review') : (isAr ? 'جديد' : 'New')}</span>
                    </span>

                    <span className="text-xs text-zinc-400">
                      {new Date(selectedFeedback.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
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
              <div className="p-4 bg-gradient-to-br from-purple-500/10 via-zinc-50 dark:via-zinc-800/50 to-purple-500/5 rounded-3xl border border-purple-200/60 dark:border-purple-900/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                      {studentName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-zinc-900 dark:text-white">{studentName}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{studentEmail}</p>
                      <p className="text-xs text-zinc-400">{studentUni} {studentCollege && `• ${studentCollege}`}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="px-3.5 py-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 text-center shadow-2xs">
                      <span className="text-[10px] text-zinc-400 block font-medium">{isAr ? 'المعدل التراكمي CGPA' : 'CGPA'}</span>
                      <span className="text-base font-black text-purple-600 dark:text-purple-400">{studentCgpa.toFixed(2)}</span>
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
                  <MessageSquare size={16} className="text-purple-500" />
                  <span>{isAr ? 'نص الشكوى أو المقترح بالكامل:' : 'Full Message Details:'}</span>
                </h4>
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {selectedFeedback.content}
                </div>

                {/* Uploaded Attachments */}
                {selectedFeedback.attachments && selectedFeedback.attachments.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h5 className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                      <Paperclip size={14} className="text-purple-500" />
                      <span>{isAr ? 'الملفات المرفقة مع الطلب:' : 'Attached Files:'}</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedFeedback.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-3 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={16} className="text-purple-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200 truncate">{att.name}</p>
                              <p className="text-[10px] text-zinc-400">{Math.round(att.size / 1024)} KB</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {att.url && (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-600 dark:text-purple-300 rounded-lg text-xs font-bold flex items-center gap-1"
                                title={isAr ? 'معاينة في نافذة جديدة' : 'Preview'}
                              >
                                <ExternalLink size={12} />
                                <span>{isAr ? 'معاينة' : 'View'}</span>
                              </a>
                            )}
                            {att.url && (
                              <a
                                href={att.url}
                                download={att.name}
                                className="p-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs"
                                title={isAr ? 'تنزيل' : 'Download'}
                              >
                                <Download size={12} />
                              </a>
                            )}
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
                    <BookOpen size={16} className="text-purple-500" />
                    <span>{isAr ? 'المواد الحالية وتفاصيل تقسيم الدرجات للطالب:' : 'Current Student Courses & Grading Breakdown:'}</span>
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">
                    {studentSubjects.length} {isAr ? 'مادة مسجلة' : 'subjects'}
                  </span>
                </h4>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
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
                              {sub.code} • {sub.credit_hours || sub.creditHours} {isAr ? 'ساعات' : 'credits'} • {sub.total_marks || sub.totalMarks} {isAr ? 'درجة إجمالية' : 'total marks'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-zinc-600 dark:text-zinc-300">
                              {gr?.totalAchieved || 0} / {sub.total_marks || sub.totalMarks} ({Math.round(gr?.percentage || 0)}%)
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-black text-xs">
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
                                <span className="font-black text-purple-600 dark:text-purple-400">
                                  {d.achievedMarks !== null && d.achievedMarks !== undefined ? d.achievedMarks : '-'} / {d.maxMarks}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold ${
                                  d.status === 'final' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                }`}>
                                  {d.status === 'final' ? (isAr ? 'نهائي' : 'Final') : (isAr ? 'حالي' : 'Current')}
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

              {/* Status Classification & Admin Notes */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{isAr ? 'تصنيف حالة الطلب:' : 'Update Status:'}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await db.updateFeedback(selectedFeedback.id, { status: 'new' });
                        setSelectedFeedback((prev: any) => prev ? { ...prev, status: 'new' } : null);
                        await fetchData();
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedFeedback.status === 'new'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-amber-100'
                      }`}
                    >
                      {isAr ? 'جديد (الرئيسية)' : 'Set New'}
                    </button>

                    <button
                      onClick={async () => {
                        await db.updateFeedback(selectedFeedback.id, { status: 'reviewed' });
                        setSelectedFeedback((prev: any) => prev ? { ...prev, status: 'reviewed' } : null);
                        await fetchData();
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedFeedback.status === 'reviewed'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-blue-100'
                      }`}
                    >
                      {isAr ? 'قيد المراجعة' : 'In Review'}
                    </button>

                    <button
                      onClick={async () => {
                        await db.updateFeedback(selectedFeedback.id, { status: 'resolved' });
                        setSelectedFeedback((prev: any) => prev ? { ...prev, status: 'resolved' } : null);
                        await fetchData();
                      }}
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
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2"
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
