
import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, BookOpen, Calendar, LayoutDashboard, Settings, Sun, Moon, 
  ChevronDown, ChevronRight, CheckSquare, StickyNote, HardDrive, 
  Clock, AlertTriangle, Library, ListTodo, Menu, X, Calculator, Target, LogOut } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { getWarningThreshold, isSubjectAtWarningRisk } from '../lib/academic';
import { cn } from '../lib/utils';

export function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { subjects, settings, updateTheme, updateLanguage } = useAppStore();
  
  const [academicExpanded, setAcademicExpanded] = useState(location.pathname.startsWith('/academic'));
  const [productivityExpanded, setProductivityExpanded] = useState(location.pathname.startsWith('/productivity'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Compute warning subjects count for red notification badge
  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const currentSubjects = subjects.filter(
    s => s.yearIndex === currentSemester?.yearIndex && s.semesterIndex === currentSemester?.semesterIndex
  );
  const threshold = getWarningThreshold(settings);
  const warningCount = currentSubjects.filter(s => 
    isSubjectAtWarningRisk(s, settings.gradingScale, threshold.points)
  ).length;

  // Close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    i18n.changeLanguage(settings.language);
    document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = settings.language;
  }, [settings.language, i18n]);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const toggleTheme = () => updateTheme(settings.theme === 'dark' ? 'light' : 'dark');
  const toggleLanguage = () => updateLanguage(settings.language === 'ar' ? 'en' : 'ar');

  const ChevronIcon = settings.language === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 overflow-hidden font-sans relative">
      
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 z-50 flex-shrink-0 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white flex flex-col transition-all duration-300 ease-in-out md:relative shadow-xl md:shadow-none",
        isSidebarOpen ? "w-64" : "w-64 md:w-20",
        settings.language === 'ar' ? "right-0 border-l border-zinc-200 dark:border-zinc-800" : "left-0 border-r border-zinc-200 dark:border-zinc-800",
        isSidebarOpen ? "translate-x-0" : (settings.language === 'ar' ? "translate-x-full md:translate-x-0" : "-translate-x-full md:translate-x-0")
      )}>
        
        {/* Desktop Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={cn(
            "hidden md:flex absolute top-8 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full p-1.5 shadow-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-transform",
            settings.language === 'ar' ? "-left-3.5" : "-right-3.5"
          )}
        >
          {isSidebarOpen ? <ChevronIcon size={16} className={settings.language === 'ar' ? 'rotate-180' : 'rotate-180'} /> : <ChevronIcon size={16} />}
        </button>

        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center h-[85px]">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shrink-0">U</div>
              <span className="text-2xl font-black tracking-tighter shrink-0">
                Uni<span className="text-indigo-600 dark:text-indigo-400">OS</span>
              </span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shrink-0 mx-auto hidden md:flex">U</div>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
          <NavLink
            to="/"
            className={({ isActive }) => cn(
              "flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors mb-2",
              isActive 
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-600 dark:text-white" 
                : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            {isSidebarOpen && t('dashboard')}
          </NavLink>

          <div>
            <button 
              onClick={() => setAcademicExpanded(!academicExpanded)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors relative",
                location.pathname.startsWith('/academic') && !academicExpanded
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-600 dark:text-white"
                  : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              <div className="flex items-center gap-3 relative">
                <div className="relative">
                  <BookOpen className="w-5 h-5" />
                  {!isSidebarOpen && warningCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-white dark:ring-zinc-900 animate-ping" />
                  )}
                  {!isSidebarOpen && warningCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
                  )}
                </div>
                {isSidebarOpen && (
                  <span className="flex items-center gap-2">
                    <span>{t('academic')}</span>
                    {warningCount > 0 && (
                      <span className="px-1.5 py-0.2 text-[11px] font-black bg-rose-500 text-white rounded-full animate-pulse shadow-xs">
                        {warningCount}
                      </span>
                    )}
                  </span>
                )}
              </div>
              {isSidebarOpen && (academicExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className={cn("w-4 h-4", settings.language === 'ar' && "rotate-180 transform")} />)}
            </button>
            
            {academicExpanded && isSidebarOpen && (
              <div className="mt-1 ml-4 border-l-2 border-zinc-100 dark:border-zinc-800 pl-3 space-y-1">
                <NavLink to="/academic" end className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <LayoutDashboard className="w-4 h-4" /> {t('academic_dashboard')}
                </NavLink>
                <NavLink to="/academic/subjects" className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <Library className="w-4 h-4" /> {t('subjects')}
                </NavLink>
                <NavLink to="/academic/simulation" className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <Calculator className="w-4 h-4" /> {settings.language === 'ar' ? 'محاكاة المعدل' : 'GPA Simulation'}
                </NavLink>
                <NavLink to="/academic/recovery" className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <Target className="w-4 h-4" /> {settings.language === 'ar' ? 'خطة التحسين' : 'Recovery Plan'}
                </NavLink>
                <NavLink to="/academic/warnings" className={({ isActive }) => cn("flex items-center justify-between gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${warningCount > 0 ? 'text-rose-500' : ''}`} /> 
                    <span>{t('warnings_improvements')}</span>
                  </div>
                  {warningCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-black bg-rose-500 text-white rounded-full animate-pulse shadow-sm">
                      {warningCount}
                    </span>
                  )}
                </NavLink>
              </div>
            )}
          </div>

          <div className="mt-2">
            <button 
              onClick={() => setProductivityExpanded(!productivityExpanded)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors",
                location.pathname.startsWith('/productivity') && !productivityExpanded
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-600 dark:text-white"
                  : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              <div className="flex items-center gap-3">
                <ListTodo className="w-5 h-5" />
                {isSidebarOpen && t('productivity')}
              </div>
              {isSidebarOpen && (productivityExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className={cn("w-4 h-4", settings.language === 'ar' && "rotate-180 transform")} />)}
            </button>
            
            {productivityExpanded && isSidebarOpen && (
              <div className="mt-1 ml-4 border-l-2 border-zinc-100 dark:border-zinc-800 pl-3 space-y-1">
                <NavLink to="/productivity" end className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <LayoutDashboard className="w-4 h-4" /> {t('productivity_dashboard')}
                </NavLink>
                <NavLink to="/productivity/tasks" className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <CheckSquare className="w-4 h-4" /> {t('tasks')}
                </NavLink>
                <NavLink to="/productivity/notes" className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <StickyNote className="w-4 h-4" /> {t('notes')}
                </NavLink>
                <NavLink to="/productivity/calendar" className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <Calendar className="w-4 h-4" /> {t('calendar')}
                </NavLink>
                <NavLink to="/productivity/schedule" className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <Clock className="w-4 h-4" /> {t('my_schedule')}
                </NavLink>
                <NavLink to="/productivity/appointments" className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <Calendar className="w-4 h-4" /> {t('my_appointments')}
                </NavLink>
                <NavLink to="/productivity/drive" className={({ isActive }) => cn("flex items-center gap-2 p-2 rounded-lg text-sm transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 font-bold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}>
                  <HardDrive className="w-4 h-4" /> {t('drive')}
                </NavLink>
              </div>
            )}
          </div>

          <NavLink
            to="/settings"
            className={({ isActive }) => cn(
              "flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors mt-2",
              isActive 
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-600 dark:text-white" 
                : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            )}
          >
            <Settings className="w-5 h-5" />
            {isSidebarOpen && t('settings')}
          </NavLink>
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
              title={settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {settings.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            {isSidebarOpen && (
              <button 
                onClick={toggleLanguage}
                className="px-2.5 py-1.5 text-xs font-bold rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors uppercase tracking-wider"
              >
                {settings.language === 'ar' ? 'EN' : 'عربي'}
              </button>
            )}
          </div>

          <button
            onClick={async () => {
              sessionStorage.removeItem('unistudent_admin_auth');
              await supabase.auth.signOut();
              window.location.href = '/auth';
            }}
            className={cn(
              "p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all flex items-center gap-2",
              isSidebarOpen ? "px-3 py-1.5 text-xs font-bold bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40" : ""
            )}
            title={settings.language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
          >
            <LogOut className="w-4 h-4" />
            {isSidebarOpen && (
              <span>{settings.language === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
            )}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden p-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-40 sticky top-0 shadow-xs">
          <div className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">{t('app_name')}</div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -mr-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <div className="w-full max-w-7xl mx-auto p-4 md:p-8 min-h-full flex flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
