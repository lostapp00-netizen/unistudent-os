import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { GraduationCap, LogIn, UserPlus, AlertCircle, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Auth() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [signUpSuccessEmail, setSignUpSuccessEmail] = useState<string | null>(null);

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
      window.location.replace('/admin');
      return;
    }

    try {
      sessionStorage.removeItem('unistudent_admin_auth');
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: emailTrimmed, password: passwordTrimmed });
        if (error) throw error;
        window.location.replace('/');
      } else {
        const { error } = await supabase.auth.signUp({ email: emailTrimmed, password: passwordTrimmed });
        if (error) throw error;
        // Show activation confirmation message and let the user click login button themselves
        setSignUpSuccessEmail(emailTrimmed);
      }
    } catch (err: any) {
      const rawMsg = err.message || '';
      if (rawMsg.includes('rate limit') || rawMsg.includes('rate_limit')) {
        setError('تم تجاوز الحد المسموح لإرسال رسائل البريد الإلكتروني مؤقتاً (Rate limit). يرجى الانتظار دقيقة أو تعطيل Confirm email من إعدادات Supabase.');
      } else if (rawMsg.includes('Invalid login credentials')) {
        setError('بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور.');
      } else if (rawMsg.includes('User already registered')) {
        setError('هذا البريد الإلكتروني مسجل بالفعل. يرجى التبديل لتسجيل الدخول.');
      } else if (rawMsg.includes('at least 6 characters')) {
        setError('يجب أن تتكون كلمة المرور من 6 أحرف/أرقام على الأقل.');
      } else {
        setError(rawMsg || 'حدث خطأ أثناء المصادقة. يرجى المحاولة لاحقاً.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-zinc-900 dark:text-zinc-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-indigo-600 dark:text-indigo-400">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-2xl">
            <GraduationCap size={48} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold">
          {signUpSuccessEmail ? 'تأكيد الحساب' : (isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد')}
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {signUpSuccessEmail ? 'تم إنشاء الحساب بنجاح' : (isLogin ? 'مرحباً بعودتك إلى UniStudent OS' : 'انضم إلينا لإدارة حياتك الأكاديمية')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow sm:rounded-3xl sm:px-10 border border-zinc-200 dark:border-zinc-800">
          
          {signUpSuccessEmail ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Mail size={32} />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  تم إنشاء حسابك بنجاح!
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  تم إرسال رابط التفعيل وتأكيد الحساب إلى بريدك الإلكتروني:
                  <br />
                  <strong className="text-indigo-600 dark:text-indigo-400 text-sm font-black">{signUpSuccessEmail}</strong>
                </p>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl text-xs text-zinc-500 text-right leading-relaxed border border-zinc-200 dark:border-zinc-700/60">
                  📌 <strong>تنبيه هام:</strong> يرجى فتح بريدك الإلكتروني (ومراجعة صندوق الوارد وصندوق الرسائل غير المرغوبة / Spam) والضغط على رابط التفعيل، ثم العودة لتسجيل الدخول.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSignUpSuccessEmail(null);
                  setIsLogin(true);
                  setPassword('');
                }}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <LogIn size={18} />
                <span>الذهاب إلى صفحة تسجيل الدخول</span>
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl flex items-start gap-3 border border-red-200 dark:border-red-900/50">
                  <AlertCircle className="text-red-600 dark:text-red-400 w-5 h-5 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium mb-2">البريد الإلكتروني</label>
                  <div className="mt-1">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">كلمة المرور</label>
                  <div className="mt-1">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'جاري التحميل...' : (
                      <div className="flex items-center gap-2">
                        {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                        <span>{isLogin ? 'دخول' : 'تسجيل'}</span>
                      </div>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-300 dark:border-zinc-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-zinc-900 text-zinc-500">
                      أو
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
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    {isLogin ? 'ليس لديك حساب؟ قم بإنشاء حساب جديد' : 'لديك حساب بالفعل؟ سجل دخولك'}
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
