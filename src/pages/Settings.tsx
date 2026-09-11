import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { GradingScale } from '../components/settings/GradingScale';
import { GraduationGradingScale } from '../components/settings/GraduationGradingScale';
import { SemestersManager } from '../components/settings/SemestersManager';
import { UserFeedbackSection } from '../components/settings/UserFeedbackSection';
import { defaultGraduationScale } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { UniversityDatabase } from '../types';
import { UniversityRestoreModal } from '../components/settings/UniversityRestoreModal';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  KeyRound, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Building2, 
  Sparkles, 
  Unlink, 
  Trash2, 
  Loader2, 
  Save, 
  AlertCircle,
  User,
  GraduationCap,
  Database,
  Shield,
  MessageSquare,
  Calendar,
  Layers,
  BookOpen,
  Info,
  Compass
} from 'lucide-react';

type SettingsTab = 'profile' | 'databases' | 'security' | 'feedback';

export function Settings() {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings, userEmail, unlinkUniversityDatabase, unlinkSpecializationDatabase } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';
  
  // Active Tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Modals state
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreModalMode, setRestoreModalMode] = useState<'college' | 'specialization'>('college');
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [isUnlinkSpecModalOpen, setIsUnlinkSpecModalOpen] = useState(false);
  const [unlinkingSpec, setUnlinkingSpec] = useState(false);

  // Main Form Data
  const [formData, setFormData] = useState<{
    name: string;
    university: string;
    college: string;
    enrollmentDate: string;
    totalYears: number | '';
    semestersPerYear: number | '';
    gradingScale: typeof settings.gradingScale;
    semesters: typeof settings.semesters;
    initialCumulativeGpa: number | null;
    initialCompletedCreditHours: number | null;
    setupMode: 'initial_gpa' | 'manual_subjects';
    warningGradeLetter?: string;
    warningGpaPoints?: number;
    enableGraduationScale?: boolean;
    graduationGradingScale?: typeof defaultGraduationScale;
    specialization?: string;
    specializationStartYear?: number | '';
    specializationStartSemester?: number | '';
    specializationDatabaseId?: string;
  }>({
    name: settings.name,
    university: settings.university,
    college: settings.college,
    enrollmentDate: settings.enrollmentDate,
    totalYears: settings.totalYears,
    semestersPerYear: settings.semestersPerYear,
    gradingScale: settings.gradingScale,
    semesters: settings.semesters,
    initialCumulativeGpa: settings.initialCumulativeGpa,
    initialCompletedCreditHours: settings.initialCompletedCreditHours,
    setupMode: settings.setupMode || 'initial_gpa',
    warningGradeLetter: settings.warningGradeLetter,
    warningGpaPoints: settings.warningGpaPoints,
    enableGraduationScale: settings.enableGraduationScale ?? false,
    graduationGradingScale: settings.graduationGradingScale && settings.graduationGradingScale.length > 0 ? settings.graduationGradingScale : defaultGraduationScale,
    specialization: settings.specialization || '',
    specializationStartYear: (settings.specializationStartYear != null && Number(settings.specializationStartYear) > 0) ? Number(settings.specializationStartYear) : '',
    specializationStartSemester: (settings.specializationStartSemester != null && Number(settings.specializationStartSemester) > 0) ? Number(settings.specializationStartSemester) : '',
    specializationDatabaseId: settings.specializationDatabaseId || ''
  });

  const isDirtyRef = React.useRef(false);

  // Sync state if settings changed externally (e.g. database restore)
  useEffect(() => {
    if (isDirtyRef.current) return;
    setFormData(prev => ({
      ...prev,
      name: settings.name || prev.name,
      university: settings.university || prev.university,
      college: settings.college || prev.college,
      totalYears: settings.totalYears,
      semestersPerYear: settings.semestersPerYear,
      semesters: settings.semesters,
      gradingScale: settings.gradingScale,
      specialization: settings.specialization || '',
      specializationStartYear: (settings.specializationStartYear != null && Number(settings.specializationStartYear) > 0) ? Number(settings.specializationStartYear) : '',
      specializationStartSemester: (settings.specializationStartSemester != null && Number(settings.specializationStartSemester) > 0) ? Number(settings.specializationStartSemester) : '',
      specializationDatabaseId: settings.specializationDatabaseId || ''
    }));
  }, [
    settings.name,
    settings.university, 
    settings.college, 
    settings.totalYears, 
    settings.semestersPerYear, 
    settings.semesters,
    settings.specialization,
    settings.specializationStartYear,
    settings.specializationStartSemester,
    settings.specializationDatabaseId
  ]);

  // College Accredited Specializations
  const [collegeSpecializations, setCollegeSpecializations] = useState<UniversityDatabase[]>([]);

  useEffect(() => {
    if (formData.college && formData.college !== 'غير محدد' && formData.college !== 'Not specified') {
      db.getUniversityDatabases()
        .then(allDbs => {
          const norm = (str?: string) => (str || '').trim().toLowerCase();
          const targetCol = norm(formData.college);
          const specs = allDbs.filter(d => 
            d.isSpecialization && 
            (norm(d.collegeNameAr) === targetCol || norm(d.collegeNameEn) === targetCol)
          );
          setCollegeSpecializations(specs);
        })
        .catch(() => setCollegeSpecializations([]));
    } else {
      setCollegeSpecializations([]);
    }
  }, [formData.college]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    isDirtyRef.current = true;
    const { name, value, type } = e.target;
    if (name === 'specializationStartYear' || name === 'specializationStartSemester') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleConfirmUnlink = async () => {
    try {
      setUnlinking(true);
      await unlinkUniversityDatabase();
      setIsUnlinkModalOpen(false);
      isDirtyRef.current = false;
      // Keep the typed profile names (the store preserves them); only the
      // explicit link ids are cleared so the form matches the store exactly.
      setFormData(prev => ({
        ...prev,
        universityDatabaseId: undefined,
        specializationDatabaseId: undefined
      }));
      setSaveStatus({
        type: 'success',
        message: isAr ? 'تم إلغاء استخدام قاعدة البيانات وحذف المواد والدرايف بنجاح.' : 'Database unlinked and curriculum reset successfully.'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (e) {
      setSaveStatus({
        type: 'error',
        message: isAr ? 'حدث خطأ أثناء إلغاء استخدام قاعدة البيانات.' : 'Error disconnecting database.'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setUnlinking(false);
    }
  };

  const handleConfirmUnlinkSpec = async () => {
    try {
      setUnlinkingSpec(true);
      await unlinkSpecializationDatabase();
      setIsUnlinkSpecModalOpen(false);
      isDirtyRef.current = false;
      // Keep the typed specialization name (the store preserves it); only the
      // explicit link id is cleared so the form matches the store exactly.
      setFormData(prev => ({
        ...prev,
        specializationDatabaseId: undefined
      }));
      setSaveStatus({
        type: 'success',
        message: isAr ? 'تم إلغاء ربط التخصص وحذف مواده بنجاح، مع بقاء مواد الكلية العامة.' : 'Specialization unlinked successfully.'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (e) {
      setSaveStatus({
        type: 'error',
        message: isAr ? 'حدث خطأ أثناء إلغاء ربط التخصص.' : 'Error disconnecting specialization.'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setUnlinkingSpec(false);
    }
  };

  // Password Update State with Current Password Verification
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!currentPassword) {
      setPasswordStatus({
        type: 'error',
        message: isAr ? 'يرجى إدخال كلمة المرور الحالية أولاً للتحقق من هويتك وأمان الحساب.' : 'Please enter your current password first.'
      });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus({
        type: 'error',
        message: isAr ? 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف أو أرقام.' : 'New password must be at least 6 characters.'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: 'error',
        message: isAr ? 'كلمة المرور الجديدة وتأكيدها غير متطابقين.' : 'Passwords do not match.'
      });
      return;
    }

    setPasswordLoading(true);
    try {
      // Step 1: Verify current password via signInWithPassword
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail || '',
        password: currentPassword
      });

      if (signInError) {
        setPasswordStatus({
          type: 'error',
          message: isAr 
            ? 'كلمة المرور الحالية غير صحيحة! يرجى التأكد من كتابة كلمة المرور القديمة بشكل سليم والمحاولة مجدداً.' 
            : 'Current password is incorrect. Please verify and try again.'
        });
        return;
      }

      // Step 2: Update password after successful verification
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setPasswordStatus({
        type: 'success',
        message: isAr ? 'تم تحديث كلمة المرور بنجاح وأمان!' : 'Password updated successfully!'
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordStatus(null), 5000);
    } catch (err: any) {
      setPasswordStatus({
        type: 'error',
        message: err.message || (isAr ? 'حدث خطأ أثناء تحديث كلمة المرور.' : 'Failed to update password.')
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Profile / Academic Save Handler
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveStatus(null);

      if (formData.totalYears === '' || isNaN(Number(formData.totalYears)) || Number(formData.totalYears) < 1 || Number(formData.totalYears) > 10) {
        setSaveStatus({
          type: 'error',
          message: isAr ? 'يرجى إدخال عدد السنوات الدراسية بشكل صحيح بين 1 و 10.' : 'Please enter valid total years between 1 and 10.'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setSaving(false);
        return;
      }

      if (formData.semestersPerYear === '' || isNaN(Number(formData.semestersPerYear)) || Number(formData.semestersPerYear) < 1 || Number(formData.semestersPerYear) > 4) {
        setSaveStatus({
          type: 'error',
          message: isAr ? 'يرجى إدخال عدد الفصول في السنة بشكل صحيح بين 1 و 4.' : 'Please enter valid semesters per year between 1 and 4.'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setSaving(false);
        return;
      }

      if (formData.initialCumulativeGpa !== null && formData.initialCumulativeGpa !== ('' as any)) {
        const gpaNum = Number(formData.initialCumulativeGpa);
        if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4) {
          setSaveStatus({
            type: 'error',
            message: isAr ? 'المعدل التراكمي السابق يجب أن يكون رقماً بين 0 و 4.' : 'Initial cumulative GPA must be between 0 and 4.'
          });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setSaving(false);
          return;
        }
      }

      if (formData.initialCompletedCreditHours !== null && formData.initialCompletedCreditHours !== ('' as any)) {
        const creditsNum = Number(formData.initialCompletedCreditHours);
        if (isNaN(creditsNum) || creditsNum < 0) {
          setSaveStatus({
            type: 'error',
            message: isAr ? 'الساعات المكتسبة السابقة يجب أن تكون رقماً أكبر أو يساوي 0.' : 'Initial completed credit hours must be >= 0.'
          });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setSaving(false);
          return;
        }
      }
      
      const startYearNum = (formData.specializationStartYear !== '' && formData.specializationStartYear != null && Number(formData.specializationStartYear) > 0) 
        ? Number(formData.specializationStartYear) 
        : undefined;
      const startSemNum = (formData.specializationStartSemester !== '' && formData.specializationStartSemester != null && Number(formData.specializationStartSemester) > 0) 
        ? Number(formData.specializationStartSemester) 
        : undefined;

      // Database linking is EXPLICIT-ONLY: preserve an existing link (created
      // via the restore action) and never create one by name-matching.
      // If a linked student renames his college to a different one, the sync
      // detects the mismatch and clears the stale link gracefully (no data loss).
      const targetUniDbId = settings.universityDatabaseId;

      const newSettings = {
        ...formData,
        totalYears: Number(formData.totalYears),
        semestersPerYear: Number(formData.semestersPerYear),
        initialCumulativeGpa: (formData.initialCumulativeGpa != null && formData.initialCumulativeGpa !== ('' as any)) ? Number(formData.initialCumulativeGpa) : null,
        initialCompletedCreditHours: (formData.initialCompletedCreditHours != null && formData.initialCompletedCreditHours !== ('' as any)) ? Number(formData.initialCompletedCreditHours) : null,
        specialization: formData.specialization ? formData.specialization.trim() : '',
        specializationStartYear: startYearNum,
        specializationStartSemester: startSemNum,
        specializationDatabaseId: formData.specializationDatabaseId || undefined,
        universityDatabaseId: targetUniDbId
      };
      
      const { userId } = useAppStore.getState();
      if (userId) {
        await db.upsertSettings(userId, newSettings);
      }
      
      updateSettings(newSettings);
      isDirtyRef.current = false;
      setSaveStatus({
        type: 'success',
        message: isAr ? 'تم حفظ وتطبيق جميع الإعدادات وسنة التخصص بنجاح!' : 'Settings and specialization preferences saved successfully!'
      });
      setTimeout(() => setSaveStatus(null), 6000);
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: (isAr ? 'حدث خطأ: ' : 'Error: ') + err.message });
    } finally {
      setSaving(false);
    }
  };

  // Specialization Calculation Logic: Strictly match against student's selected active current semester
  const currentSemester = formData.semesters.find(s => s.isCurrent);
  const startYearNum = (formData.specializationStartYear !== '' && formData.specializationStartYear != null && Number(formData.specializationStartYear) > 0) ? Number(formData.specializationStartYear) : null;
  const startSemNum = (formData.specializationStartSemester !== '' && formData.specializationStartSemester != null && Number(formData.specializationStartSemester) > 0) ? Number(formData.specializationStartSemester) : null;
  
  const hasConfiguredSpecializationTiming = startYearNum !== null && startSemNum !== null;
  const hasReachedSpecialization = Boolean(
    hasConfiguredSpecializationTiming && 
    currentSemester && 
    (
      currentSemester.yearIndex > startYearNum || 
      (currentSemester.yearIndex === startYearNum && currentSemester.semesterIndex >= startSemNum)
    )
  );

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 max-w-6xl mx-auto w-full">
      {/* Top Header - Fully Responsive on Mobile, Tablet & Desktop */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
              {t('settings')}
            </h1>
            <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              {isAr ? 'لوحة التحكم الأكاديمية' : 'Academic Hub'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {isAr 
              ? 'إدارة حسابك الشخصي، الخطة الدراسية، قواعد بيانات الكلية والتخصص، والأمان' 
              : 'Manage your profile, academic plan, college & specialization databases, and security'}
          </p>
        </div>
      </header>

      {/* Global Status Message */}
      {saveStatus && (
        <div className={`p-3 sm:p-4.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2.5 sm:gap-3 transition-all animate-in fade-in shadow-xs ${
          saveStatus.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
        }`}>
          {saveStatus.type === 'success' ? (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 size={16} />
            </div>
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertCircle size={16} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-extrabold">{saveStatus.type === 'success' ? (isAr ? 'تم بنجاح!' : 'Success!') : (isAr ? 'تنبيه' : 'Alert')}</p>
            <p className="text-[11px] sm:text-xs font-medium opacity-90 truncate sm:whitespace-normal">{saveStatus.message}</p>
          </div>
        </div>
      )}

      {/* Responsive Tab Navigation: Smooth horizontal scroll, full unclipped labels */}
      <nav 
        aria-label="Settings Tabs"
        className="flex items-center gap-2 p-1.5 bg-zinc-100/90 dark:bg-zinc-800/70 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-x-auto no-scrollbar scroll-smooth shadow-2xs"
      >
        {/* Tab 1: Profile & Academic Plan */}
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer select-none ${
            activeTab === 'profile'
              ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <GraduationCap size={17} className="shrink-0" />
          <span>{isAr ? 'الملف الشخصي والخطة' : 'Profile & Plan'}</span>
        </button>

        {/* Tab 2: Databases & Restore */}
        <button
          type="button"
          onClick={() => setActiveTab('databases')}
          className={`shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer select-none ${
            activeTab === 'databases'
              ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Database size={17} className="shrink-0" />
          <span>{isAr ? 'قواعد البيانات' : 'Databases'}</span>
          {settings.universityDatabaseId && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          )}
        </button>

        {/* Tab 3: Security & Password */}
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer select-none ${
            activeTab === 'security'
              ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Shield size={17} className="shrink-0" />
          <span>{isAr ? 'الأمان وكلمة المرور' : 'Security & Password'}</span>
        </button>

        {/* Tab 4: Feedback & Support */}
        <button
          type="button"
          onClick={() => setActiveTab('feedback')}
          className={`shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer select-none ${
            activeTab === 'feedback'
              ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare size={17} className="shrink-0" />
          <span>{isAr ? 'المقترحات والدعم' : 'Feedback & Support'}</span>
        </button>
      </nav>

      {/* TAB 1: PROFILE & ACADEMIC PLAN */}
      {activeTab === 'profile' && (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in">
          {/* Card 1: Personal & University Info */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-3.5 sm:p-6 lg:p-7 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3 sm:pb-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <User size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                    {isAr ? 'البيانات الشخصية والجامعية' : 'Personal & University Information'}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
                    {isAr ? 'بيانات هويتك الأكاديمية والكلية التي تدرس بها' : 'Your academic identity and registered college'}
                  </p>
                </div>
              </div>

              {userEmail && (
                <span className="inline-flex max-w-full truncate px-2.5 sm:px-3 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono text-[11px] sm:text-xs font-bold w-fit self-start sm:self-auto">
                  {userEmail}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t('name')}</label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={isAr ? 'اسمك الكامل' : 'Your Full Name'}
                  className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t('enrollment_date')}</label>
                <input 
                  type="date" 
                  name="enrollmentDate"
                  value={formData.enrollmentDate}
                  onChange={handleChange}
                  className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t('university')}</label>
                <input 
                  type="text" 
                  name="university"
                  value={formData.university}
                  onChange={handleChange}
                  placeholder={isAr ? 'مثال: جامعة القاهرة' : 'e.g. Cairo University'}
                  className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t('college')}</label>
                <input 
                  type="text" 
                  name="college"
                  value={formData.college}
                  onChange={handleChange}
                  placeholder={isAr ? 'مثال: كلية الهندسة' : 'e.g. Faculty of Engineering'}
                  className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm sm:text-sm"
                />
              </div>
            </div>
          </section>

          {/* Card 2: Academic Specialization Timing & Major Name */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-3.5 sm:p-6 lg:p-7 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3 sm:pb-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
                  <Compass size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>{isAr ? 'نظام التخصص الأكاديمي' : 'Academic Specialization System'}</span>
                    <Sparkles size={15} className="text-amber-500 shrink-0" />
                  </h2>
                  <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {isAr 
                      ? 'حدد متى يبدأ التخصص في كليتك، وتفعيل اسم التخصص فور وصولك إلى الفصل الدراسي المعتمد' 
                      : 'Set when specialization starts in your college, and unlock your major upon reaching that term'}
                  </p>
                </div>
              </div>

              {currentSemester && (
                <div className="text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 w-fit shrink-0 self-start sm:self-auto">
                  <span>{isAr ? 'فصلك الحالي: ' : 'Current: '}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                    {isAr ? `السنة ${currentSemester.yearIndex} - الترم ${currentSemester.semesterIndex}` : `Yr ${currentSemester.yearIndex} - Term ${currentSemester.semesterIndex}`}
                  </span>
                </div>
              )}
            </div>

            {/* Timing Inputs: Start Year and Start Semester */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Calendar size={13} className="text-zinc-400 shrink-0" />
                  <span>{isAr ? 'سنة بداية التخصص بالكلية' : 'Specialization Start Year'}</span>
                </label>
                <select
                  name="specializationStartYear"
                  value={formData.specializationStartYear}
                  onChange={handleChange}
                  className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-base sm:text-sm font-bold cursor-pointer"
                >
                  <option value="">{isAr ? 'اختر سنة بداية التخصص...' : 'Select Start Year...'}</option>
                  {Array.from({ length: Number(formData.totalYears) || 4 }, (_, i) => i + 1).map(year => (
                    <option key={year} value={year}>
                      {isAr ? `السنة الدراسية ${year}` : `Year ${year}`}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-400">
                  {isAr ? 'السنة التي يبدأ فيها الطلاب دراسة مواد تخصصهم' : 'The academic year when students start their specialized subjects'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Layers size={13} className="text-zinc-400 shrink-0" />
                  <span>{isAr ? 'ترم بداية التخصص بالكلية' : 'Specialization Start Term'}</span>
                </label>
                <select
                  name="specializationStartSemester"
                  value={formData.specializationStartSemester}
                  onChange={handleChange}
                  className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-base sm:text-sm font-bold cursor-pointer"
                >
                  <option value="">{isAr ? 'اختر فصل بداية التخصص...' : 'Select Start Term...'}</option>
                  {Array.from({ length: Number(formData.semestersPerYear) || 2 }, (_, i) => i + 1).map(sem => (
                    <option key={sem} value={sem}>
                      {isAr ? `الفصل الدراسي ${sem} (الترم ${sem})` : `Semester ${sem}`}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-400">
                  {isAr ? 'الترم الذي يتفرع فيه التخصص داخل تلك السنة' : 'The semester within that year when major begins'}
                </p>
              </div>
            </div>

            {/* Dynamic Status / Specialization Input Field */}
            {hasConfiguredSpecializationTiming ? (
              hasReachedSpecialization ? (
                /* UNLOCKED STATE: Student has reached or passed the specialization milestone */
                <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-amber-50/60 dark:from-indigo-950/40 dark:via-zinc-900 dark:to-amber-950/30 border border-indigo-200 dark:border-indigo-800/80 space-y-3.5 animate-in fade-in">
                  <div className="flex items-center gap-2.5 text-indigo-700 dark:text-indigo-300 font-black text-xs sm:text-sm">
                    <Sparkles size={16} className="text-amber-500 shrink-0" />
                    <span>
                      {isAr ? 'وصلت إلى مرحلة التخصص الأكاديمي' : 'You have reached the Specialization stage'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <BookOpen size={13} className="text-indigo-600 shrink-0" />
                      <span>{isAr ? 'اكتب اسم تخصصك الأكاديمي' : 'Enter Your Academic Specialization'}</span>
                      <span className="text-[11px] font-normal text-zinc-400">
                        ({isAr ? 'تخصصك المعتمد في الكلية' : 'Your college major'})
                      </span>
                    </label>
                    <input 
                      type="text" 
                      name="specialization"
                      value={formData.specialization || ''}
                      onChange={handleChange}
                      placeholder={isAr ? 'مثال: هندسة حاسبات ونظم / علوم الحاسب / نظم معلومات / محاسبة...' : 'e.g. Computer Engineering / CS / IS / Finance...'}
                      className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-base sm:text-sm font-bold shadow-xs"
                    />

                    {collegeSpecializations.length > 0 && (
                      <div className="space-y-1.5 pt-1.5">
                        <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                          <Sparkles size={12} className="text-purple-600 dark:text-purple-400" />
                          <span>{isAr ? 'أو اختر من التخصصات المعتمدة لكليتك:' : 'Or choose from accredited college majors:'}</span>
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {collegeSpecializations.map(spec => {
                            const isChosen = formData.specialization === (spec.specializationNameAr || spec.collegeNameAr);
                            return (
                              <button
                                key={spec.id}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    specialization: spec.specializationNameAr || spec.collegeNameAr,
                                    specializationStartYear: spec.specializationStartYear || prev.specializationStartYear || 2,
                                    specializationStartSemester: spec.specializationStartSemester || prev.specializationStartSemester || 1,
                                    specializationDatabaseId: spec.id
                                  }));
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                                  isChosen
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-purple-400'
                                }`}
                              >
                                <Compass size={13} className={isChosen ? 'text-white' : 'text-purple-600 dark:text-purple-400'} />
                                <span>{spec.specializationNameAr || spec.collegeNameAr}</span>
                                <span className="text-[10px] opacity-75">
                                  ({isAr ? `سنة ${spec.specializationStartYear || 2}` : `Y${spec.specializationStartYear || 2}`})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {isAr 
                      ? 'بمجرد كتابة تخصصك وحفظه، ستتمكن أيضاً من استرداد قاعدة بيانات التخصص من تبويب "قواعد البيانات والاسترداد".' 
                      : 'Once entered and saved, you can also restore the specialization curriculum from the "Databases & Restore" tab.'}
                  </p>
                </div>
              ) : (
                /* LOCKED STATE: Student is in an earlier semester or hasn't selected active semester yet */
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5 sm:gap-3">
                  <Info size={18} className="text-zinc-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      {isAr 
                        ? `يبدأ تخصصك في السنة ${startYearNum} - الفصل ${startSemNum}` 
                        : `Your specialization begins in Year ${startYearNum} - Term ${startSemNum}`}
                    </p>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {currentSemester ? (
                        isAr 
                          ? `أنت حالياً في (السنة ${currentSemester.yearIndex} - الفصل ${currentSemester.semesterIndex}). فور تقدمك إلى الفصل الدراسي المحدد في خطتك، ستظهر لك خانة تحديد وكتابة تخصصك تلقائياً لاسترداد مواده المعتمدة.`
                          : `You are currently in (Year ${currentSemester.yearIndex} - Term ${currentSemester.semesterIndex}). Upon advancing to the specified term, the specialization field will unlock automatically.`
                      ) : (
                        isAr
                          ? `يرجى تحديد فصلك الدراسي الحالي في جدول الفصول الدراسية أدناه لمعرفة حالة تفعيل التخصص التلقائي.`
                          : `Please set your active current semester in the semesters table below to calculate specialization availability.`
                      )}
                    </p>
                  </div>
                </div>
              )
            ) : (
              /* NOT CONFIGURED YET */
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-center gap-2.5 sm:gap-3 text-xs text-amber-800 dark:text-amber-300 font-bold">
                <Info size={16} className="shrink-0" />
                <span>
                  {isAr 
                    ? 'حدد سنة وترم بداية التخصص أعلاه لتفعيل التخصص الأكاديمي لحسابك فور وصولك إليه.' 
                    : 'Select specialization start year and term above to activate your major when you reach it.'}
                </span>
              </div>
            )}
          </section>

          {/* Card 3: Study Plan & Semesters */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-3.5 sm:p-6 lg:p-7 space-y-4 sm:space-y-6">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 sm:pb-4">
              <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">{t('academic_plan')}</h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
                {isAr ? 'هيكل السنوات والفصول الدراسية والفصل الحالي' : 'Years and semesters structure and active term'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t('total_years')}</label>
                <input 
                  type="number" 
                  name="totalYears"
                  value={formData.totalYears}
                  onChange={handleChange}
                  min="1"
                  max="10"
                  className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm sm:text-sm font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t('semesters_per_year')}</label>
                <input 
                  type="number" 
                  name="semestersPerYear"
                  value={formData.semestersPerYear}
                  onChange={handleChange}
                  min="1"
                  max="4"
                  className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm sm:text-sm font-bold"
                />
              </div>
            </div>

            <div className="pt-3 sm:pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <SemestersManager 
                semesters={formData.semesters}
                totalYears={Number(formData.totalYears) || 1}
                semestersPerYear={Number(formData.semestersPerYear) || 1}
                initialCumulativeGpa={formData.initialCumulativeGpa}
                initialCompletedCreditHours={formData.initialCompletedCreditHours}
                setupMode={formData.setupMode}
                onInitialGpaChange={(gpa, credits, mode) => {
                  setFormData(prev => ({
                    ...prev,
                    initialCumulativeGpa: gpa,
                    initialCompletedCreditHours: credits,
                    setupMode: mode
                  }));
                }}
                onChange={(newSemesters) => setFormData(prev => ({ ...prev, semesters: newSemesters }))}
              />
            </div>
          </section>

          {/* Card 4: Grading Scales */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-3.5 sm:p-6 lg:p-7">
            <GradingScale 
              scale={formData.gradingScale}
              onChange={(newScale) => setFormData(prev => ({ ...prev, gradingScale: newScale }))}
            />
          </section>

          {/* Card 5: Graduation Grading Scale */}
          <div>
            <GraduationGradingScale
              scale={formData.graduationGradingScale}
              enabled={formData.enableGraduationScale}
              onToggleEnabled={(enabled) => setFormData(prev => ({ ...prev, enableGraduationScale: enabled }))}
              onChange={(newScale) => setFormData(prev => ({ ...prev, graduationGradingScale: newScale }))}
            />
          </div>

          {/* Bottom Unified Save Button Action & Inline Feedback */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col items-stretch sm:items-end gap-3">
            {saveStatus && (
              <div className={`w-full p-3.5 sm:p-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-3 transition-all animate-in fade-in shadow-xs ${
                saveStatus.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
              }`}>
                {saveStatus.type === 'success' ? (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 size={18} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <AlertCircle size={18} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs sm:text-sm">{saveStatus.type === 'success' ? (isAr ? 'تم حفظ التغييرات بنجاح!' : 'Changes Saved Successfully!') : (isAr ? 'تنبيه' : 'Alert')}</p>
                  <p className="text-[11px] sm:text-xs font-medium opacity-90">{saveStatus.message}</p>
                </div>
              </div>
            )}

            <button 
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-60 text-white font-black px-8 py-3.5 rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-500/25 transition-all cursor-pointer flex items-center justify-center gap-2.5 text-xs sm:text-sm"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ جميع التغييرات' : 'Save All Changes')}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: DATABASES & RESTORE */}
      {activeTab === 'databases' && (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in">
          {/* Main College Database Card */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-3.5 sm:p-6 lg:p-7 space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2.5 sm:gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3 sm:pb-4">
              <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Building2 size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                  {isAr ? 'قاعدة بيانات الكلية والمنهج الدراسي العام' : 'College Curriculum Database'}
                </h2>
                <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
                  {isAr ? 'استرداد المواد، التقديرات، وملفات الدرايف المعتمدة للسنوات التمهيدية والعامة' : 'Restore accredited subjects, grading rules, and drive files for foundation years'}
                </p>
              </div>
            </div>

            {/* Linked Status — the explicit database id is REQUIRED: typed
                names alone are profile data and must never render as a link */}
            {settings.universityDatabaseId && settings.university && settings.college && settings.university !== 'غير محدد' ? (
              <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-50/80 to-blue-50/50 dark:from-indigo-950/40 dark:to-zinc-900 border border-indigo-200/80 dark:border-indigo-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0 mt-0.5 sm:mt-0">
                    <CheckCircle2 size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                        {isAr ? 'متصل ومربوط مع:' : 'Currently Connected to:'}
                      </span>
                      <span className="max-w-full truncate px-2.5 sm:px-3 py-1 rounded-xl text-xs font-black bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-indigo-100 dark:border-indigo-950 shadow-xs">
                        {settings.university} • {settings.college}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      {isAr 
                        ? `الخطة مربوطة تلقائياً (${settings.totalYears} سنوات، ${settings.semestersPerYear} فصول/سنة). التحديثات تظهر في حسابك تلقائياً وبشكل فوري.` 
                        : `Linked template (${settings.totalYears} yrs, ${settings.semestersPerYear} terms/yr). Updates reflect instantly.`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreModalMode('college');
                      setIsRestoreModalOpen(true);
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900 hover:bg-indigo-50 dark:hover:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer shadow-xs"
                  >
                    <Building2 size={15} />
                    <span>{isAr ? 'تغيير أو إعادة استرداد الكلية' : 'Change / Re-import College'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsUnlinkModalOpen(true)}
                    className="w-full sm:w-auto text-center inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/60 transition-all cursor-pointer shadow-xs"
                  >
                    <Unlink size={13} />
                    <span>{isAr ? 'إلغاء الربط' : 'Disconnect'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
                <Building2 size={28} className="mx-auto text-zinc-400 sm:w-8 sm:h-8" />
                <div className="space-y-1">
                  <h3 className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200">
                    {isAr ? 'لم تقم باسترداد قاعدة بيانات الكلية بعد' : 'No College Database Linked'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                    {isAr 
                      ? 'يمكنك استرداد خطتك الدراسية وموادك وجدول تقديراتك وملفات الدرايف الجاهزة بضغطة زر واحدة واختيار جامعتك وكليتك.' 
                      : 'You can restore your accredited curriculum, courses, and drive files in one click by selecting your university and college.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRestoreModalMode('college');
                    setIsRestoreModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <Building2 size={16} />
                  <span>{isAr ? 'استرداد قاعدة بيانات الكلية العامة' : 'Restore General College Database'}</span>
                </button>
              </div>
            )}
          </section>

          {/* Academic Specialization Database Card */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-3.5 sm:p-6 lg:p-7 space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2.5 sm:gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3 sm:pb-4">
              <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
                <Compass size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>{isAr ? 'قاعدة بيانات التخصص الأكاديمي' : 'Specialization Database Hub'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                    {isAr ? 'الميزة المتقدمة' : 'Advanced'}
                  </span>
                </h2>
                <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
                  {isAr 
                    ? 'استرداد مواد تخصصك الخاصة بدءاً من سنة التخصص، بالتكامل مع مواد الكلية العامة' 
                    : 'Restore specialized courses starting from your specialization year in dual-sync'}
                </p>
              </div>
            </div>

            {formData.specialization && formData.specializationDatabaseId ? (
              <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-50/80 to-purple-50/40 dark:from-amber-950/30 dark:to-zinc-900 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-600/20 shrink-0 mt-0.5 sm:mt-0">
                    <Sparkles size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-amber-800 dark:text-amber-200">
                        {isAr ? 'التخصص المسترد الحالي:' : 'Active Specialization:'}
                      </span>
                      <span className="max-w-full truncate px-2.5 sm:px-3 py-1 rounded-xl text-xs font-black bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-amber-200 dark:border-amber-950 shadow-xs">
                        {formData.specialization}
                      </span>
                      {formData.specializationStartYear && (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                          {isAr
                            ? `السنة ${formData.specializationStartYear} (الترم ${formData.specializationStartSemester || 1})`
                            : `Year ${formData.specializationStartYear} (Term ${formData.specializationStartSemester || 1})`}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      {isAr
                        ? 'الخطة مربوطة تلقائياً مع تخصصك المعتمد. التحديثات المعتمدة تنعكس في حسابك فورياً بالتكامل مع مواد الكلية العامة.'
                        : 'Accredited specialization plan is connected. Updates reflect instantly.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreModalMode('specialization');
                      setIsRestoreModalOpen(true);
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-white dark:bg-zinc-900 hover:bg-amber-50 dark:hover:bg-zinc-800 border border-amber-200 dark:border-amber-800 transition-all cursor-pointer shadow-xs"
                  >
                    <Compass size={15} />
                    <span>{isAr ? 'تغيير أو إعادة استرداد التخصص' : 'Change Specialization'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsUnlinkSpecModalOpen(true)}
                    className="w-full sm:w-auto text-center inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/60 transition-all cursor-pointer shadow-xs"
                  >
                    <Unlink size={13} />
                    <span>{isAr ? 'إلغاء ربط التخصص' : 'Disconnect'}</span>
                  </button>
                </div>
              </div>
            ) : formData.specialization ? (
              <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-zinc-50 to-amber-50/60 dark:from-zinc-900 dark:to-amber-950/20 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <Compass size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                        {isAr ? 'تخصصك المختار:' : 'Selected Specialization:'}
                      </span>
                      <span className="max-w-full truncate px-2.5 sm:px-3 py-1 rounded-xl text-xs font-black bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 shadow-xs">
                        {formData.specialization}
                      </span>
                      {formData.specializationStartYear && (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0">
                          {isAr
                            ? `السنة ${formData.specializationStartYear} (الترم ${formData.specializationStartSemester || 1})`
                            : `Year ${formData.specializationStartYear} (Term ${formData.specializationStartSemester || 1})`}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      {isAr
                        ? 'لم يتم استرداد قاعدة بيانات التخصص بعد — مواد التخصص غير موجودة في حسابك حالياً. استردها الآن مع الحفاظ التام على مواد الكلية العامة.'
                        : 'Specialization database not restored yet — no specialization subjects in your account. Restore them now while keeping all general foundation subjects.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreModalMode('specialization');
                      setIsRestoreModalOpen(true);
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <Sparkles size={15} />
                    <span>{isAr ? 'استرداد مواد التخصص الآن' : 'Restore Specialization Now'}</span>
                  </button>
                </div>
              </div>
            ) : settings.university && settings.college && settings.university !== 'غير محدد' ? (
              <div className="p-5 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
                <Compass size={28} className="mx-auto text-amber-500 sm:w-8 sm:h-8" />
                <div className="space-y-1">
                  <h3 className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200">
                    {isAr ? 'لم تقم باسترداد تخصص أكاديمي بعد' : 'No Specialization Linked'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                    {isAr 
                      ? 'يمكنك استعراض واسترداد مواد تخصصك المعتمد لكليتك بضغطة زر واحدة، مع الحفاظ التام على مواد السنوات العامة التأسيسية السابقة.' 
                      : 'You can restore your college specialization subjects while retaining all common foundation subjects.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRestoreModalMode('specialization');
                    setIsRestoreModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  <span>{isAr ? 'استعراض واسترداد مواد التخصص' : 'Restore Specialization Curriculum'}</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5 sm:gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <Info size={18} className="text-zinc-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px] sm:text-xs">
                  {isAr 
                    ? 'لتفعيل واسترداد التخصص الأكاديمي، يرجى أولاً استرداد قاعدة بيانات الكلية العامة أعلاه.' 
                    : 'To enable specialization restore, please link your general college database first.'}
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: SECURITY & PASSWORD */}
      {activeTab === 'security' && (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in max-w-3xl">
          {/* Account Security Card */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-3.5 sm:p-6 lg:p-7 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3 sm:pb-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <KeyRound size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                    {isAr ? 'تغيير كلمة المرور والتحقق الأمني' : 'Password & Security Verification'}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
                    {isAr ? 'يلزم إدخال كلمة المرور الحالية أولاً للتحقق من هويتك قبل تعيين كلمة مرور جديدة' : 'Current password verification is required before setting a new password'}
                  </p>
                </div>
              </div>

              {userEmail && (
                <span className="px-2.5 sm:px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-[11px] sm:text-xs font-mono font-bold w-fit truncate self-start sm:self-auto">
                  {userEmail}
                </span>
              )}
            </div>

            {passwordStatus && (
              <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-all animate-in fade-in ${
                passwordStatus.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50' 
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
              }`}>
                {passwordStatus.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" /> : <AlertTriangle size={18} className="shrink-0 text-rose-600" />}
                <span className="min-w-0 break-words">{passwordStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-3.5 sm:space-y-4">
              {/* Field 1: Current Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock size={13} className="text-indigo-600 shrink-0" />
                    <span>{isAr ? 'كلمة المرور الحالية' : 'Current Password'}</span>
                  </span>
                  <span className="text-[11px] font-normal text-rose-500">{isAr ? '* إلزامي للتحقق' : '* Required'}</span>
                </label>
                <div className="relative">
                  <input 
                    type={showCurrentPassword ? 'text' : 'password'} 
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rtl:pl-11 ltr:pr-11 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/60 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm sm:text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute top-1/2 -translate-y-1/2 rtl:left-3 ltr:right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 cursor-pointer"
                    title={showCurrentPassword ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Field 2: New Password */}
              <div className="space-y-1.5 pt-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>{isAr ? 'كلمة المرور الجديدة' : 'New Password'}</span>
                  <span className="text-[11px] font-normal text-zinc-400">{isAr ? '(6 خانات على الأقل)' : '(Min 6 chars)'}</span>
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rtl:pl-11 ltr:pr-11 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/60 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm sm:text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 -translate-y-1/2 rtl:left-3 ltr:right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 cursor-pointer"
                    title={showPassword ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Field 3: Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
                </label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rtl:pl-11 ltr:pr-11 rounded-xl sm:rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/60 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm sm:text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute top-1/2 -translate-y-1/2 rtl:left-3 ltr:right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 cursor-pointer"
                    title={showConfirmPassword ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Match Feedback */}
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs font-bold text-rose-500 flex items-center gap-1.5 pt-0.5">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>{isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'}</span>
                </p>
              )}

              {newPassword && confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>{isAr ? 'كلمتا المرور متطابقتان وجاهزتان للتحديث' : 'Passwords match'}</span>
                </p>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {passwordLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>{passwordLoading ? (isAr ? 'جاري التحقق والتحديث...' : 'Verifying & Updating...') : (isAr ? 'تأكيد وتحديث كلمة المرور' : 'Verify & Update Password')}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Tips Card */}
          <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <h3 className="text-xs font-black text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <span>{isAr ? 'نصائح حماية الحساب الأكاديمي' : 'Account Security Recommendations'}</span>
            </h3>
            <ul className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 space-y-1 list-disc list-inside leading-relaxed">
              <li>{isAr ? 'استخدم كلمة مرور قوية تحتوي على أحرف وأرقام ورموز خاصة.' : 'Use a strong password combining letters, numbers, and symbols.'}</li>
              <li>{isAr ? 'لا تشارك بيانات دخولك مع أي شخص لحماية درجاتك وملاحظاتك الدراسية.' : 'Do not share your credentials to safeguard your academic records.'}</li>
              <li>{isAr ? 'يتم حفظ جميع بياناتك وموادك مشفرة ومؤمنة بالكامل عبر خوادم سحابية محمية.' : 'All your data and notes are securely encrypted in the cloud.'}</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 4: USER FEEDBACK & SUGGESTIONS */}
      {activeTab === 'feedback' && (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in">
          <UserFeedbackSection />
        </div>
      )}

      {/* Confirm Unlink Database Modal - Fully Responsive on Mobile */}
      {isUnlinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl w-[92vw] sm:w-full max-w-md p-5 sm:p-7 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 mx-auto flex items-center justify-center shadow-md shadow-rose-500/10">
              <Trash2 size={24} className="sm:w-6 sm:h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-black text-base sm:text-lg text-zinc-900 dark:text-white">
                {isAr ? 'إلغاء استخدام قاعدة بيانات الجامعة' : 'Disconnect University Database'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {isAr
                  ? 'هل أنت متأكد من رغبتك في إلغاء ربط قاعدة البيانات؟ سيتم حذف المواد وملفات الدرايف المستوردة من القاعدة فقط، وستبقى كل الإضافات الشخصية (موادك ودرجاتك وملفاتك وملاحظاتك) كما هي.'
                  : 'Are you sure you want to disconnect? Only subjects and drive files imported from the database will be removed — everything you added personally (subjects, grades, files, notes) stays untouched.'}
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsUnlinkModalOpen(false)}
                disabled={unlinking}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                {isAr ? 'تراجع وإلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlink}
                disabled={unlinking}
                className="w-full sm:w-auto px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-500/25 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {unlinking ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                <span>{isAr ? 'نعم، إلغاء ومسح المواد' : 'Yes, Disconnect'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Specialization Modal */}
      {isUnlinkSpecModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <Unlink size={28} />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-lg text-zinc-900 dark:text-white">
                {isAr ? 'تأكيد إلغاء ربط التخصص' : 'Disconnect Specialization'}
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {isAr 
                  ? 'هل أنت متأكد من إلغاء ربط التخصص؟ سيتم حذف مواد التخصص وملفاته فقط من خطتك الدراسية، مع الحفاظ التام على مواد الكلية العامة للسنوات السابقة.'
                  : 'Are you sure you want to disconnect? Only specialization subjects and files will be removed, preserving all common foundation subjects.'}
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsUnlinkSpecModalOpen(false)}
                disabled={unlinkingSpec}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                {isAr ? 'تراجع وإلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlinkSpec}
                disabled={unlinkingSpec}
                className="w-full sm:w-auto px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-500/25 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {unlinkingSpec ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                <span>{isAr ? 'نعم، إلغاء التخصص ومسح مواده' : 'Yes, Disconnect'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* University Restore Modal */}
      <UniversityRestoreModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        mode={restoreModalMode}
      />
    </div>
  );
}
