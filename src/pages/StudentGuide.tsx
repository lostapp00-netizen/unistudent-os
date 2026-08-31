import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BookOpen, 
  Calculator, 
  GraduationCap, 
  Sparkles, 
  ShieldAlert, 
  Target, 
  Layers, 
  Calendar, 
  HardDrive, 
  HelpCircle, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Award,
  Lightbulb,
  Lock,
  Edit3,
  TrendingUp,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function StudentGuide() {
  const { i18n } = useTranslation();
  const { settings } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [activeTab, setActiveTab] = useState<'gpa' | 'status' | 'features' | 'recovery' | 'faq'>('gpa');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = isAr ? [
    {
      q: 'ما هو الفرق بين المعدل الفصلي (GPA) والمعدل التراكمي (cGPA)؟',
      a: 'المعدل الفصلي (GPA) هو متوسط درجاتك في فصل دراسي واحد فقط، بينما المعدل التراكمي الكلي (cGPA) هو المتوسط التراكمي لجميع المواد والساعات المكتسبة منذ التحاقك بالجامعة حتى الآن.'
    },
    {
      q: 'ماذا يعني وضع التقييم كـ "حالي" مقابل "نهائي"؟',
      a: 'التقييم "الحالي" يعني أن الدرجة لا تزال تقديرية أو قيد التجميع (مثل أعمال السنة أو درجات الميدتيرم)، ويتيح لك النظام تعديلها وتوقع معدلك اللحظي. أما "النهائي" فهو عند صدور الدرجة الرسمية وقفل المادة لتثبيتها في سجلك الأكاديمي.'
    },
    {
      q: 'كيف تعمل ميزة خطة التعافي الأكاديمي؟',
      a: 'تتيح لك تحديد معدل تراكمي مستهدف (مثل 3.50)، ويقوم الذكاء الحسابي للنظام بتحليل عدد ساعاتك وموادك المتبقية ليخبرك بالضبط بالتقديرات والدرجات التي يجب عليك تحقيقها في كل مادة للوصول إلى هدفك.'
    },
    {
      q: 'هل يمكنني إدخال معدلي التراكمي السابق إذا انضممت للمنصة في سنة متقدمة؟',
      a: 'نعم بكل تأكيد! إذا لم تكن مسجلاً مواد السنة الأولى الفصل الأول في المنصة، يتيح لك النظام من الإعدادات إدخال معدلك وساعاتك السابقة مباشرة وسيقوم بالبناء عليها تلقائياً.'
    },
    {
      q: 'كيف أقوم بنقل الملفات في الدرايف السحابي؟',
      a: 'من خلال علامة النقل (Move) بجانب أي ملف أو مجلد، يمكنك نقله إلى المجلد الرئيسي أو إلى أي مجلد فرعي متداخل بسهولة تامة.'
    }
  ] : [
    {
      q: 'What is the difference between Semester GPA and Cumulative cGPA?',
      a: 'Semester GPA is your average grade points for one specific term, while Cumulative cGPA represents your overall academic standing across all completed terms and credit hours.'
    },
    {
      q: 'What does "Current" vs "Final" status mean for grades?',
      a: '"Current" indicates provisional, in-progress coursework that you can tweak for live projections. "Final" represents official locked grades recorded in your transcript.'
    },
    {
      q: 'How does Academic Recovery work?',
      a: 'Set your target GPA, and the smart recovery engine calculates the exact grade combinations you need in your remaining courses to hit your goal.'
    },
    {
      q: 'Can I set my prior GPA if I joined in a higher semester?',
      a: 'Yes! If you do not have Year 1 Term 1 courses registered, you can set your previous cumulative GPA and credit hours in Settings, and the platform builds upon it seamlessly.'
    },
    {
      q: 'How do I organize and transfer files in Cloud Drive?',
      a: 'Use the Move icon next to any file or folder to move it to the root drive or any nested folder effortlessly.'
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-950 text-white p-8 sm:p-10 shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold text-indigo-200">
            <Sparkles size={14} className="text-amber-300" />
            <span>{isAr ? 'الدليل الشامل للتميز الأكاديمي' : 'Comprehensive Academic Guide'}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight">
            {isAr ? 'دليل الطالب ونظام الـ GPA ومميزات المنصة' : 'Student Guide & GPA Mastery'}
          </h1>

          <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed font-medium">
            {isAr 
              ? 'كل ما تحتاج لمعرفته حول طريقة حساب المعدل التراكمي (GPA & cGPA)، الفروق بين الدرجات الحالية والنهائية، وكيفية الاستفادة القصوى من جميع أدوات المنصة للوصول لأعلى المراتب.'
              : 'Everything you need to master your GPA calculations, understand grade states, and leverage all platform features for academic excellence.'}
          </p>
        </div>

        {/* Decorative Background Elements */}
        <GraduationCap className="absolute -bottom-6 -right-6 w-60 h-60 text-white/5 pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('gpa')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'gpa'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50'
          }`}
        >
          <Calculator size={16} />
          <span>{isAr ? 'حساب الـ GPA و cGPA' : 'GPA & cGPA Calculations'}</span>
        </button>

        <button
          onClick={() => setActiveTab('status')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'status'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50'
          }`}
        >
          <Lock size={16} />
          <span>{isAr ? 'الدرجات (حالي vs نهائي)' : 'Current vs Final Grades'}</span>
        </button>

        <button
          onClick={() => setActiveTab('recovery')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'recovery'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50'
          }`}
        >
          <ShieldAlert size={16} />
          <span>{isAr ? 'الإنذارات وخطة التعافي' : 'Warnings & Recovery'}</span>
        </button>

        <button
          onClick={() => setActiveTab('features')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'features'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50'
          }`}
        >
          <Layers size={16} />
          <span>{isAr ? 'دليل مميزات المنصة' : 'Platform Features'}</span>
        </button>

        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'faq'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50'
          }`}
        >
          <HelpCircle size={16} />
          <span>{isAr ? 'الأسئلة الشائعة' : 'FAQ'}</span>
        </button>
      </div>

      {/* Tab 1: GPA & cGPA */}
      {activeTab === 'gpa' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: What is GPA */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Calculator size={22} />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {isAr ? '1. ما هو المعدل الفصلي (GPA)؟' : '1. What is Semester GPA?'}
                </h3>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {isAr 
                  ? 'هو مقياس رقمي (عادة من 4.0 أو 5.0) يعبر عن متوسط تحصيلك الأكاديمي في فصل دراسي واحد محدد. يتم حسابه بضرب نقاط كل مادة في عدد ساعاتها المعتمدة، ثم قسمة المجموع على إجمالي الساعات المسجلة في ذلك الفصل.'
                  : 'A numerical scale representing your academic performance in one specific term. Calculated by multiplying each course grade points by its credit hours, then dividing by total registered credits.'}
              </p>
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold text-center">
                GPA = ∑ (نقاط المادة × ساعاتها) ÷ ∑ الساعات المعتمدة للفصل
              </div>
            </div>

            {/* Card 2: What is cGPA */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                  <GraduationCap size={22} />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {isAr ? '2. ما هو المعدل التراكمي (cGPA)؟' : '2. What is Cumulative cGPA?'}
                </h3>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {isAr 
                  ? 'هو المعدل التراكمي الشامل لجميع الفصول الدراسية التي درستها منذ بداية رحلتك الجامعية. لا يتأثر بعدد الفصول بل بمجموع نقاط الجودة الكلية مقسومة على إجمالي الساعات المكتسبة التراكمية.'
                  : 'The cumulative average covering all completed semesters throughout your university journey, dividing total earned quality points by total cumulative credit hours.'}
              </p>
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 font-mono text-xs text-purple-600 dark:text-purple-400 font-bold text-center">
                cGPA = إجمالي نقاط الجودة لكل الفصول ÷ إجمالي الساعات التراكمية
              </div>
            </div>
          </div>

          {/* Practical Calculation Example */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <Lightbulb className="text-amber-500 w-5 h-5" />
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                {isAr ? 'مثال عملي توضيحي لحساب نقاط المادة' : 'Practical Calculation Example'}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 text-center space-y-1">
                <p className="text-xs text-zinc-400">{isAr ? 'المادة وساعاتها' : 'Course & Credits'}</p>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{isAr ? 'رياضيات (3 ساعات)' : 'Math (3 Credits)'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 text-center space-y-1">
                <p className="text-xs text-zinc-400">{isAr ? 'التقدير والنقاط' : 'Grade & Points'}</p>
                <p className="text-sm font-bold text-emerald-600">{isAr ? 'A (4.00 نقاط)' : 'A (4.00 Points)'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 text-center space-y-1">
                <p className="text-xs text-zinc-400">{isAr ? 'نقاط الجودة المحققة' : 'Earned Quality Points'}</p>
                <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">3 × 4.00 = 12.0 نقطة</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Current vs Final */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Status Box */}
            <div className="p-6 rounded-3xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                  <Edit3 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-950 dark:text-amber-200">
                    {isAr ? 'حالة التقييم: حالي (Current)' : 'Grade Status: Current'}
                  </h3>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">{isAr ? 'مستمر وقابل للتعديل اللحظي' : 'In-Progress & Editable'}</span>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>{isAr ? 'يستخدم أثناء الفصل الدراسي لتدوين درجات الكويزات، الميدتيرم، والمشاريع أولاً بأول.' : 'Used during the term for ongoing quizzes, midterms, and assignments.'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>{isAr ? 'يمنحك توقعاً حياً ولحظياً للمعدل التراكمي والفصلي قبل دخول الاختبارات النهائية.' : 'Gives live real-time GPA predictions before final examinations.'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>{isAr ? 'يمكن تعديل الدرجات أو مسحها أو حفظها بدون درجات لإعداد توزيع الدرجات مسبقاً.' : 'You can edit, clear, or save empty grade distributions to plan ahead.'}</span>
                </li>
              </ul>
            </div>

            {/* Final Status Box */}
            <div className="p-6 rounded-3xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                  <Lock size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-950 dark:text-emerald-200">
                    {isAr ? 'حالة التقييم: نهائي (Final / Finished)' : 'Grade Status: Final'}
                  </h3>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{isAr ? 'رسمي ومعتمد ومغلق' : 'Official & Locked Transcript'}</span>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{isAr ? 'يتم قفل التقييم أو المادة بالكامل بعد انتهاء الفصل واعتماد نتيجتك الرسمية.' : 'Locked after the term ends and official university transcripts are issued.'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{isAr ? 'تستبعد المادة المنتهية نهائياً من قائمة الإنذارات ومقترحات التحسين لأنها غير قابلة للتعديل.' : 'Excluded from warning lists & active recovery as its grade is fixed.'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{isAr ? 'تدخل مباشرة في بناء المعدل التراكمي المكتسب وتثبت في سجلك التاريخي.' : 'Integrates directly into your cemented historical transcript.'}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Recovery & Warnings */}
      {activeTab === 'recovery' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {isAr ? 'نظام الإنذارات وخوارزمية التعافي الأكاديمي' : 'Academic Warnings & Smart Recovery'}
                </h3>
                <p className="text-xs text-zinc-400">{isAr ? 'حماية مسارك الأكاديمي من التعثر قبل فوات الأوان' : 'Safeguard your academic trajectory proactive'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/60">
                <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                  <Target size={16} className="text-rose-500" />
                  {isAr ? 'تخصيص حد الإنذار الشخصي' : 'Custom Warning Threshold'}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {isAr
                    ? 'يمكنك من صفحة الإنذارات تحديد التقدير أو المعدل الذي تعتبره خطراً على طموحك (مثلاً C أو 2.50 أو 3.00)، ويقوم النظام بمراقبة موادك وتنبيهك بمجرد انخفاض أي مادة حالية عن هذا الحد.'
                    : 'Customize your danger threshold (e.g. C or 2.50 or 3.00), and the app flags in-progress courses dropping below it.'}
                </p>
              </div>

              <div className="space-y-3 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/60">
                <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-500" />
                  {isAr ? 'محرك التعافي وحساب السيناريوهات' : 'Smart Recovery Engine'}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {isAr
                    ? 'اكتب المعدل الذي تطمح إليه (مثل 3.65)، وستقوم الخوارزمية بحساب جميع الاحتمالات المتاحة ومصفوفة التقديرات المطلوبة في كل مادة متبقية لتحقيق هدفك بسهولة.'
                    : 'Enter your dream target GPA, and the solver determines the exact minimum grade combinations required across remaining courses.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Platform Features */}
      {activeTab === 'features' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: <Calculator className="text-indigo-600" size={20} />,
              title: isAr ? 'الداشبورد الأكاديمي والـ GPA' : 'Academic Dashboard',
              desc: isAr ? 'نظرة شاملة على المعدل التراكمي والفصلي وتقدير التخرج التراكمي ونقاط القوة والضعف.' : 'Overview of cumulative GPA, semester GPA, graduation estimate, and strengths.'
            },
            {
              icon: <BookOpen className="text-purple-600" size={20} />,
              title: isAr ? 'المواد وتوزيع الدرجات' : 'Subjects & Grade Breakdown',
              desc: isAr ? 'إدارة المواد، تحديد الساعات، تقسيم درجات أعمال السنة، والميدتيرم، والفاينال بمرونة تامة.' : 'Manage courses, credit hours, custom grade distributions, and weightings.'
            },
            {
              icon: <Award className="text-amber-500" size={20} />,
              title: isAr ? 'سلم تقدير التخرج المتوقع' : 'Graduation Grading Scale',
              desc: isAr ? 'جدول تقديرات خاص بالتخرج يتم تفعيله اختيارياً لإظهار التقدير النهائي المتوقع (امتياز، جيد جداً، ..).' : 'Optional honors scale configured in settings showing final graduation estimates.'
            },
            {
              icon: <CheckCircle2 className="text-emerald-600" size={20} />,
              title: isAr ? 'إدارة المهام والمجموعات' : 'Tasks & Productivity Groups',
              desc: isAr ? 'تنظيم المهام، الأولويات، مواعيد التسليم، وتقسيمها إلى مجموعات مخصصة مع شريط تنقل سلس.' : 'Prioritized task management with custom categories and clean group filtering.'
            },
            {
              icon: <Calendar className="text-blue-600" size={20} />,
              title: isAr ? 'جدولي والكالندر العمومي' : 'Schedule & Productivity Calendar',
              desc: isAr ? 'تقويم عملاق يعرض محاضراتك، دكاترتك، قاعاتك، مهامك وملاحظاتك مع إمكانية التمرير الكامل.' : 'Generous enlarged calendar displaying lectures, instructors, rooms, tasks, and notes.'
            },
            {
              icon: <HardDrive className="text-teal-600" size={20} />,
              title: isAr ? 'الدرايف السحابي والملفات' : 'Cloud Drive & File Hub',
              desc: isAr ? 'تخزين سحابي آمن، إنشاء مجلدات متداخلة، نقل الملفات بحرية بين أي مستويات، ومعاينة وتنزيل مباشر.' : 'Secure cloud drive with nested folders, seamless multi-level file transfers, and instant previews.'
            }
          ].map((feat, idx) => (
            <div key={idx} className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 hover:shadow-md transition-shadow">
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 w-fit">
                {feat.icon}
              </div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">{feat.title}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab 5: FAQ */}
      {activeTab === 'faq' && (
        <div className="space-y-4 max-w-3xl mx-auto">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 flex items-center justify-between text-left rtl:text-right gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <span className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                  <HelpCircle size={16} className="text-indigo-600 shrink-0" />
                  {faq.q}
                </span>
                {openFaq === idx ? <ChevronUp size={18} className="text-zinc-400 shrink-0" /> : <ChevronDown size={18} className="text-zinc-400 shrink-0" />}
              </button>

              {openFaq === idx && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/20">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
