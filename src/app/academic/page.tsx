"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Filter, BookOpen, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";

export default function AcademicPage() {
  const { user, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState("all");
  const [filterSemester, setFilterSemester] = useState("current"); // Default to current
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      if (!user) return;
      
      // Fetch user profile for current year/semester
      const { data: profileData } = await supabase
        .from('profiles')
        .select('current_year, current_semester')
        .eq('id', user.id)
        .single();
        
      if (profileData) {
        setProfile(profileData);
      }

      // Fetch subjects
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (subjectsData) {
        // Also fetch total achievements for these subjects to calculate current grade (For MVP we do simple query or join)
        // A better approach is RPC or views, but let's do it simply for now
        setSubjects(subjectsData);
      }
    } catch (error) {
      console.error("Error fetching academic data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubjects = subjects.filter(sub => {
    let passYear = true;
    let passSem = true;
    
    if (filterYear !== "all") {
      passYear = sub.study_year.toString() === filterYear;
    }
    
    if (filterSemester !== "all") {
      if (filterSemester === "current" && profile) {
        passSem = sub.semester === profile.current_semester && sub.study_year === profile.current_year;
      } else {
        passSem = sub.semester.toString() === filterSemester;
      }
    }
    
    return passYear && passSem;
  });

  if (userLoading || loading) {
    return <div className="flex items-center justify-center h-full pt-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">القسم الأكاديمي</h1>
          <p className="text-gray-500 mt-1">إدارة المواد، توزيع الدرجات، ورصد الـ GPA.</p>
        </div>
        <Link href="/academic/add">
          <Button>
            <Plus className="w-5 h-5 ml-2" />
            إضافة مادة جديدة
          </Button>
        </Link>
      </header>

      {/* Filters */}
      <Card className="p-4 flex flex-col md:flex-row items-center gap-4 border-indigo-100 dark:border-indigo-900/30">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold ml-2">
          <Filter className="w-5 h-5" />
          <span>الفلاتر:</span>
        </div>
        <select 
          value={filterYear} 
          onChange={(e) => setFilterYear(e.target.value)}
          className="h-10 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="all">كل السنوات</option>
          <option value="1">السنة الأولى</option>
          <option value="2">السنة الثانية</option>
          <option value="3">السنة الثالثة</option>
          <option value="4">السنة الرابعة</option>
        </select>

        <select 
          value={filterSemester} 
          onChange={(e) => setFilterSemester(e.target.value)}
          className="h-10 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="all">كل الفصول</option>
          <option value="current">السمستر الحالي (بناءً على الإعدادات)</option>
          <option value="1">السمستر الأول</option>
          <option value="2">السمستر الثاني</option>
        </select>
      </Card>

      {/* Subjects Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50/50 dark:bg-gray-900/50">
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="p-4 font-bold text-gray-600 dark:text-gray-300">اسم المادة</th>
                <th className="p-4 font-bold text-gray-600 dark:text-gray-300">الكود</th>
                <th className="p-4 font-bold text-gray-600 dark:text-gray-300">السنة / الفصل</th>
                <th className="p-4 font-bold text-gray-600 dark:text-gray-300">الساعات</th>
                <th className="p-4 font-bold text-gray-600 dark:text-gray-300">الدرجة الكلية</th>
                <th className="p-4 font-bold text-center text-gray-600 dark:text-gray-300">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.map((subject) => (
                <tr key={subject.id} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="font-bold">{subject.name}</span>
                    </div>
                  </td>
                  <td className="p-4 font-medium text-gray-500">{subject.code}</td>
                  <td className="p-4 font-medium text-gray-500">السنة {subject.study_year} - سمستر {subject.semester}</td>
                  <td className="p-4 font-medium text-gray-500">{subject.credit_hours}</td>
                  <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">{subject.total_marks}</td>
                  <td className="p-4 text-center">
                    <Link href={`/academic/${subject.id}`}>
                      <Button variant="ghost" className="text-indigo-600 dark:text-indigo-400 font-bold">
                        إدارة الدرجات
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredSubjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">لا يوجد مواد دراسية مطابقة. أضف مواد دراسية جديدة.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
