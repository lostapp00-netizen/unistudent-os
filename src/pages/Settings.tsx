import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { GradingScale } from '../components/settings/GradingScale';
import { SemestersManager } from '../components/settings/SemestersManager';
import { UserFeedbackSection } from '../components/settings/UserFeedbackSection';
import { supabase } from '../lib/supabase';

export function Settings() {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings, userEmail } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';
  
  const [formData, setFormData] = useState({
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
    warningGpaPoints: settings.warningGpaPoints
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    const p1 = newPassword.trim();
    const p2 = confirmPassword.trim();

    if (p1.length < 6) {
      setPasswordStatus({
        type: 'error',
        message: isAr ? 'يجب أن تتكون كلمة المرور من 6 أحرف/أرقام على الأقل.' : 'Password must be at least 6 characters.'
      });
      return;
    }

    if (p1 !== p2) {
      setPasswordStatus({
        type: 'error',
        message: isAr ? 'كلمتا المرور غير متطابقتين. يرجى التأكد من التطابق.' : 'Passwords do not match.'
      });
      return;
    }

    try {
      setPasswordLoading(true);
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw error;

      setPasswordStatus({
        type: 'success',
        message: isAr ? 'تم تحديث كلمة المرور بنجاح!' : 'Password updated successfully!'
      });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordStatus({
        type: 'error',
        message: err.message || (isAr ? 'حدث خطأ أثناء تحديث كلمة المرور.' : 'Failed to update password.')
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaveStatus(null);
      
      const newSettings = {
        ...formData,
        totalYears: Number(formData.totalYears),
        semestersPerYear: Number(formData.semestersPerYear),
        initialCumulativeGpa: formData.initialCumulativeGpa != null ? Number(formData.initialCumulativeGpa) : null,
        initialCompletedCreditHours: formData.initialCompletedCreditHours != null ? Number(formData.initialCompletedCreditHours) : null,
      };
      
      const { userId } = useAppStore.getState();
      if (userId) {
        const { db } = await import('../lib/db');
        await db.upsertSettings(userId, newSettings);
      }
      
      updateSettings(newSettings);
      setSaveStatus({ type: 'success', message: 'تم حفظ الإعدادات بنجاح!' });
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: 'حدث خطأ: ' + err.message });
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings')}</h1>
      </header>
      
      {saveStatus && (
        <div className={`p-4 rounded-xl font-medium ${saveStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {saveStatus.message}
        </div>
      )}
      
      <section className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
        <h2 className="text-xl font-semibold border-b border-zinc-100 dark:border-zinc-800 pb-4">{t('profile_settings')}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('name')}</label>
            <input 
              type="text" 
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('university')}</label>
            <input 
              type="text" 
              name="university"
              value={formData.university}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('college')}</label>
            <input 
              type="text" 
              name="college"
              value={formData.college}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('enrollment_date')}</label>
            <input 
              type="date" 
              name="enrollmentDate"
              value={formData.enrollmentDate}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
        <h2 className="text-xl font-semibold border-b border-zinc-100 dark:border-zinc-800 pb-4">{t('academic_plan')}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('total_years')}</label>
            <input 
              type="number" 
              name="totalYears"
              value={formData.totalYears}
              onChange={handleChange}
              min="1"
              max="10"
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('semesters_per_year')}</label>
            <input 
              type="number" 
              name="semestersPerYear"
              value={formData.semestersPerYear}
              onChange={handleChange}
              min="1"
              max="4"
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
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

      <section className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
        <GradingScale 
          scale={formData.gradingScale}
          onChange={(newScale) => setFormData(prev => ({ ...prev, gradingScale: newScale }))}
        />
      </section>

      {/* User Suggestions & Feedback Section */}
      <UserFeedbackSection />

      {/* Account Security & Password Change Section */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="text-indigo-600 dark:text-indigo-400">🔒</span>
              <span>{isAr ? 'أمان الحساب وتغيير كلمة المرور' : 'Account Security & Password'}</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {isAr ? 'يمكنك تحديث كلمة المرور الخاصة بحسابك في أي وقت' : 'You can update your account password at any time'}
            </p>
          </div>
          {userEmail && (
            <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-bold">
              {userEmail}
            </span>
          )}
        </div>

        {passwordStatus && (
          <div className={`p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 ${
            passwordStatus.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50' 
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
          }`}>
            <span>{passwordStatus.message}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isAr ? 'كلمة المرور الجديدة' : 'New Password'}
            </label>
            <input 
              type="password" 
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
            </label>
            <input 
              type="password" 
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={passwordLoading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-2"
            >
              <span>{passwordLoading ? (isAr ? 'جاري التحديث...' : 'Updating...') : (isAr ? 'تحديث كلمة المرور' : 'Update Password')}</span>
            </button>
          </div>
        </form>
      </section>

      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          {isAr ? 'حفظ إعدادات الملف الشخصي' : 'Save Profile Settings'}
        </button>
      </div>
    </div>
  );
}
