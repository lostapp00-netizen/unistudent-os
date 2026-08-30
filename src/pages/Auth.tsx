import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GraduationCap, LogIn, UserPlus, AlertCircle, Mail, ArrowRight, ArrowLeft, Sun, Moon, Sparkles, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

export function Auth() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings, updateTheme, updateLanguage } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUpSuccessEmail, setSignUpSuccessEmail] = useState<string | null>(null);

  useEffect(() => {
    // Check URL params for mode=signup or mode=login
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'signup') {
      setIsLogin(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const emailTrimmed = email.trim().toLowerCase();
    const passwordTrimmed = password.trim();

    // Check direct Admin credentials bypass
    const isAdmin = 
      (emailTrimmed === 'admin@gmail.com' || emailTrimmed === 'admin@gmail.ocm' || emailTrimmed === 'admin@unistudent.com') && 
      (passwordTrimmed === 'Body22@33' || passwordTrimmed === 'admin2026' || passwordTrimmed === 'unistudent');

    if (isAdmin) {
      sessionStorage.setItem('unistudent_admin_auth', 'true');
      navigate('/admin', { replace: true });
      return;
    }

    try {
      sessionStorage.removeItem('unistudent_admin_auth');
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: emailTrimmed, password: passwordTrimmed });
        if (error) throw error;
        if (data?.user?.id) {
          try {
            localStorage.setItem(`unistudent_user_email_${data.user.id}`, emailTrimmed);
          } catch {}
        }
        navigate('/', { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({ email: emailTrimmed, password: passwordTrimmed });
        if (error) throw error;
        setSignUpSuccessEmail(emailTrimmed);
      }
    } catch (err: any) {
      const rawMsg = err.message || '';
      if (rawMsg.includes('rate limit') || rawMsg.includes('rate_limit')) {
        setError(isAr ? 'تم تجاوز الحد المسموح لإرسال رسائل البريد الإلكتروني مؤقتاً (Rate limit). يرجى الانتظار دقيقة أو تعطيل Confirm email من إعدادات Supabase.' : 'Rate limit exceeded. Please wait a minute before trying again.');
      } else if (rawMsg.includes('Invalid login credentials')) {
        setError(isAr ? 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور.' : 'Invalid login credentials. Please verify your email and password.');
      } else if (rawMsg.includes('User already registered')) {
        setError(isAr ? 'هذا البريد الإلكتروني مسجل بالفعل. يرجى التبديل لتسجيل الدخول.' : 'This email is already registered. Please sign in instead.');
      } else if (rawMsg.includes('at least 6 characters')) {
        setError(isAr ? 'يجب أن تتكون كلمة المرور من 6 أحرف/أرقام على الأقل.' : 'Password must be at least 6 characters.');
      } else {
        setError(rawMsg || (isAr ? 'حدث خطأ أثناء المصادقة. يرجى المحاولة لاحقاً.' : 'Authentication error. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-zinc-900 dark:text-zinc-100 relative transition-colors" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* Top Bar with Home Link and Toggles */}
      <div className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 flex items-center justify-between z-20">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all shadow-xs"
        >
          <BackIcon size={16} />
          <span>{isAr ? 'العودة للرئيسية' : 'Back to Home'}</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => updateTheme(settings.theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 transition-all shadow-xs"
            title={settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            onClick={() => updateLanguage(isAr ? 'en' : 'ar')}
            className="px-3 py-2 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-xs font-black text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 transition-all shadow-xs uppercase tracking-wider"
          >
            {isAr ? 'EN' : 'عربي'}
          </button>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-indigo-600 dark:text-indigo-400">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <GraduationCap size={36} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
          {signUpSuccessEmail 
            ? (isAr ? 'تأكيد الحساب' : 'Account Confirmation') 
            : (isLogin ? (isAr ? 'تسجيل الدخول' : 'Welcome Back') : (isAr ? 'إنشاء حساب جديد مجاناً' : 'Create Free Account'))}
        </h2>
        <p className="mt-2 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
          {signUpSuccessEmail 
            ? (isAr ? 'خطوة واحدة تفصلك عن تفعيل حسابك' : 'One step away from activating your account') 
            : (isLogin ? (isAr ? 'مرحباً بعودتك إلى UniStudent OS' : 'Sign in to access your academic workspace') : (isAr ? 'انضم إلى المنصة الأكاديمية والإنتاجية المتكاملة 100% مجاناً' : 'Join the all-in-one university OS — 100% free forever'))}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-zinc-900 py-8 px-6 sm:px-10 shadow-xl sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-md">
          
          {signUpSuccessEmail ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
                <Mail size={32} />
              </div>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                  <CheckCircle2 size={14} />
                  <span>{isAr ? 'تم إنشاء الحساب بنجاح!' : 'Account Created Successfully!'}</span>
                </div>

                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                  {isAr ? 'تم إرسال رابط التفعيل وتأكيد الحساب إلى بريدك الإلكتروني:' : 'A verification link has been sent to your email:'}
                  <br />
                  <strong className="text-indigo-600 dark:text-indigo-400 text-sm font-black mt-1 inline-block">{signUpSuccessEmail}</strong>
                </p>

                {/* EXACT USER SPECIFIED NOTIFICATION MESSAGE */}
                <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl text-xs text-amber-900 dark:text-amber-200 text-right leading-relaxed border border-amber-200/80 dark:border-amber-900/50 shadow-2xs space-y-1.5 font-medium">
                  <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 text-xs">
                    <AlertCircle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{isAr ? 'تنبيه هام للتحقق والتفعيل:' : 'Important Verification Notice:'}</span>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-200 font-semibold leading-relaxed">
                    {isAr 
                      ? 'تم إنشاء الحساب بنجاح! برجاء مراجعة البريد الإلكتروني لتفعيل الحساب. إن لم تجد الرسالة في الرسائل الواردة، ستجدها في الرسائل المزعجة (Spam / غير المرغوب فيها).'
                      : 'Account created! Please check your email inbox to activate your account. If you do not find the email in your inbox, please check your Spam / Junk folder.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSignUpSuccessEmail(null);
                  setIsLogin(true);
                  setPassword('');
                }}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <LogIn size={18} />
                <span>{isAr ? 'الذهاب إلى تسجيل الدخول' : 'Go to Login Page'}</span>
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 bg-rose-50 dark:bg-rose-950/30 p-4 rounded-2xl flex items-start gap-3 border border-rose-200 dark:border-rose-900/50">
                  <AlertCircle className="text-rose-600 dark:text-rose-400 w-5 h-5 mt-0.5 shrink-0" />
                  <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-300 font-semibold">{error}</p>
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="student@university.edu"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'كلمة المرور' : 'Password'}
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-2xl shadow-md shadow-indigo-600/20 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <span className="animate-pulse">{isAr ? 'جاري التحقق...' : 'Processing...'}</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                        <span>{isLogin ? (isAr ? 'تسجيل الدخول' : 'Sign In') : (isAr ? 'إنشاء حساب جديد مجاناً' : 'Create Free Account')}</span>
                      </div>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-white dark:bg-zinc-900 text-zinc-400 font-bold">
                      {isAr ? 'أو' : 'OR'}
                    </span>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError(null);
                    }}
                    className="text-xs sm:text-sm font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 transition-colors"
                  >
                    {isLogin 
                      ? (isAr ? 'ليس لديك حساب؟ قم بإنشاء حساب جديد مجاناً' : "Don't have an account? Sign up for free") 
                      : (isAr ? 'لديك حساب بالفعل؟ سجل دخولك الآن' : 'Already have an account? Sign in')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

