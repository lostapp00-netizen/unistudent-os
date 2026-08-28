import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Auth } from './pages/Auth';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';

// Academic
import { AcademicDashboard } from './pages/academic/AcademicDashboard';
import { AcademicSubjects } from './pages/academic/AcademicSubjects';
import { AcademicRecovery } from './pages/academic/AcademicRecovery';
import { AcademicSimulation } from './pages/academic/AcademicSimulation';
import { AcademicWarnings } from './pages/academic/AcademicWarnings';
import { SubjectDetails } from './pages/SubjectDetails';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        initialize(session.user.id).catch(console.error).finally(() => setLoading(false));
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
        initialize(session.user.id).catch(console.error);
      } else {
        clearData();
      }
    });

    return () => subscription.unsubscribe();
  }, [initialize, clearData]);

  if (loading || (session && !isInitialized)) {
    return <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">جاري تحميل البيانات...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <BrowserRouter>
      <Routes>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
