"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BookPlus, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";

export default function AddSubjectPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [subject, setSubject] = useState({
    name: "",
    code: "",
    year: "1",
    semester: "1",
    credits: "3",
    totalMarks: "100"
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg("يرجى تسجيل الدخول أولاً.");
      return;
    }
    
    setLoading(true);
    setErrorMsg("");
    
    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert({
          user_id: user.id,
          name: subject.name,
          code: subject.code,
          study_year: parseInt(subject.year),
          semester: parseInt(subject.semester),
          credit_hours: parseInt(subject.credits),
          total_marks: parseInt(subject.totalMarks)
        })
        .select()
        .single();
        
      if (error) throw error;
      
      router.push("/academic");
    } catch (error: any) {
      console.error(error);
      setErrorMsg("حدث خطأ أثناء الإضافة: " + error.message);
      setLoading(false);
    }
  };

  if (userLoading) {
    return <div className="flex items-center justify-center h-full pt-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto pb-20">
      <header className="flex items-center gap-4">
        <Link href="/academic">
          <Button variant="ghost" className="px-3">
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">إضافة مادة جديدة</h1>
          <p className="text-gray-500 mt-1">أدخل بيانات المادة لبدء تتبع درجاتها.</p>
        </div>
      </header>

      {errorMsg && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-red-100 text-red-800 border border-red-200">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave}>
        <Card className="p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <BookPlus className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">بيانات المادة الأساسية</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">اسم المادة</label>
              <Input 
                required 
                placeholder="مثال: مقدمة في البرمجة" 
                value={subject.name}
                onChange={e => setSubject({...subject, name: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">كود المادة</label>
              <Input 
                placeholder="مثال: CS101" 
                value={subject.code}
                onChange={e => setSubject({...subject, code: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">الدرجة الكلية للمادة</label>
              <Input 
                type="number" required min="1"
                placeholder="100" 
                value={subject.totalMarks}
                onChange={e => setSubject({...subject, totalMarks: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">السنة الدراسية</label>
              <select 
                value={subject.year} 
                onChange={(e) => setSubject({...subject, year: e.target.value})}
                className="flex h-12 w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="1">السنة الأولى</option>
                <option value="2">السنة الثانية</option>
                <option value="3">السنة الثالثة</option>
                <option value="4">السنة الرابعة</option>
                <option value="5">السنة الخامسة</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">الفصل الدراسي (السمستر)</label>
              <select 
                value={subject.semester} 
                onChange={(e) => setSubject({...subject, semester: e.target.value})}
                className="flex h-12 w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="1">السمستر الأول</option>
                <option value="2">السمستر الثاني</option>
                <option value="3">السمستر الصيفي</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">عدد الساعات المعتمدة (Credits)</label>
              <Input 
                type="number" required min="0" max="10"
                placeholder="3" 
                value={subject.credits}
                onChange={e => setSubject({...subject, credits: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-end">
            <Button type="submit" disabled={loading} className="w-full md:w-auto px-8">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "حفظ المادة"}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
