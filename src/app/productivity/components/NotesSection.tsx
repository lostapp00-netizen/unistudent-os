"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Paperclip, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useLang } from "@/lib/useLanguage";
import { Modal } from "@/components/Modal";

export default function NotesSection() {
  const { user } = useUser();
  const { lang } = useLang();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState("عادي");

  useEffect(() => {
    if (user) fetchNotes();
  }, [user]);

  const fetchNotes = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (data) setNotes(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('notes').insert({
        user_id: user.id,
        title,
        content,
        importance_level: importance
      }).select().single();
      
      if (error) throw error;
      setNotes([data, ...notes]);
      setIsModalOpen(false);

      // Reset
      setTitle("");
      setContent("");
      setImportance("عادي");
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ الملاحظة.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteNote = async (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
    await supabase.from('notes').delete().eq('id', id);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>;

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{lang === 'ar' ? 'الملاحظات' : 'Notes'}</h2>
          <p className="text-gray-500 text-sm mt-1">{lang === 'ar' ? 'سجل أفكارك ومعلوماتك بسرعة' : 'Quickly record your thoughts'}</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-black hover:bg-gray-800 text-white dark:bg-white dark:text-black dark:hover:bg-gray-200">
          <Plus className="w-5 h-5 ml-2" />
          {lang === 'ar' ? 'ملاحظة جديدة' : 'New Note'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 pb-4 custom-scrollbar">
        {notes.map(note => (
          <Card key={note.id} className="p-6 flex flex-col h-56 hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden group bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800">
            <div className={`absolute top-0 right-0 w-1.5 h-full ${note.importance_level === 'عالي' ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'}`} />
            
            <div className="flex justify-between items-start mb-3 pl-2">
              <h3 className="font-bold text-lg w-full truncate pr-2 text-gray-900 dark:text-white">{note.title}</h3>
              {note.importance_level === 'عالي' && <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />}
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 line-clamp-4 leading-relaxed whitespace-pre-wrap pr-2">
              {note.content || (lang === 'ar' ? "ملاحظة فارغة..." : "Empty note...")}
            </p>
            
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs font-medium text-gray-500 pr-2">
              <span className="bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded-md">{new Date(note.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => deleteNote(note.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1 bg-gray-50 dark:bg-gray-900 rounded-md">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
        {notes.length === 0 && <div className="col-span-3 text-center text-gray-500 py-10">{lang === 'ar' ? 'لا يوجد ملاحظات مضافة.' : 'No notes added.'}</div>}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={lang === 'ar' ? 'إضافة ملاحظة جديدة' : 'Add New Note'}
      >
        <form onSubmit={addNote} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{lang === 'ar' ? 'عنوان الملاحظة' : 'Note Title'}</label>
            <Input 
              required 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder={lang === 'ar' ? 'مثال: أفكار مشروع التخرج' : 'e.g. Graduation Project Ideas'} 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{lang === 'ar' ? 'محتوى الملاحظة' : 'Note Content'}</label>
            <textarea 
              className="w-full min-h-[150px] p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-2 focus:ring-black dark:focus:ring-white outline-none resize-none text-sm"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={lang === 'ar' ? 'اكتب ملاحظتك هنا...' : 'Write your note here...'}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{lang === 'ar' ? 'الأهمية' : 'Importance'}</label>
            <select 
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-2 focus:ring-black dark:focus:ring-white outline-none text-sm"
              value={importance}
              onChange={e => setImportance(e.target.value)}
            >
              <option value="عادي">{lang === 'ar' ? 'عادي' : 'Normal'}</option>
              <option value="عالي">{lang === 'ar' ? 'عالي' : 'High'}</option>
            </select>
          </div>
          
          <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 font-bold rounded-xl mt-4">
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (lang === 'ar' ? 'حفظ الملاحظة' : 'Save Note')}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
