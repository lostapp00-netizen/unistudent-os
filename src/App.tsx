import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';

// Academic
import { AcademicDashboard } from './pages/academic/AcademicDashboard';
import { AcademicSubjects } from './pages/academic/AcademicSubjects';
import { AcademicRecovery } from './pages/academic/AcademicRecovery';
import { AcademicSimulation } from './pages/academic/AcademicSimulation';
import { AcademicWarnings } from './pages/academic/AcademicWarnings';
import { SubjectDetails } from './pages/SubjectDetails';

import { StudentGuide } from './pages/StudentGuide';

// Productivity
import { ProductivityDashboard } from './pages/productivity/ProductivityDashboard';
import { TasksTab } from './components/productivity/TasksTab';
import { NotesTab } from './components/productivity/NotesTab';
import { DriveTab } from './components/productivity/DriveTab';
import { CalendarTab } from './components/productivity/CalendarTab';
import { Schedule } from './pages/productivity/Schedule';
import { Appointments } from './pages/productivity/Appointments';

import { useAppStore } from './store/useAppStore';

// Persistent red banner whenever a database write fails (db.ts dispatches
// `unistudent-save-error`). It stays on screen until the user dismisses it —
// the raw database error is shown in full so the actual SQL problem is never
// hidden behind a silent "saved anyway" behavior.
function SaveErrorToast() {
  const [error, setError] = useState<{ message: string; pendingCount: number } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let hideSuccessTimer: ReturnType<typeof setTimeout> | undefined;
    const errorHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setError({
        message: detail.message || 'خطأ غير معروف من قاعدة البيانات',
        pendingCount: detail.pendingCount || 0
      });
    };
    const successHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setSuccess(`تم رفع ${detail.flushed} عملية كانت محفوظة مؤقتًا — كل البيانات سليمة الآن`);
      if (hideSuccessTimer) clearTimeout(hideSuccessTimer);
      hideSuccessTimer = setTimeout(() => setSuccess(null), 8000);
    };
    window.addEventListener('unistudent-save-error', errorHandler);
    window.addEventListener('unistudent-save-success', successHandler);
    return () => {
      window.removeEventListener('unistudent-save-error', errorHandler);
      window.removeEventListener('unistudent-save-success', successHandler);
      if (hideSuccessTimer) clearTimeout(hideSuccessTimer);
    };
  }, []);

  return (
    <>
      {error && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[94%] bg-rose-600 text-white text-xs px-4 py-3.5 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
          <div className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-white shrink-0 animate-pulse mt-1.5" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="font-black">تعذر الحفظ في قاعدة البيانات — المشكلة في إعدادات الـ SQL وليست من جهازك</p>
              <p className="font-mono bg-black/25 rounded-xl px-2.5 py-1.5 leading-relaxed break-words text-[11px]" dir="ltr">
                {error.message}
              </p>
              {error.pendingCount > 0 && (
                <p className="text-white/85">
                  فيه {error.pendingCount} عملية محفوظة مؤقتًا على جهازك — هتترفع تلقائيًا بعد حل المشكلة دي
                </p>
              )}
            </div>
            <button
              onClick={() => setError(null)}
              className="shrink-0 p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer font-black"
              title="إغلاق التنبيه"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {success && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
          <span className="w-2 h-2 rounded-full bg-white shrink-0" />
          <span className="leading-relaxed">{success}</span>
        </div>
      )}
    </>
  );
}

