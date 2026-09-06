"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { BookOpen, Target, BrainCircuit, CheckCircle2, Trophy, Clock, Zap, CalendarCheck, Settings, TrendingUp } from "lucide-react";
import { useLang } from "@/lib/useLanguage";

export default function DashboardPage() {
  const { t, lang } = useLang();
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            {lang === 'ar' ? 'مرحباً بعودتك!' : 'Welcome back!'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
            {lang === 'ar' ? 'نظرة عامة على أدائك الأكاديمي ومهامك اليومية.' : 'Overview of your academic performance and daily tasks.'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 cursor-pointer group">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">القسم الأكاديمي</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">إدارة المواد، توزيع الدرجات، ورصد الإنجازات وحساب المعدل التراكمي بدقة.</p>
        </Card>

        <Card className="p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 cursor-pointer group">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <CalendarCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">الإنتاجية والمهام</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">تنظيم الملاحظات، المهام، ومساحة التخزين الخاصة بك مع تقويم تفاعلي.</p>
        </Card>

        <Card className="p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 cursor-pointer group">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">التحليلات والإنذارات</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">تابع أداءك الأكاديمي، وتلقى إنذارات مبكرة للمواد التي تحتاج إلى تحسين.</p>
        </Card>
      </div>
    </div>
  );
}
