import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Calculator, 
  Target, 
  AlertTriangle, 
  BookOpen, 
  CheckSquare, 
  HardDrive, 
  Sun, 
  Moon, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Award, 
  ChevronDown, 
  HelpCircle, 
  Check, 
  LogIn, 
  UserPlus, 
  TrendingUp, 
  Flame, 
  CheckCircle2,
  Menu,
  X
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function Landing() {
  const { t, i18n } = useTranslation();
  const { settings, updateTheme, updateLanguage } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive Live GPA Demo State
  const [demoSubjects, setDemoSubjects] = useState([
    { id: '1', name: isAr ? 'الرياضيات المتقدمة' : 'Advanced Math', credits: 3, grade: 'A', points: 3.7 },
    { id: '2', name: isAr ? 'هياكل البيانات' : 'Data Structures', credits: 4, grade: 'A+', points: 4.0 },
    { id: '3', name: isAr ? 'نظم التشغيل' : 'Operating Systems', credits: 3, grade: 'B+', points: 3.3 },
    { id: '4', name: isAr ? 'اللغة الإنجليزية الأكاديمية' : 'Academic English', credits: 2, grade: 'A', points: 3.7 },
  ]);

  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  // Compute Demo GPA
  const totalCredits = demoSubjects.reduce((acc, s) => acc + s.credits, 0);
  const totalPoints = demoSubjects.reduce((acc, s) => acc + (s.credits * s.points), 0);
  const demoGpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';

  const gradeOptions = [
    { letter: 'A+', points: 4.0 },
    { letter: 'A', points: 3.7 },
    { letter: 'B+', points: 3.3 },
    { letter: 'B', points: 3.0 },
    { letter: 'C+', points: 2.7 },
    { letter: 'C', points: 2.4 },
    { letter: 'D', points: 2.0 },
    { letter: 'F', points: 0.0 },
  ];

  const updateDemoGrade = (id: string, letter: string) => {
    const found = gradeOptions.find(g => g.letter === letter);
    if (!found) return;
    setDemoSubjects(prev => prev.map(s => s.id === id ? { ...s, grade: letter, points: found.points } : s));
  };

  const updateDemoCredits = (id: string, credits: number) => {
    setDemoSubjects(prev => prev.map(s => s.id === id ? { ...s, credits: Math.max(1, credits) } : s));
  };

  const faqs = [
    {
      q: isAr ? 'هل منصة UniStudent OS مجانية بالكامل حقاً؟' : 'Is UniStudent OS truly 100% free?',
      a: isAr 
        ? 'نعم، المنصة مجانية 100% بدون أي رسوم اشتراك، بدون إعلانات مزعجة، وبدون أي مميزات محجوبة. تم تطويرها لمساعدة الطلاب على التفوق الدراسي.' 
        : 'Yes, UniStudent OS is 100% free with no subscription fees, no ads, and no locked features.'
    },
    {
      q: isAr ? 'كيف تعمل حاسبة ومحاكي المعدل التراكمي؟' : 'How does the GPA Calculator & Simulator work?',
      a: isAr 
        ? 'توفر المنصة محرك حساب ذكي يدعم نظام الساعات المعتمدة، مقياس 4.0 و 5.0 والنسب المئوية، مع محاكاة فورية لتأثير أي تقدير متوقع على معدلك التراكمي الإجمالي.' 
        : 'Our GPA engine supports credit hours, 4.0 and 5.0 scales, percentage systems, and live simulation of expected grades on your overall CGPA.'
    },
    {
      q: isAr ? 'ما هي خطة استعادة المعدل (Recovery Plan) وكاشف الإنذارات؟' : 'What is the Recovery Plan and Warning Detector?',
      a: isAr 
        ? 'إذا كان معدلك مهدداً بالانخفاض أو الإنذار الأكاديمي، تحسب المنصة تلقائياً الحد الأدنى من الدرجات والساعات المطلوبة لرفع معدلك وتجاوز الخطر الأكاديمي مع تنبيهات مبكرة.' 
        : 'If your GPA is at risk of academic warning, the algorithm automatically calculates the exact minimum grades and credit hours required to recover.'
    },
    {
      q: isAr ? 'هل بياناتي وملفاتي المرفوعة آمنة وسرية؟' : 'Are my files and personal data secure?',
      a: isAr 
        ? 'نعم، كافة بياناتك مشفرة ومحمية في قواعد بيانات سحابية متقدمة مع دعم التخزين السحابي الآمن لكافة الملازم والملخصات.' 
        : 'Yes, all your academic data and files are securely encrypted and backed up in cloud storage.'
    },
    {
      q: isAr ? 'هل يدعم الموقع الهاتف المحمول والوضع الليلي؟' : 'Does it support mobile devices and Dark Mode?',
      a: isAr 
        ? 'بالتأكيد، المنصة مصممة بتجاوب فائق مع كافة شاشات الهواتف والتابلت والكمبيوتر، مع دعم كامل للوضع الليلي المريح للعين واللغتين العربية والإنجليزية.' 
        : 'Absolutely! The platform is fully responsive on mobile, tablet, and desktop, with sleek Dark Mode and dual Arabic/English support.'
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans selection:bg-blue-500 selection:text-white transition-colors overflow-x-clip" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* --- TOP NAVBAR --- */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-600 to-blue-500 text-white flex items-center justify-center font-black text-base sm:text-xl shadow-md sm:shadow-lg shadow-blue-600/25 group-hover:scale-105 transition-transform">
              U
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="text-lg sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                  Uni<span className="text-blue-600 dark:text-blue-400">Student</span>
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  OS
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium hidden md:block">
                {isAr ? 'نظام إدارة الحياة الجامعية المتكامل' : 'The University Operating System'}
              </p>
            </div>
          </Link>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-bold text-zinc-600 dark:text-zinc-300">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              {isAr ? 'المميزات الأكاديمية' : 'Academic Tools'}
            </a>
            <a href="#productivity" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              {isAr ? 'أدوات الإنتاجية' : 'Productivity Suite'}
            </a>
            <a href="#simulator" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              {isAr ? 'المحاكي التفاعلي' : 'Live Simulator'}
            </a>
            <a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              {isAr ? 'الأسئلة الشائعة' : 'FAQ'}
            </a>
          </nav>

          {/* Right Actions: Theme, Language, Login, Register */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            
            {/* Theme Toggle Button */}
            <button
              onClick={() => updateTheme(settings.theme === 'dark' ? 'light' : 'dark')}
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-all border border-zinc-200 dark:border-zinc-800 shadow-2xs"
              title={settings.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Language Toggle Button */}
            <button
              onClick={() => updateLanguage(isAr ? 'en' : 'ar')}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] sm:text-xs font-black transition-all border border-zinc-200 dark:border-zinc-800 shadow-2xs uppercase tracking-wider"
              aria-label="Toggle Language"
            >
              {isAr ? 'EN' : 'عربي'}
            </button>

            {/* Sign In Button (Desktop) */}
            <Link
              to="/auth"
              className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all"
            >
              <LogIn size={15} />
              <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
            </Link>

            {/* Create Account CTA (Desktop) */}
            <Link
              to="/auth?mode=signup"
              className="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <UserPlus size={15} />
              <span>{isAr ? 'إنشاء حساب مجاناً' : 'Get Started Free'}</span>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition-all"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-4 py-4 space-y-4 shadow-2xl">
            <nav className="flex flex-col gap-1 text-sm font-bold text-zinc-700 dark:text-zinc-200">
              <a 
                href="#features" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-between"
              >
                <span>{isAr ? 'المميزات الأكاديمية' : 'Academic Tools'}</span>
              </a>
              <a 
                href="#productivity" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-between"
              >
                <span>{isAr ? 'أدوات الإنتاجية' : 'Productivity Suite'}</span>
              </a>
              <a 
                href="#simulator" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-between"
              >
                <span>{isAr ? 'المحاكي التفاعلي' : 'Live Simulator'}</span>
              </a>
              <a 
                href="#faq" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-between"
              >
                <span>{isAr ? 'الأسئلة الشائعة' : 'FAQ'}</span>
              </a>
            </nav>

            {/* Auth Actions inside Mobile Menu */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col gap-2.5">
              <Link
                to="/auth?mode=signup"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-sm font-bold shadow-md shadow-blue-600/25 active:scale-[0.98] transition-all"
              >
                <UserPlus size={16} />
                <span>{isAr ? 'إنشاء حساب مجاناً' : 'Get Started Free'}</span>
              </Link>

              <Link
                to="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 active:scale-[0.98] transition-all"
              >
                <LogIn size={16} />
                <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-8 pb-14 sm:pt-16 sm:pb-24 overflow-hidden">
        
        {/* Background Glowing Ambient Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[600px] md:w-[900px] h-[300px] sm:h-[400px] bg-gradient-to-tr from-blue-500/15 via-blue-500/10 to-blue-500/10 blur-[90px] sm:blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 sm:space-y-8">
          
          {/* Pill Badge */}
          <div className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-[11px] sm:text-xs md:text-sm font-black shadow-xs max-w-full text-center">
            <Sparkles size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-center leading-tight sm:leading-normal">
              {isAr ? 'المنصة الأكاديمية والإنتاجية الأولى لطلاب الجامعات • 100% مجاناً' : 'The #1 University OS • 100% Free Forever'}
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight max-w-4xl mx-auto leading-tight sm:leading-[1.2] text-zinc-900 dark:text-white px-1">
            {isAr ? (
              <>
                منصاتك الأكاديمية في مكان واحد — نظّم موادك وملفاتك، اصنع <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-600 to-blue-400">ملاحظاتك ومهامك</span>، واحسب <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-600 to-blue-400">معدلك بدقة</span>.
              </>
            ) : (
              <>
                Your Academic Platforms in One Place — Organize Courses & Files, Craft <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-600 to-blue-400">Your Notes & Tasks</span>, and Calculate <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-600 to-blue-400">Your GPA</span> Accurately.
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-base md:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed font-medium px-2 sm:px-0">
            {isAr 
              ? 'كل ما يحتاجه الطالب الجامعي في منصة واحدة ذكية: حاسبة المعدل التراكمي ومحاكاة التقديرات، خطة تجاوز الإنذارات والتعويض، إدارة المهام والملاحظات، الجدول الأسبوعي، والمستودع السحابي للملفات.'
              : 'The ultimate student workspace: GPA Calculator & Target Simulator, Academic Recovery Plan, Warning Detection Radar, Task Kanban, Class Timetable, Rich Notes & Cloud Drive.'}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full max-w-md sm:max-w-none mx-auto">
            <Link
              to="/auth?mode=signup"
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-base shadow-lg sm:shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>{isAr ? 'ابدأ الآن مجاناً وبدون أي رسوم' : 'Start Free Workspace'}</span>
              <ArrowIcon size={18} />
            </Link>

            <a
              href="#simulator"
              className="w-full sm:w-auto px-5 sm:px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-sm sm:text-base border border-zinc-200 dark:border-zinc-800 transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.98]"
            >
              <Calculator size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{isAr ? 'تجربة حاسبة المعدل التفاعلية' : 'Try Live GPA Calculator'}</span>
            </a>
          </div>

          {/* Trust Badges */}
          <div className="pt-3 grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2.5 sm:gap-6 text-[11px] sm:text-xs font-bold text-zinc-600 dark:text-zinc-400">
            <div className="p-2 sm:p-0 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/60 sm:bg-transparent sm:border-0 flex items-center justify-center sm:justify-start gap-1.5 text-center">
              <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
              <span>{isAr ? 'مجاني تماماً 100%' : '100% Free Forever'}</span>
            </div>
            <div className="p-2 sm:p-0 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/60 sm:bg-transparent sm:border-0 flex items-center justify-center sm:justify-start gap-1.5 text-center">
              <ShieldCheck size={15} className="text-blue-500 shrink-0" />
              <span>{isAr ? 'خصوصية وأمان تام' : 'Private & Secure'}</span>
            </div>
            <div className="p-2 sm:p-0 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/60 sm:bg-transparent sm:border-0 flex items-center justify-center sm:justify-start gap-1.5 text-center">
              <Zap size={15} className="text-amber-500 shrink-0" />
              <span>{isAr ? 'متجاوب مع كل الأجهزة' : 'All Devices'}</span>
            </div>
            <div className="p-2 sm:p-0 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/60 sm:bg-transparent sm:border-0 flex items-center justify-center sm:justify-start gap-1.5 text-center">
              <Award size={15} className="text-blue-500 shrink-0" />
              <span>{isAr ? 'كافة التخصصات' : 'Universal Credits'}</span>
            </div>
          </div>

          {/* --- HERO LIVE APP PREVIEW MOCKUP --- */}
          <div className="pt-6 sm:pt-10 max-w-5xl mx-auto px-0 sm:px-2">
            <div className="relative rounded-2xl sm:rounded-3xl p-2 sm:p-4 bg-gradient-to-b from-blue-500/20 via-zinc-200/40 to-transparent dark:from-blue-500/20 dark:via-zinc-800/40 dark:to-transparent border border-zinc-200/80 dark:border-zinc-800/80 shadow-xl sm:shadow-2xl backdrop-blur-xl">
              
              <div className="bg-white dark:bg-zinc-900 rounded-xl sm:rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-inner">
                
                {/* Mock Window Header */}
                <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500" />
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500" />
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500" />
                    <span className="text-[11px] sm:text-xs font-black text-zinc-400 ml-1 hidden sm:inline">UniStudent OS Dashboard</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                      CGPA: 3.82 / 4.00 ({isAr ? 'امتياز' : 'Honors'})
                    </span>
                  </div>
                </div>

                {/* Mock Dashboard Grid */}
                <div className="p-3.5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-5 text-start">
                  
                  {/* Card 1: Academic Engine Dial */}
                  <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/30 dark:to-zinc-900 border border-blue-100 dark:border-blue-900/40 space-y-2.5 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-500">{isAr ? 'المعدل التراكمي الحالي' : 'Cumulative GPA'}</span>
                      <div className="p-1.5 sm:p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400">
                        <TrendingUp size={15} />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">3.82</div>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 sm:mt-1">
                        +0.18 {isAr ? 'تحسن عن الفصل السابق' : 'increase this semester'}
                      </p>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>

                  {/* Card 2: Recovery & Warning Status */}
                  <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-zinc-900 border border-emerald-100 dark:border-emerald-900/40 space-y-2.5 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-500">{isAr ? 'حالة الإنذارات الأكاديمية' : 'Warning Risk Radar'}</span>
                      <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck size={15} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                        {isAr ? 'سليم ومستقر 100%' : 'Safe & Good Standing'}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 sm:mt-1">
                        {isAr ? '0 إنذارات • كافة المواد فوق الأمان' : '0 warnings • all courses safe'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/30 p-2 rounded-lg sm:rounded-xl">
                      <Check size={13} className="shrink-0" />
                      <span>{isAr ? 'مؤهل لمرتبة الشرف' : 'Eligible for Honors'}</span>
                    </div>
                  </div>

                  {/* Card 3: Productivity Kanban Preview */}
                  <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/30 dark:to-zinc-900 border border-blue-100 dark:border-blue-900/40 space-y-2.5 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-500">{isAr ? 'المهام والتكليفات اليومية' : 'Tasks & Deadlines'}</span>
                      <div className="p-1.5 sm:p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                        <CheckSquare size={15} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="p-2 bg-white dark:bg-zinc-800/80 rounded-lg sm:rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{isAr ? 'مشروع مادة الخوارزميات' : 'Algorithms Project'}</span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-rose-100 dark:bg-rose-900/40 text-rose-600 shrink-0">
                          {isAr ? 'غداً' : 'Tomorrow'}
                        </span>
                      </div>
                      <div className="p-2 bg-white dark:bg-zinc-800/80 rounded-lg sm:rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{isAr ? 'تلخيص المحاضرة الخامسة' : 'Lecture 5 Notes'}</span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 shrink-0">
                          {isAr ? 'منجز' : 'Done'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- ALL FEATURES COMPREHENSIVE BREAKDOWN --- */}
      <section id="features" className="py-12 sm:py-20 bg-white dark:bg-zinc-900/50 border-y border-zinc-200 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-2.5 sm:space-y-3">
            <h2 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              {isAr ? 'ترسانة الأدوات الأكاديمية والإنتاجية' : 'The Complete Academic Arsenal'}
            </h2>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-900 dark:text-white leading-tight">
              {isAr ? 'كل ما تحتاجه للنجاح الجامعي والتفوق الأكاديمي' : 'Engineered for Total University Mastery'}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium max-w-xl mx-auto">
              {isAr 
                ? 'حلول تقنية ذكية مصممة خصيصاً لمشاكل الطلاب الجامعيين: حساب الدرجات، تجنب الإنذارات، وتنظيم الوقت.'
                : 'Intelligent, student-first software to manage grades, avoid academic warnings, and organize your life.'}
            </p>
          </div>

          {/* 6 Feature Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-7">
            
            {/* Pillar 1 */}
            <div className="bg-zinc-50 dark:bg-zinc-900 p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700/60 transition-all space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Calculator size={22} className="sm:w-6 sm:h-6" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                {isAr ? 'حاسبة ومحاكي المعدل التراكمي (GPA)' : 'GPA Calculator & Simulator'}
              </h4>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
                {isAr 
                  ? 'حساب فوري للمعدل التراكمي والفصلي، مع إمكانية تجربة سيناريوهات الدرجات المتوقعة لمعرفة المعدل النهائي قبل صدور النتيجة.'
                  : 'Instant computation of semester and cumulative GPA with what-if scenario simulations for upcoming exams.'}
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-zinc-50 dark:bg-zinc-900 p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700/60 transition-all space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Target size={22} className="sm:w-6 sm:h-6" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                {isAr ? 'خطة استعادة وتحسين المعدل (Recovery Plan)' : 'GPA Recovery & Target Plan'}
              </h4>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
                {isAr 
                  ? 'خوارزمية ذكية تقترح الدرجات والساعات المطلوبة في الفصول القادمة لتجاوز التعثر الأكاديمي والوصول للتقدير المستهدف.'
                  : 'Smart algorithms that calculate the precise grades and credit hours required to reach your target honors tier.'}
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-zinc-50 dark:bg-zinc-900 p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700/60 transition-all space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertTriangle size={22} className="sm:w-6 sm:h-6" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                {isAr ? 'رادار الإنذارات والتحسينات المبكرة' : 'Early Warning Radar'}
              </h4>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
                {isAr 
                  ? 'رصد استباقي للمواد المعرضة لخطر الرسوب أو الإنذار مع شارات تنبيه ذكية ترشدك للتركيز على المواد ذات التأثير الأكبر.'
                  : 'Proactive detection of courses at risk of warning thresholds, highlighting subjects that need urgent attention.'}
              </p>
            </div>

            {/* Pillar 4 */}
            <div id="productivity" className="bg-zinc-50 dark:bg-zinc-900 p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700/60 transition-all space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <BookOpen size={22} className="sm:w-6 sm:h-6" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                {isAr ? 'سجل المواد وتوزيع الدرجات' : 'Course & Mark Distribution'}
              </h4>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
                {isAr 
                  ? 'تسجيل دقيق لتفاصيل كل مادة: الميدتيرم، الفاينل، أعمال السنة، والعملي مع حساب النقاط والنسبة المئوية فوراً.'
                  : 'Track midterm, final, labs, and coursework breakdowns with automated letter grade calculation.'}
              </p>
            </div>

            {/* Pillar 5 */}
            <div className="bg-zinc-50 dark:bg-zinc-900 p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700/60 transition-all space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <CheckSquare size={22} className="sm:w-6 sm:h-6" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                {isAr ? 'إدارة المهام وتكليفات المواد' : 'Task & Assignment Kanban'}
              </h4>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
                {isAr 
                  ? 'تنظيم الواجبات والمشاريع مع مستويات الأولوية وتواريخ التسليم وربط المهام بالملاحظات والمرفقات السحابية.'
                  : 'Kanban boards and lists with priority levels, deadline countdowns, and attachment linking.'}
              </p>
            </div>

            {/* Pillar 6 */}
            <div className="bg-zinc-50 dark:bg-zinc-900 p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700/60 transition-all space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <HardDrive size={22} className="sm:w-6 sm:h-6" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                {isAr ? 'المستودع السحابي والجدول الأسبوعي' : 'Cloud Drive & Schedule'}
              </h4>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
                {isAr 
                  ? 'مساحة سحابية آمنة للملازم والمحاضرات بصيغ PDF مع جدول أسبوعي تفاعلي للمحاضرات والسكاشن.'
                  : 'Secure cloud storage for lecture PDFs and study materials paired with an interactive weekly timetable.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- LIVE INTERACTIVE SIMULATOR SECTION --- */}
      <section id="simulator" className="py-12 sm:py-20 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-2.5 sm:space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-black">
              <Flame size={14} className="text-amber-500" />
              <span>{isAr ? 'جرّب بنفسك الآن مباشرة' : 'Interactive Live Demo'}</span>
            </div>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-900 dark:text-white leading-tight">
              {isAr ? 'حاسبة المعدل التفاعلية المباشرة' : 'Interactive GPA Playground'}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {isAr 
                ? 'غيّر التقديرات والساعات في الجدول أدناه وشاهد كيف يتغير المعدل التراكمي فوراً:'
                : 'Change course grades and credit hours below to see instant GPA updates:'}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden p-3.5 sm:p-6 lg:p-8">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 items-stretch lg:items-center">
              
              {/* Left/Right Table */}
              <div className="lg:col-span-2 space-y-2.5 sm:space-y-3">
                <div className="space-y-2 sm:space-y-2.5">
                  {demoSubjects.map((sub) => (
                    <div 
                      key={sub.id}
                      className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3"
                    >
                      {/* Course Title & info */}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                          {sub.name}
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5">
                          {isAr ? `${sub.credits} ساعات معتمدة` : `${sub.credits} Credits`}
                        </p>
                      </div>

                      {/* Controls: Credits & Grade */}
                      <div className="flex items-center gap-2 sm:gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-200/60 dark:border-zinc-700/40 w-full sm:w-auto">
                        {/* Credits select */}
                        <div className="flex-1 sm:flex-initial flex items-center justify-between sm:justify-start gap-1.5 bg-white dark:bg-zinc-800/90 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                          <span className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-bold shrink-0">
                            {isAr ? 'الساعات:' : 'Credits:'}
                          </span>
                          <select
                            value={sub.credits}
                            onChange={(e) => updateDemoCredits(sub.id, Number(e.target.value))}
                            className="bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5, 6].map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        {/* Grade select */}
                        <div className="flex-1 sm:flex-initial flex items-center justify-between sm:justify-start gap-1.5 bg-white dark:bg-zinc-800/90 px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800/80">
                          <span className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-bold shrink-0">
                            {isAr ? 'التقدير:' : 'Grade:'}
                          </span>
                          <select
                            value={sub.grade}
                            onChange={(e) => updateDemoGrade(sub.id, e.target.value)}
                            className="bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-lg text-xs font-black text-blue-700 dark:text-blue-300 focus:outline-hidden cursor-pointer"
                          >
                            {gradeOptions.map(g => (
                              <option key={g.letter} value={g.letter}>{g.letter} ({g.points})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Result Dial Widget */}
              <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 text-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-center space-y-3 sm:space-y-4 shadow-xl shadow-blue-600/30 flex flex-col justify-center items-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-black">
                  <Award size={24} className="sm:w-7 sm:h-7" />
                </div>
                
                <div>
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-blue-200">{isAr ? 'المعدل المحسوب' : 'Calculated GPA'}</span>
                  <div className="text-4xl sm:text-6xl font-black mt-0.5 sm:mt-1">{demoGpa}</div>
                  <p className="text-xs font-bold text-blue-100 mt-1 sm:mt-2">
                    {Number(demoGpa) >= 3.5 ? (isAr ? 'امتياز مع مرتبة الشرف' : 'Distinction Honors') : (Number(demoGpa) >= 3.0 ? (isAr ? 'جيد جداً' : 'Very Good') : (isAr ? 'جيد' : 'Good'))}
                  </p>
                </div>

                <div className="pt-2 w-full">
                  <Link
                    to="/auth?mode=signup"
                    className="w-full py-3 px-4 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
                  >
                    <span>{isAr ? 'احفظ معدلك وسجل الآن' : 'Save Your GPA Now'}</span>
                    <ArrowIcon size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section id="faq" className="py-12 sm:py-20 bg-white dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
          
          <div className="text-center space-y-2.5 sm:space-y-3">
            <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white leading-tight">
              {isAr ? 'الأسئلة الشائعة حول المنصة' : 'Frequently Asked Questions'}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {isAr ? 'إجابات على أكثر الاستفسارات تكراراً من الطلاب' : 'Everything you need to know about UniStudent OS'}
            </p>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = faqOpen === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setFaqOpen(isOpen ? null : idx)}
                    className="w-full p-3.5 sm:p-5 flex items-start justify-between text-start font-bold text-xs sm:text-base text-zinc-900 dark:text-white gap-3 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <span className="flex items-start gap-2 sm:gap-2.5 pt-0.5">
                      <HelpCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 sm:w-[18px] sm:h-[18px]" />
                      <span className="leading-snug">{faq.q}</span>
                    </span>
                    <ChevronDown size={18} className={`text-zinc-400 shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/60 font-medium">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- FINAL CALL TO ACTION BANNER --- */}
      <section className="py-10 sm:py-20 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-900 via-blue-900 to-blue-950 text-white p-6 sm:p-14 text-center space-y-5 sm:space-y-6 shadow-2xl relative overflow-hidden border border-blue-800/50">
            
            <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-3 sm:space-y-4 max-w-2xl mx-auto">
              <h3 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight leading-snug">
                {isAr ? 'جاهز لتجربة أحدث وأقوى نظام جامعي مجاني؟' : 'Ready to Transform Your University Life?'}
              </h3>
              <p className="text-xs sm:text-sm text-blue-200 font-medium leading-relaxed">
                {isAr 
                  ? 'انضم الآن مجاناً وابدأ تنظيم موادك، حساب معدلك، وتتبع واجباتك في أقل من دقيقة واحدة.'
                  : 'Join thousands of university students mastering their degrees with UniStudent OS.'}
              </p>
            </div>

            <div className="relative z-10 pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm sm:max-w-none mx-auto">
              <Link
                to="/auth?mode=signup"
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white text-blue-900 hover:bg-blue-50 font-black text-xs sm:text-sm transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>{isAr ? 'إنشاء حساب جديد مجاناً' : 'Create Free Account'}</span>
                <ArrowIcon size={16} />
              </Link>

              <Link
                to="/auth"
                className="w-full sm:w-auto px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-blue-800/60 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm border border-blue-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <LogIn size={16} />
                <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-8 sm:py-10 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-start">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">U</div>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">UniStudent OS</span>
            <span>• {isAr ? 'المنصة الأكاديمية المجانية 100%' : '100% Free Academic OS'}</span>
          </div>

          <div>
            © {new Date().getFullYear()} UniStudent OS. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </div>
        </div>
      </footer>
    </div>
  );
}
