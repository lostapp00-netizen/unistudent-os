"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/useLanguage";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();
  const { lang, toggleLang } = useLang();

  // Simple inline translations for Auth Page
  const t = {
    title: isSignUp 
      ? (lang === 'ar' ? 'إنشاء حساب جديد' : 'Create New Account') 
      : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'),
    subtitle: lang === 'ar' ? 'نظام إدارة الطلاب المتكامل' : 'The Ultimate Student OS',
    email: lang === 'ar' ? 'البريد الإلكتروني' : 'Email',
    password: lang === 'ar' ? 'كلمة المرور' : 'Password',
    submit: isSignUp 
      ? (lang === 'ar' ? 'إنشاء حساب' : 'Sign Up') 
      : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'),
    loading: lang === 'ar' ? 'جاري المعالجة...' : 'Processing...',
    toggle: isSignUp 
      ? (lang === 'ar' ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'Already have an account? Sign In') 
      : (lang === 'ar' ? 'ليس لديك حساب؟ إنشاء حساب جديد' : "Don't have an account? Sign Up"),
    success: lang === 'ar' ? 'تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.' : 'Account created! You can now sign in.',
    langToggle: lang === 'ar' ? 'English' : 'العربية',
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(t.success);
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-[#050505] fixed inset-0 z-50">
      
      <div className="absolute top-6 right-6 flex items-center gap-4">
        <ThemeToggle />
        <button onClick={toggleLang} className="text-sm font-bold text-gray-500 hover:text-black dark:hover:text-white transition-colors bg-gray-100 dark:bg-gray-900 px-3 py-1.5 rounded-full">
          {t.langToggle}
        </button>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500 px-4">
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-6 rounded-3xl bg-black dark:bg-white shadow-xl flex items-center justify-center text-white dark:text-black font-extrabold text-3xl">
            U
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-black dark:text-white mb-2">{t.title}</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">{t.subtitle}</p>
        </div>

        <Card className="p-8 space-y-6 bg-white dark:bg-[#0a0a0a] border-gray-100 dark:border-gray-800 shadow-2xl rounded-3xl">
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t.email}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-gray-50 dark:bg-gray-900 border-transparent focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black dark:focus:ring-white rounded-xl transition-all"
                placeholder="student@example.com"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t.password}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 bg-gray-50 dark:bg-gray-900 border-transparent focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black dark:focus:ring-white rounded-xl transition-all"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>
            
            {message && (
              <div className="text-sm text-center p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-medium">
                {message}
              </div>
            )}

            <Button type="submit" className="w-full h-12 rounded-xl bg-black hover:bg-gray-800 text-white dark:bg-white dark:text-black dark:hover:bg-gray-200 text-base font-bold transition-all mt-4" disabled={loading}>
              {loading ? t.loading : t.submit}
            </Button>
          </form>

          <div className="text-center pt-2">
            <button 
              type="button" 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm font-bold text-gray-500 hover:text-black dark:hover:text-white transition-colors"
            >
              {t.toggle}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
