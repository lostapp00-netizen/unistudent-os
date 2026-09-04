"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Plus, Trash2, Building2, GraduationCap, Calendar, Trophy, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";

export default function SettingsPage() {
  const { user, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(false);
  const [initialFetchLoading, setInitialFetchLoading] = useState(true);
  const [message, setMessage] = useState("");
  
  // Profile State
  const [profile, setProfile] = useState({
    full_name: "",
    university_name: "",
    college_name: "",
    start_date: "",
    total_years: 4,
    semesters_per_year: 2,
    current_year: 1,
    current_semester: 1,
    current_semester_start: "",
    current_semester_end: ""
  });

  // Grade Scale State
  const [gradeScale, setGradeScale] = useState<{id?: string, grade_name: string, min_percentage: string, max_percentage: string, points: string}[]>([]);

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else if (!userLoading) {
      setInitialFetchLoading(false);
    }
  }, [user, userLoading]);

  const fetchSettings = async () => {
    try {
      if (!user) return;
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (profileData) {
        setProfile({
          full_name: profileData.full_name || "",
          university_name: profileData.university_name || "",
          college_name: profileData.college_name || "",
          start_date: profileData.start_date || "",
          total_years: profileData.total_years || 4,
          semesters_per_year: profileData.semesters_per_year || 2,
          current_year: profileData.current_year || 1,
          current_semester: profileData.current_semester || 1,
          current_semester_start: profileData.current_semester_start || "",
          current_semester_end: profileData.current_semester_end || ""
        });
      }

      const { data: gradeData, error: gradeError } = await supabase
        .from('grade_scales')
        .select('*')
        .eq('user_id', user.id)
        .order('min_percentage', { ascending: false });

      if (gradeData) {
        setGradeScale(gradeData.map(g => ({
          id: g.id,
          grade_name: g.grade_name,
          min_percentage: g.min_percentage.toString(),
          max_percentage: g.max_percentage.toString(),
          points: g.points.toString()
        })));
      }
      
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setInitialFetchLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      setMessage("يرجى تسجيل الدخول أولاً לחفظ الإعدادات.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...profile
        });

      if (profileError) throw profileError;

      // Save Grade Scales (simplified: delete old, insert new for this demo)
      await supabase.from('grade_scales').delete().eq('user_id', user.id);
      
      if (gradeScale.length > 0) {
        const scalesToInsert = gradeScale.map(g => ({
          user_id: user.id,
          grade_name: g.grade_name,
          min_percentage: parseFloat(g.min_percentage),
          max_percentage: parseFloat(g.max_percentage),
          points: parseFloat(g.points)
        }));
        const { error: gradeError } = await supabase.from('grade_scales').insert(scalesToInsert);
        if (gradeError) throw gradeError;
      }

      setMessage("تم حفظ الإعدادات بنجاح!");
    } catch (error: any) {
      console.error(error);
      setMessage("حدث خطأ أثناء الحفظ: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addGrade = () => {
    setGradeScale([...gradeScale, { grade_name: "", min_percentage: "", max_percentage: "", points: "" }]);
  };

  const removeGrade = (index: number) => {
    const newGrades = [...gradeScale];
    newGrades.splice(index, 1);
    setGradeScale(newGrades);
  };

  const updateGrade = (index: number, field: string, value: string) => {
    const newGrades = [...gradeScale];
    (newGrades[index] as any)[field] = value;
    setGradeScale(newGrades);
  };

  if (initialFetchLoading || userLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">إعدادات النظام</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">خصص تجربتك الأكاديمية وبيانات جامعتك.</p>
        </div>
        <Button onClick={handleSave} disabled={loading} className="w-full md:w-auto">
          {loading ? "جاري الحفظ..." : "حفظ التغييرات"}
          <Save className="w-5 h-5 mr-2" />
        </Button>
      </header>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${message.includes('نجاح') ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* بيانات الجامعة */}
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold">البيانات الشخصية والجامعية</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">الاسم الكامل</label>
              <Input 
                value={profile.full_name} 
                onChange={e => setProfile({...profile, full_name: e.target.value})} 
                placeholder="أدخل اسمك" 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">اسم الجامعة</label>
                <Input 
                  value={profile.university_name} 
                  onChange={e => setProfile({...profile, university_name: e.target.value})} 
                  placeholder="مثال: جامعة القاهرة" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">اسم الكلية</label>
                <Input 
                  value={profile.college_name} 
                  onChange={e => setProfile({...profile, college_name: e.target.value})} 
                  placeholder="مثال: كلية الهندسة" 
                />
              </div>
            </div>
          </div>
        </Card>

        {/* التفاصيل الأكاديمية */}
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold">نظام الدراسة</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ الالتحاق بالكلية</label>
              <Input 
                type="date"
                value={profile.start_date} 
                onChange={e => setProfile({...profile, start_date: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">عدد سنوات الدراسة</label>
                <Input 
                  type="number" min="1" max="7"
                  value={profile.total_years} 
                  onChange={e => setProfile({...profile, total_years: parseInt(e.target.value)})} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">عدد الفصول (السمسترات) في السنة</label>
                <Input 
                  type="number" min="1" max="4"
                  value={profile.semesters_per_year} 
                  onChange={e => setProfile({...profile, semesters_per_year: parseInt(e.target.value)})} 
                />
              </div>
            </div>
          </div>
        </Card>

        {/* السمستر الحالي */}
        <Card className="p-6 space-y-6 lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold">الفصل الدراسي الحالي (يُحدث يدوياً كل سمستر)</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">أنت الآن في السنة</label>
              <Input 
                type="number" min="1"
                value={profile.current_year} 
                onChange={e => setProfile({...profile, current_year: parseInt(e.target.value)})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">السمستر الحالي</label>
              <Input 
                type="number" min="1"
                value={profile.current_semester} 
                onChange={e => setProfile({...profile, current_semester: parseInt(e.target.value)})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ البداية</label>
              <Input 
                type="date"
                value={profile.current_semester_start} 
                onChange={e => setProfile({...profile, current_semester_start: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ النهاية المتوقع</label>
              <Input 
                type="date"
                value={profile.current_semester_end} 
                onChange={e => setProfile({...profile, current_semester_end: e.target.value})} 
              />
            </div>
          </div>
        </Card>

        {/* لائحة التقديرات */}
        <Card className="p-6 space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">لائحة تقديرات الجامعة</h2>
                <p className="text-sm text-gray-500">أضف التقديرات وشرط الحصول عليها (النسب المئوية والنقاط)</p>
              </div>
            </div>
            <Button variant="outline" onClick={addGrade} className="h-10 px-4">
              إضافة تقدير
              <Plus className="w-4 h-4 mr-2" />
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500">
                  <th className="pb-3 font-medium">رمز التقدير (مثلاً A+)</th>
                  <th className="pb-3 font-medium">من نسبة (%)</th>
                  <th className="pb-3 font-medium">إلى نسبة (%)</th>
                  <th className="pb-3 font-medium">عدد النقاط (GPA)</th>
                  <th className="pb-3 font-medium text-center">حذف</th>
                </tr>
              </thead>
              <tbody>
                {gradeScale.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      لا يوجد تقديرات مضافة. اضغط على "إضافة تقدير" للبدء.
                    </td>
                  </tr>
                )}
                {gradeScale.map((grade, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                    <td className="py-3 pr-2">
                      <Input value={grade.grade_name} onChange={(e) => updateGrade(index, 'grade_name', e.target.value)} placeholder="A+" className="w-24" />
                    </td>
                    <td className="py-3 pr-2">
                      <Input type="number" value={grade.min_percentage} onChange={(e) => updateGrade(index, 'min_percentage', e.target.value)} placeholder="95" className="w-24" />
                    </td>
                    <td className="py-3 pr-2">
                      <Input type="number" value={grade.max_percentage} onChange={(e) => updateGrade(index, 'max_percentage', e.target.value)} placeholder="100" className="w-24" />
                    </td>
                    <td className="py-3 pr-2">
                      <Input type="number" step="0.1" value={grade.points} onChange={(e) => updateGrade(index, 'points', e.target.value)} placeholder="4.0" className="w-24" />
                    </td>
                    <td className="py-3 text-center">
                      <button onClick={() => removeGrade(index)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
