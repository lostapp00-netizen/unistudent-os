"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, CheckCircle2, Circle, Link as LinkIcon, Flag, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/useLanguage";

export default function TasksSection() {
  const { user } = useUser();
  const { lang, t } = useLang();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [importance, setImportance] = useState("عادي");

  useEffect(() => {
    if (user) fetchTasks();
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (data) setTasks(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (id: string, currentStatus: boolean) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: !currentStatus } : t));
    await supabase.from('tasks').update({ is_completed: !currentStatus }).eq('id', id);
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title,
        description,
        due_date: dueDate || null,
        importance_level: importance
      }).select().single();
      
      if (error) throw error;
      setTasks([data, ...tasks]);
      setIsModalOpen(false);
      
      // Reset form
      setTitle("");
      setDescription("");
      setDueDate("");
      setImportance("عادي");
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء إضافة المهمة.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>;

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{lang === 'ar' ? 'قائمة المهام' : 'Tasks List'}</h2>
          <p className="text-gray-500 text-sm mt-1">{lang === 'ar' ? 'تتبع مهامك واربطها بملاحظاتك' : 'Track your tasks and link them to notes'}</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-black hover:bg-gray-800 text-white dark:bg-white dark:text-black dark:hover:bg-gray-200">
          <Plus className="w-5 h-5 ml-2" />
          {lang === 'ar' ? 'مهمة جديدة' : 'New Task'}
        </Button>
      </div>

      <div className="space-y-4 overflow-y-auto pr-2 pb-4 custom-scrollbar">
        {tasks.map(task => (
          <div key={task.id} className={`flex items-start gap-4 p-5 rounded-3xl border transition-all duration-300 ${task.is_completed ? 'bg-gray-50/50 dark:bg-[#0a0a0a]/50 border-gray-100 dark:border-gray-900 opacity-60 grayscale' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md'}`}>
            <button onClick={() => toggleTask(task.id, task.is_completed)} className="flex-shrink-0 transition-transform hover:scale-110 active:scale-95 mt-1">
              {task.is_completed ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : (
                <Circle className="w-6 h-6 text-gray-300 dark:text-gray-700 hover:text-black dark:hover:text-white" />
              )}
            </button>
            
            <div className="flex-1">
              <h3 className={`font-bold text-lg ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{task.title}</h3>
              {task.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
              )}
              
              <div className="flex flex-wrap gap-3 mt-3 text-xs font-bold">
                {task.due_date && (
                  <span className={`px-2 py-1 rounded-md ${task.is_completed ? 'bg-gray-100 text-gray-400 dark:bg-gray-800' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                    الاستحقاق: {new Date(task.due_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                  </span>
                )}
                <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${task.importance_level === 'عالي' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                  <Flag className="w-3 h-3" />
                  الأهمية: {task.importance_level}
                </span>
              </div>
            </div>
            
            {task.note_id && (
              <div className="flex items-center justify-center p-3 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-500 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="مربوط بملاحظة أو ملف">
                <LinkIcon className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}
        {tasks.length === 0 && <p className="text-gray-500 text-center py-10">{lang === 'ar' ? 'لا يوجد مهام. ابدأ بإضافة مهمة جديدة!' : 'No tasks. Start by adding a new one!'}</p>}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={lang === 'ar' ? 'إضافة مهمة جديدة' : 'Add New Task'}
      >
        <form onSubmit={addTask} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{lang === 'ar' ? 'عنوان المهمة' : 'Task Title'}</label>
            <Input 
              required 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder={lang === 'ar' ? 'مثال: تسليم مشروع التخرج' : 'e.g. Submit Final Project'} 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{lang === 'ar' ? 'التفاصيل (اختياري)' : 'Description (Optional)'}</label>
            <textarea 
              className="w-full min-h-[100px] p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-2 focus:ring-black dark:focus:ring-white outline-none resize-none text-sm"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={lang === 'ar' ? 'اكتب تفاصيل المهمة هنا...' : 'Write task details here...'}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
              <Input 
                type="date" 
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{lang === 'ar' ? 'مستوى الأهمية' : 'Importance'}</label>
              <select 
                className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-2 focus:ring-black dark:focus:ring-white outline-none text-sm"
                value={importance}
                onChange={e => setImportance(e.target.value)}
              >
                <option value="عادي">{lang === 'ar' ? 'عادي' : 'Normal'}</option>
                <option value="عالي">{lang === 'ar' ? 'عالي' : 'High'}</option>
                <option value="منخفض">{lang === 'ar' ? 'منخفض' : 'Low'}</option>
              </select>
            </div>
          </div>
          
          <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 font-bold rounded-xl mt-4">
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (lang === 'ar' ? 'حفظ المهمة' : 'Save Task')}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
