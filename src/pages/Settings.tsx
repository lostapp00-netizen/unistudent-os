import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { GradingScale } from '../components/settings/GradingScale';
import { SemestersManager } from '../components/settings/SemestersManager';
import { UserFeedbackSection } from '../components/settings/UserFeedbackSection';

export function Settings() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAppStore();
  
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

      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          حفظ البيانات الآن (تحديث جديد)
        </button>
      </div>
    </div>
  );
}
