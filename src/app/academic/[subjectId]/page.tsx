"use client";

import React, { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowRight, Save, Target, Trophy, Loader2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useLang } from "@/lib/useLanguage";

export default function SubjectDetailsPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const resolvedParams = use(params);
  const subjectId = resolvedParams.subjectId;
  const { user, loading: userLoading } = useUser();
  const { lang, t } = useLang();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Subject Data
  const [subject, setSubject] = useState<any>({ name: "", code: "", total_marks: 100 });
  const [distributions, setDistributions] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && subjectId) {
      fetchSubjectData();
    }
  }, [user, subjectId]);

  const fetchSubjectData = async () => {
    try {
      const { data: subData } = await supabase.from('subjects').select('*').eq('id', subjectId).single();
      if (subData) setSubject(subData);

      const { data: distData } = await supabase.from('subject_distributions').select('*').eq('subject_id', subjectId);
      
      const { data: cwData } = await supabase.from('coursework_details').select('*, subject_distributions!inner(subject_id)').eq('subject_distributions.subject_id', subjectId);

      if (distData) {
        const formattedDists = distData.map(d => ({
          ...d,
          maxMarks: d.max_marks,
          subItems: cwData ? cwData.filter(cw => cw.distribution_id === d.id).map(cw => ({...cw, maxMarks: cw.max_marks})) : []
        }));
        setDistributions(formattedDists);
      }

      const { data: achData } = await supabase.from('achievements').select('*, subject_distributions!inner(subject_id)').eq('subject_distributions.subject_id', subjectId);
      if (achData) {
        const achMap: Record<string, string> = {};
        achData.forEach(ach => {
          if (ach.coursework_id) {
            achMap[`sub-${ach.coursework_id}`] = ach.marks_obtained.toString();
          } else if (ach.distribution_id) {
            achMap[`dist-${ach.distribution_id}`] = ach.marks_obtained.toString();
          }
        });
        setAchievements(achMap);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // For MVP: delete all current achievements for this subject and re-insert
      const { data: distData } = await supabase.from('subject_distributions').select('id').eq('subject_id', subjectId);
      const distIds = distData?.map(d => d.id) || [];
      
      if (distIds.length > 0) {
        await supabase.from('achievements').delete().in('distribution_id', distIds);
      }

      const achsToInsert = [];
      for (const [key, val] of Object.entries(achievements)) {
        if (!val || isNaN(parseFloat(val))) continue;
        if (key.startsWith('dist-')) {
          const distId = key.replace('dist-', '');
          achsToInsert.push({ user_id: user.id, distribution_id: distId, coursework_id: null, marks_obtained: parseFloat(val) });
        } else if (key.startsWith('sub-')) {
          const subId = key.replace('sub-', '');
          // Need to find the parent distId for this coursework
          const dist = distributions.find(d => d.subItems?.find((s:any) => s.id === subId));
          if (dist) {
            achsToInsert.push({ user_id: user.id, distribution_id: dist.id, coursework_id: subId, marks_obtained: parseFloat(val) });
          }
        }
      }
      
      if (achsToInsert.length > 0) {
        await supabase.from('achievements').insert(achsToInsert);
      }
      
      alert(lang === 'ar' ? "تم الحفظ بنجاح!" : "Saved successfully!");
    } catch (error) {
      console.error(error);
      alert(lang === 'ar' ? "حدث خطأ أثناء الحفظ." : "Error saving data.");
    } finally {
      setSaving(false);
    }
  };

  const [newDist, setNewDist] = useState({ title: "", maxMarks: "", isCoursework: false });
  const [newSubItems, setNewSubItems] = useState<Record<string, {title: string, maxMarks: string}>>({});

  const totalDistributed = distributions.reduce((sum, d) => sum + (d.maxMarks || d.max_marks || 0), 0);
  const remainingMarks = subject.total_marks - totalDistributed;

  let totalObtained = 0;
  Object.values(achievements).forEach(val => {
    totalObtained += parseFloat(val) || 0;
  });

  const handleAddDist = async () => {
    const marks = parseFloat(newDist.maxMarks);
    if (!newDist.title || isNaN(marks) || marks <= 0) return;
    if (marks > remainingMarks) {
      alert(lang === 'ar' ? `عذراً، الدرجات المتبقية هي ${remainingMarks} فقط!` : `Only ${remainingMarks} marks remaining!`);
      return;
    }
    
    try {
      const { data, error } = await supabase.from('subject_distributions').insert({
        subject_id: subjectId,
        title: newDist.title,
        max_marks: marks,
        is_coursework: newDist.isCoursework
      }).select().single();
      
      if (error) throw error;
      
      setDistributions([...distributions, { ...data, maxMarks: data.max_marks, subItems: [] }]);
      setNewDist({ title: "", maxMarks: "", isCoursework: false });
    } catch(err) {
      console.error(err);
      alert(lang === 'ar' ? "حدث خطأ أثناء الإضافة." : "Error adding item.");
    }
  };

  const handleAddSubItem = async (distId: string) => {
    const subData = newSubItems[distId];
    if (!subData || !subData.title) return;
    const marks = parseFloat(subData.maxMarks);
    if (isNaN(marks) || marks <= 0) return;
    
    const dist = distributions.find(d => d.id === distId);
    if (!dist) return;
    
    const currentSubTotal = dist.subItems.reduce((s:any, item:any) => s + (item.maxMarks || item.max_marks || 0), 0);
    if (currentSubTotal + marks > dist.max_marks) {
      alert(lang === 'ar' ? `مجموع أعمال السنة لا يمكن أن يتجاوز ${dist.max_marks}` : `Coursework total cannot exceed ${dist.max_marks}`);
      return;
    }

    try {
      const { data, error } = await supabase.from('coursework_details').insert({
        distribution_id: distId,
        title: subData.title,
        max_marks: marks
      }).select().single();
      
      if (error) throw error;
      
      setDistributions(distributions.map(d => {
        if (d.id === distId) {
          return { ...d, subItems: [...d.subItems, { ...data, maxMarks: data.max_marks }] };
        }
        return d;
      }));
      
      setNewSubItems({...newSubItems, [distId]: {title: "", maxMarks: ""}});
    } catch (err) {
      console.error(err);
    }
  };

  const updateAchievement = (key: string, value: string, maxMarks: number) => {
    const numValue = parseFloat(value);
    if (numValue > maxMarks) {
      alert(lang === 'ar' ? `الدرجة لا يمكن أن تتجاوز ${maxMarks}` : `Marks cannot exceed ${maxMarks}`);
      return;
    }
    setAchievements({ ...achievements, [key]: value });
  };

  if (loading || userLoading) {
    return <div className="flex items-center justify-center h-full pt-20"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0a0a0a] p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/academic">
            <Button variant="ghost" className="px-3 rounded-xl bg-gray-50 dark:bg-gray-900">
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              {subject.name} <span className="text-sm font-bold text-gray-400 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded-md">{subject.code}</span>
            </h1>
            <p className="text-gray-500 mt-1 font-bold text-sm">
              {lang === 'ar' ? 'إجمالي درجات المادة:' : 'Total Marks:'} <span className="text-black dark:text-white text-lg">{subject.total_marks}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-center">
          <div className="px-6 py-2 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 font-bold mb-1">{lang === 'ar' ? 'المجموع المحصل' : 'Total Obtained'}</p>
            <p className="text-xl font-extrabold text-black dark:text-white">{totalObtained} / {subject.total_marks}</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="h-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 font-bold">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* التوزيع */}
        <Card className="p-6 space-y-6 bg-white dark:bg-[#0a0a0a] border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-black dark:text-white">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{lang === 'ar' ? 'توزيع الدرجات' : 'Mark Distribution'}</h2>
                <p className={`text-xs font-bold mt-1 ${remainingMarks === 0 ? 'text-green-500' : 'text-gray-500'}`}>
                  {lang === 'ar' ? 'المتبقي للتوزيع:' : 'Remaining:'} {remainingMarks}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {distributions.map((dist) => (
              <div key={dist.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-[#050505] border border-gray-100 dark:border-gray-900">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-gray-900 dark:text-white">{dist.title} {dist.is_coursework && <span className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md ml-2">{lang === 'ar' ? 'أعمال سنة' : 'Coursework'}</span>}</span>
                  <span className="text-black dark:text-white">{dist.max_marks}</span>
                </div>
                
                {dist.is_coursework && (
                  <div className="mt-4 pl-4 border-l-2 border-gray-200 dark:border-gray-800 space-y-3">
                    {dist.subItems && dist.subItems.map((sub: any) => (
                      <div key={sub.id} className="flex justify-between items-center text-sm font-medium bg-white dark:bg-[#0a0a0a] p-2 rounded-lg border border-gray-100 dark:border-gray-900">
                        <span className="text-gray-600 dark:text-gray-300">{sub.title}</span>
                        <span className="text-gray-900 dark:text-white">{sub.max_marks}</span>
                      </div>
                    ))}
                    
                    {/* Add new sub item input */}
                    <div className="flex gap-2 mt-2">
                      <Input 
                        placeholder={lang === 'ar' ? 'مثل: كويز 1' : 'e.g. Quiz 1'} 
                        className="h-9 text-sm bg-white dark:bg-[#0a0a0a]" 
                        value={newSubItems[dist.id]?.title || ''}
                        onChange={(e) => setNewSubItems({...newSubItems, [dist.id]: {...newSubItems[dist.id], title: e.target.value}})}
                      />
                      <Input 
                        type="number" 
                        placeholder={lang === 'ar' ? 'الدرجة' : 'Marks'} 
                        className="h-9 w-20 text-sm bg-white dark:bg-[#0a0a0a]" 
                        value={newSubItems[dist.id]?.maxMarks || ''}
                        onChange={(e) => setNewSubItems({...newSubItems, [dist.id]: {...newSubItems[dist.id], maxMarks: e.target.value}})}
                      />
                      <Button onClick={() => handleAddSubItem(dist.id)} className="h-9 px-3 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                        {lang === 'ar' ? 'إضافة' : 'Add'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add New Distribution */}
            {remainingMarks > 0 && (
              <div className="p-4 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 bg-gray-50/50 dark:bg-[#050505]/50 space-y-3">
                <p className="text-sm font-bold text-gray-500">{lang === 'ar' ? 'إضافة بند تقييم جديد:' : 'Add New Category:'}</p>
                <div className="flex flex-col md:flex-row gap-3">
                  <Input 
                    placeholder={lang === 'ar' ? 'مثل: الميدتيرم' : 'e.g. Midterm'} 
                    value={newDist.title} onChange={e => setNewDist({...newDist, title: e.target.value})}
                  />
                  <Input 
                    type="number" placeholder={lang === 'ar' ? 'الدرجة' : 'Marks'} className="w-full md:w-24"
                    value={newDist.maxMarks} onChange={e => setNewDist({...newDist, maxMarks: e.target.value})}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-black focus:ring-black dark:text-white dark:focus:ring-white"
                      checked={newDist.isCoursework}
                      onChange={e => setNewDist({...newDist, isCoursework: e.target.checked})}
                    />
                    {lang === 'ar' ? 'أعمال سنة (يحتوي تفاصيل)' : 'Coursework (Contains sub-items)'}
                  </label>
                  <Button onClick={handleAddDist} size="sm" className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 font-bold">{lang === 'ar' ? 'إضافة' : 'Add'}</Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* الإنجازات */}
        <Card className="p-6 space-y-6 bg-white dark:bg-[#0a0a0a] border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-black dark:text-white">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{lang === 'ar' ? 'الإنجازات ورصد الدرجات' : 'Achievements'}</h2>
              <p className="text-xs text-gray-500 mt-1">{lang === 'ar' ? 'سجل درجاتك لكل بند لمعرفة نسبة نجاحك' : 'Record your marks to see your progress'}</p>
            </div>
          </div>

          <div className="space-y-4">
            {distributions.map(dist => (
              <div key={`achieve-${dist.id}`} className="space-y-3">
                {!dist.is_coursework ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-[#050505] border border-gray-100 dark:border-gray-900">
                    <span className="font-bold text-gray-900 dark:text-white">{dist.title} <span className="text-gray-400 text-xs">({dist.max_marks})</span></span>
                    <div className="flex items-center gap-3">
                      <Input 
                        type="number" className="w-20 h-9 text-center font-bold text-black dark:text-white border-gray-300 dark:border-gray-700 focus:ring-black dark:focus:ring-white"
                        placeholder="-"
                        value={achievements[`dist-${dist.id}`] || ''}
                        onChange={e => updateAchievement(`dist-${dist.id}`, e.target.value, dist.max_marks)}
                      />
                      {achievements[`dist-${dist.id}`] && (
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400 w-12 text-left">
                          {Math.round((parseFloat(achievements[`dist-${dist.id}`]) / dist.max_marks) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#050505] border border-gray-100 dark:border-gray-900">
                    <p className="font-bold text-gray-900 dark:text-white mb-3">{dist.title} <span className="text-xs text-gray-500">({dist.max_marks})</span></p>
                    <div className="space-y-2">
                      {dist.subItems?.map((sub: any) => (
                        <div key={`achieve-sub-${sub.id}`} className="flex items-center justify-between pl-4">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{sub.title} <span className="text-gray-400 text-xs">({sub.max_marks})</span></span>
                          <div className="flex items-center gap-3">
                            <Input 
                              type="number" className="w-16 h-8 text-center text-sm font-bold border-gray-300 dark:border-gray-700 focus:ring-black dark:focus:ring-white"
                              placeholder="-"
                              value={achievements[`sub-${sub.id}`] || ''}
                              onChange={e => updateAchievement(`sub-${sub.id}`, e.target.value, sub.max_marks)}
                            />
                            {achievements[`sub-${sub.id}`] && (
                              <span className="text-xs font-bold text-gray-600 dark:text-gray-400 w-10 text-left">
                                {Math.round((parseFloat(achievements[`sub-${sub.id}`]) / sub.max_marks) * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {dist.subItems?.length === 0 && (
                        <p className="text-xs text-gray-500">{lang === 'ar' ? 'قم بإضافة تفاصيل أعمال السنة أولاً.' : 'Add coursework details first.'}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {distributions.length === 0 && (
              <p className="text-center text-gray-500 p-4">{lang === 'ar' ? 'قم بإضافة توزيع الدرجات أولاً.' : 'Add mark distribution first.'}</p>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
