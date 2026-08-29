import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { GraduationCap, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Auth() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      window.location.href = '/admin';
      return;
    }

    try {
      sessionStorage.removeItem('unistudent_admin_auth');
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: emailTrimmed, password: passwordTrimmed });
        if (error) throw error;
        window.location.href = '/';
      } else {
        const { error } = await supabase.auth.signUp({ email: emailTrimmed, password: passwordTrimmed });
        if (error) throw error;
        window.location.href = '/';
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
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
          {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {isLogin ? 'مرحباً بعودتك إلى UniStudent OS' : 'انضم إلينا لإدارة حياتك الأكاديمية'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow sm:rounded-3xl sm:px-10 border border-zinc-200 dark:border-zinc-800">
          
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
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                {isLogin ? 'ليس لديك حساب؟ قم بإنشاء حساب جديد' : 'لديك حساب بالفعل؟ سجل دخولك'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
