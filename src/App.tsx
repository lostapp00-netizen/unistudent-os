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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        initialize(session.user.id, session.user.email).catch(console.error);
      } else {
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
                  settings.college === data.collegeNameAr ||
                  (Array.isArray(data.childSpecIds) && data.childSpecIds.includes(settings.specializationDatabaseId))
                ) {
                  unlinkUniversityDatabase();
                }
              } else if (data.type === 'university') {
                if (settings.university === data.uniKey) {
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