export function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const isInitialized = useAppStore(state => state.isInitialized);
  const initialize = useAppStore(state => state.initialize);
  const clearData = useAppStore(state => state.clearData);

  const settings = useAppStore(state => state.settings);

  useEffect(() => {
    import('./i18n/config').then(({ default: i18n }) => {
      i18n.changeLanguage(settings.language);
    }).catch(console.error);
    document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  useEffect(() => {
    document.title = "UniStudent OS";
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        initialize(session.user.id, session.user.email).catch(console.error).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error('Session get error:', err);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Only re-initialize when the authenticated user actually CHANGES.
      // Supabase emits TOKEN_REFRESHED / duplicate SIGNED_IN events when the
      // window regains focus (e.g. after closing the OS file picker or
      // switching apps). Re-running initialize() for the same user used to
      // flip isInitialized to false and unmount the whole UI — that was the
      // cause of the "page refreshes itself and wipes my form" bug.
      const nextUserId = session?.user?.id || null;
      const currentUserId = useAppStore.getState().userId;
      if (nextUserId && nextUserId !== currentUserId) {
        initialize(nextUserId, session.user.email).catch(console.error);
      } else if (!nextUserId && currentUserId) {
        clearData();
      }
    });

    return () => subscription.unsubscribe();
  }, [initialize, clearData]);

  // Real-time & periodic synchronization for students linked to a university database.
  // The realtime channel is subscribed ONCE per session: re-subscribing on every
  // settings change made `supabase.channel('university_global_sync')` return the
  // still-registered previous channel, and adding postgres_changes callbacks to an
  // already-subscribed channel throws (crashing the app right after login).
  useEffect(() => {
    if (!session?.user?.id) return;

    const triggerSync = () => {
      // Linked-state is checked live at event time, not at subscription time.
      if (useAppStore.getState().settings.universityDatabaseId) {
        useAppStore.getState().syncWithUniversityDatabase();
      }
    };

    window.addEventListener('focus', triggerSync);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Periodic fast check (5s) to guarantee real-time reflection
    const interval = setInterval(triggerSync, 5000);

    let channel: any = null;
    try {
      // Remove any stale channel registered under the same topic (e.g. left by
      // an earlier broadcast) before attaching postgres_changes callbacks.
      supabase.getChannels()
        .filter(c => c.topic === 'realtime:university_global_sync')
        .forEach(c => { try { supabase.removeChannel(c); } catch {} });

      channel = supabase
        .channel('university_global_sync')
        .on(
          'broadcast',
          { event: 'university_db_updated' },
          (payload: any) => {
            const data = payload?.payload;
            if (data?.action === 'deleted') {
              const { settings, unlinkUniversityDatabase, unlinkSpecializationDatabase } = useAppStore.getState();
              if (data.type === 'specialization') {
                if (settings.specializationDatabaseId === data.id) {
                  unlinkSpecializationDatabase();
                }
              } else if (data.type === 'college') {
                if (
                  settings.universityDatabaseId === data.id ||
                  (Array.isArray(data.childSpecIds) && data.childSpecIds.includes(settings.specializationDatabaseId)) ||
                  (settings.college && data.collegeNameAr && (settings.college.includes(data.collegeNameAr) || data.collegeNameAr.includes(settings.college)))
                ) {
                  unlinkUniversityDatabase();
                }
              } else if (data.type === 'university') {
                if (
                  (settings.university && data.uniKey && settings.university.trim() === data.uniKey.trim()) ||
                  (Array.isArray(data.deletedDbIds) && (data.deletedDbIds.includes(settings.universityDatabaseId) || data.deletedDbIds.includes(settings.specializationDatabaseId)))
                ) {
                  unlinkUniversityDatabase();
                }
              }
              return;
            }
            triggerSync();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'university_databases'
          },
          () => {
            triggerSync();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'university_pending_updates'
          },
          () => {
            triggerSync();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime channel setup warning:', e);
    }

    return () => {
      window.removeEventListener('focus', triggerSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, [session?.user?.id]);

  const isAdminPath = window.location.pathname.startsWith('/admin');

  if (loading || (session && !isInitialized && !isAdminPath)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-zinc-500">جاري تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <SaveErrorToast />
      <Routes>
        <Route path="/admin" element={<Admin />} />
        
        {!session ? (
          <>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/auth" element={<Navigate to="/" replace />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              
              <Route path="academic">
                <Route index element={<AcademicDashboard />} />
                <Route path="subjects" element={<AcademicSubjects />} />
                <Route path="recovery" element={<AcademicRecovery />} />
                <Route path="simulation" element={<AcademicSimulation />} />
                <Route path="warnings" element={<AcademicWarnings />} />
                <Route path=":id" element={<SubjectDetails />} />
              </Route>
              
              <Route path="productivity">
                <Route index element={<ProductivityDashboard />} />
                <Route path="tasks" element={<TasksTab />} />
                <Route path="notes" element={<NotesTab />} />
                <Route path="drive" element={<DriveTab />} />
                <Route path="calendar" element={<CalendarTab />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="appointments" element={<Appointments />} />
              </Route>
              
              <Route path="settings" element={<Settings />} />
              <Route path="guide" element={<StudentGuide />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
