"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Lightbulb, Activity, ArrowUpRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useLang } from "@/lib/useLanguage";

export default function InsightsPage() {
  const { user } = useUser();
  const { lang } = useLang();
  
  const [loading, setLoading] = useState(true);
  const [gpa, setGpa] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [improvements, setImprovements] = useState<any[]>([]);
  const [hasData, setHasData] = useState(true);

  useEffect(() => {
    if (user) fetchInsights();
  }, [user]);

  const fetchInsights = async () => {
    try {
      // 1. Fetch Subjects
      const { data: subjects } = await supabase.from('subjects').select('*').eq('user_id', user?.id);
      if (!subjects || subjects.length === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      // 2. Fetch Achievements
      const { data: achievements } = await supabase.from('achievements').select('*, subject_distributions(subject_id)').eq('user_id', user?.id);
      
      const subjectTotals: Record<string, number> = {};
      subjects.forEach(s => subjectTotals[s.id] = 0);
      
      if (achievements) {
        achievements.forEach(ach => {
          const subId = ach.subject_distributions?.subject_id;
          if (subId && subjectTotals[subId] !== undefined) {
            subjectTotals[subId] += parseFloat(ach.marks_obtained);
          }
        });
      }

      let totalSubjectMarks = 0;
      let totalObtainedMarks = 0;
      
      const newAlerts: any[] = [];
      const newImprovements: any[] = [];

      subjects.forEach(sub => {
        totalSubjectMarks += sub.total_marks;
        const obtained = subjectTotals[sub.id] || 0;
        totalObtainedMarks += obtained;
        
        const percentage = (obtained / sub.total_marks) * 100;
        
        // Generate dynamic alerts if percentage is low
        if (percentage > 0 && percentage < 60) {
          newAlerts.push({
            subject: sub.name,
            code: sub.code,
            issue: lang === 'ar' ? `درجاتك الحالية (${percentage.toFixed(1)}%) تحتاج إلى تحسين.` : `Current marks (${percentage.toFixed(1)}%) need improvement.`,
            advice: lang === 'ar' ? 'ركز على المهام القادمة والمراجعة المكثفة لهذه المادة.' : 'Focus on upcoming tasks and intensive review for this subject.'
          });
        }
        
        // Generate dynamic improvements if percentage is good but can be better
        if (percentage >= 70 && percentage < 90) {
          newImprovements.push({
            subject: sub.name,
            code: sub.code,
            currentGrade: `${percentage.toFixed(1)}%`,
            targetGrade: '90%+',
            requiredMarks: lang === 'ar' ? `أنت قريب جداً من الامتياز! تحتاج إلى التركيز للحصول على أعلى الدرجات في النهائي.` : `You are very close to excellence! Focus on Finals.`
          });
        }
      });

      if (totalSubjectMarks > 0 && totalObtainedMarks > 0) {
        const overallPercentage = (totalObtainedMarks / totalSubjectMarks) * 100;
        // Simple GPA mapping (for MVP purposes)
        let calcGpa = 0;
        if (overallPercentage >= 90) calcGpa = 4.0;
        else if (overallPercentage >= 85) calcGpa = 3.7;
        else if (overallPercentage >= 80) calcGpa = 3.3;
        else if (overallPercentage >= 75) calcGpa = 3.0;
        else if (overallPercentage >= 70) calcGpa = 2.7;
        else if (overallPercentage >= 65) calcGpa = 2.3;
        else if (overallPercentage >= 60) calcGpa = 2.0;
        else calcGpa = 1.0;
        
        setGpa(calcGpa);
      } else {
        setGpa(null);
      }
      
      setAlerts(newAlerts);
      setImprovements(newImprovements);
      setHasData(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>;

  if (!hasData) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto flex flex-col items-center justify-center text-center pt-20">
        <Activity className="w-20 h-20 text-gray-300 dark:text-gray-700 mb-4" />
        <h1 className="text-3xl font-extrabold tracking-tight">{lang === 'ar' ? 'لا يوجد بيانات للتحليل' : 'No Data to Analyze'}</h1>
        <p className="text-gray-500 mt-2 max-w-md">{lang === 'ar' ? 'قم بإضافة مواد أكاديمية ورصد درجاتك في قسم (الأكاديمي) لتظهر لك التحليلات وتوقعات الـ GPA هنا.' : 'Add academic subjects and record marks to see insights and GPA estimations here.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{lang === 'ar' ? 'التحليلات والإنذارات' : 'Insights & Alerts'}</h1>
        <p className="text-gray-500 mt-1">{lang === 'ar' ? 'راقب أداءك الأكاديمي، واكتشف فرص التحسين.' : 'Monitor your academic performance and discover improvement opportunities.'}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8 col-span-1 md:col-span-1 bg-gradient-to-br from-black to-gray-800 dark:from-white dark:to-gray-300 text-white dark:text-black border-0 shadow-xl relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity className="w-48 h-48" />
          </div>
          <div className="relative z-10">
            <h2 className="text-lg font-medium opacity-90">{lang === 'ar' ? 'المعدل التراكمي المتوقع (GPA)' : 'Estimated GPA'}</h2>
            <div className="text-6xl font-extrabold mt-2 mb-4">{gpa ? gpa.toFixed(2) : '-.--'}</div>
            {gpa && gpa >= 3.0 && (
               <p className="text-sm font-bold flex items-center gap-2 bg-white/20 dark:bg-black/10 w-fit px-3 py-1.5 rounded-xl backdrop-blur-md">
                 <ArrowUpRight className="w-4 h-4" />
                 {lang === 'ar' ? 'أداءك ممتاز!' : 'Excellent Performance!'}
               </p>
            )}
          </div>
        </Card>

        <Card className="p-6 col-span-1 md:col-span-2 space-y-4 bg-white dark:bg-[#0a0a0a] border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold">{lang === 'ar' ? 'إنذارات أكاديمية ومخاطر' : 'Academic Alerts & Risks'}</h2>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-gray-500 p-4">{lang === 'ar' ? 'لا توجد إنذارات حالية. أداءك مستقر.' : 'No active alerts. Your performance is stable.'}</p>
            ) : alerts.map((alert, i) => (
              <div key={i} className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 flex flex-col gap-2 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-red-800 dark:text-red-300">{alert.subject}</span>
                  <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-md">{alert.code}</span>
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{alert.issue}</p>
                <div className="mt-2 p-3 bg-white/80 dark:bg-black/20 rounded-xl text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{alert.advice}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 space-y-4 bg-white dark:bg-[#0a0a0a] border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold">{lang === 'ar' ? 'خطة التعويض وفرص التحسين المتاحة' : 'Improvement Opportunities'}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {improvements.length === 0 ? (
             <p className="text-gray-500 p-4 col-span-2">{lang === 'ar' ? 'استمر في تسجيل المزيد من الدرجات لاكتشاف فرص التحسين.' : 'Keep recording marks to discover improvement opportunities.'}</p>
          ) : improvements.map((item, i) => (
            <div key={i} className="p-5 rounded-2xl bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-green-900 dark:text-green-300">{item.subject}</h3>
                  <span className="text-xs text-gray-500">{item.code}</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className="text-gray-500">{item.currentGrade}</span>
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">{item.targetGrade}</span>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 p-3 bg-white/80 dark:bg-black/20 rounded-xl">
                {item.requiredMarks}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
