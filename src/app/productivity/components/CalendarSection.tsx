"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useLang } from "@/lib/useLanguage";

export default function CalendarSection() {
  const { user } = useUser();
  const { lang, t } = useLang();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchTasks();
  }, [user, currentDate]);

  const fetchTasks = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id)
        .gte('due_date', startDate)
        .lte('due_date', endDate);

      if (data) setTasks(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  // Adjust starting day for RTL/LTR. 
  // In English (LTR), Sunday is 0. In Arabic (RTL), often Sunday is 0 but we want it to map correctly to our grid.
  
  const monthNamesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const daysOfWeekAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const daysOfWeekEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const monthName = lang === 'ar' ? monthNamesAr[currentDate.getMonth()] : monthNamesEn[currentDate.getMonth()];
  const daysOfWeek = lang === 'ar' ? daysOfWeekAr : daysOfWeekEn;

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-extrabold">{monthName} {currentDate.getFullYear()}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white dark:bg-[#0a0a0a] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-1">
            <button onClick={lang === 'ar' ? nextMonth : prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
            <button onClick={lang === 'ar' ? prevMonth : nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col shadow-xl">
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#050505]">
          {daysOfWeek.map(day => (
            <div key={day} className="p-4 text-center text-sm font-bold text-gray-500 border-l last:border-0 border-gray-200 dark:border-gray-800">{day}</div>
          ))}
        </div>
        
        {loading ? (
          <div className="flex-1 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : (
          <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-white dark:bg-[#0a0a0a]">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="border-b border-l border-gray-100 dark:border-gray-900 p-2 bg-gray-50/50 dark:bg-black/50" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayTasks = tasks.filter(t => t.due_date && new Date(t.due_date).getDate() === day);
              const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
              
              return (
                <div key={day} className="border-b border-l border-gray-100 dark:border-gray-900 p-2 min-h-[100px] hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer group flex flex-col">
                  <div className={`flex justify-center md:justify-end mb-1`}>
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${isToday ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' : 'text-gray-700 dark:text-gray-300'}`}>
                      {day}
                    </span>
                  </div>
                  
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                    {dayTasks.map(task => (
                      <div key={task.id} className="text-[10px] md:text-xs p-1 md:p-1.5 rounded-md bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 font-bold truncate border border-gray-200 dark:border-gray-700" title={task.title}>
                        {task.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
