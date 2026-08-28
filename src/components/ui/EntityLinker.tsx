import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, BookOpen, StickyNote, CheckSquare, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';

interface EntityLinkerProps {
  selectedSubjectIds?: string[];
  onChangeSubjects?: (ids: string[]) => void;
  selectedNoteIds?: string[];
  onChangeNotes?: (ids: string[]) => void;
  selectedTaskIds?: string[];
  onChangeTasks?: (ids: string[]) => void;
  selectedFileIds?: string[];
  onChangeFiles?: (ids: string[]) => void;
}

export function EntityLinker({
  selectedSubjectIds = [], onChangeSubjects,
  selectedNoteIds = [], onChangeNotes,
  selectedTaskIds = [], onChangeTasks,
  selectedFileIds = [], onChangeFiles
}: EntityLinkerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  
  const { subjects, notes, tasks, files } = useAppStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const driveFiles = files.filter(f => f.type === 'file');

  const getSelectedItems = () => {
    const items: React.ReactNode[] = [];
    
    selectedSubjectIds.forEach(id => {
      const s = subjects.find(x => x.id === id);
      if (s) items.push(
        <span key={`sub-${id}`} className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1 font-medium">
          <BookOpen size={12} /> {s.name}
          {onChangeSubjects && <button onClick={(e) => { e.stopPropagation(); onChangeSubjects(selectedSubjectIds.filter(x => x !== id)); }} className="hover:text-rose-500"><X size={12} /></button>}
        </span>
      );
    });
    
    selectedNoteIds.forEach(id => {
      const n = notes.find(x => x.id === id);
      if (n) items.push(
        <span key={`not-${id}`} className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1 font-medium">
          <StickyNote size={12} /> {n.title}
          {onChangeNotes && <button onClick={(e) => { e.stopPropagation(); onChangeNotes(selectedNoteIds.filter(x => x !== id)); }} className="hover:text-rose-500"><X size={12} /></button>}
        </span>
      );
    });

    selectedTaskIds.forEach(id => {
      const tsk = tasks.find(x => x.id === id);
      if (tsk) items.push(
        <span key={`tsk-${id}`} className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1 font-medium">
          <CheckSquare size={12} /> {tsk.title}
          {onChangeTasks && <button onClick={(e) => { e.stopPropagation(); onChangeTasks(selectedTaskIds.filter(x => x !== id)); }} className="hover:text-rose-500"><X size={12} /></button>}
        </span>
      );
    });

    selectedFileIds.forEach(id => {
      const f = driveFiles.find(x => x.id === id);
      if (f) items.push(
        <span key={`fil-${id}`} className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1 font-medium">
          <FileText size={12} /> {f.name}
          {onChangeFiles && <button onClick={(e) => { e.stopPropagation(); onChangeFiles(selectedFileIds.filter(x => x !== id)); }} className="hover:text-rose-500"><X size={12} /></button>}
        </span>
      );
    });

    return items;
  };

  const toggleSubject = (id: string) => {
    if (!onChangeSubjects) return;
    if (selectedSubjectIds.includes(id)) onChangeSubjects(selectedSubjectIds.filter(x => x !== id));
    else onChangeSubjects([...selectedSubjectIds, id]);
  };

  const toggleNote = (id: string) => {
    if (!onChangeNotes) return;
    if (selectedNoteIds.includes(id)) onChangeNotes(selectedNoteIds.filter(x => x !== id));
    else onChangeNotes([...selectedNoteIds, id]);
  };

  const toggleTask = (id: string) => {
    if (!onChangeTasks) return;
    if (selectedTaskIds.includes(id)) onChangeTasks(selectedTaskIds.filter(x => x !== id));
    else onChangeTasks([...selectedTaskIds, id]);
  };

  const toggleFile = (id: string) => {
    if (!onChangeFiles) return;
    if (selectedFileIds.includes(id)) onChangeFiles(selectedFileIds.filter(x => x !== id));
    else onChangeFiles([...selectedFileIds, id]);
  };

  const selectedItems = getSelectedItems();

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 flex flex-wrap gap-2 items-center min-h-[42px] cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500 transition-shadow"
      >
        {selectedItems.length === 0 ? (
          <span className="text-zinc-500 text-sm flex-1">{isAr ? 'اختر العناصر للربط (مواد، ملاحظات، مهام، ملفات)' : 'Select items to link (Subjects, Notes, Tasks, Files)'}</span>
        ) : (
          <div className="flex flex-wrap gap-2 flex-1">
            {selectedItems}
          </div>
        )}
        <ChevronDown size={16} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
          
          {onChangeSubjects && subjects.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-bold text-zinc-400 mb-1 px-2 uppercase tracking-wider">{isAr ? 'المواد' : 'Subjects'}</div>
              {subjects.map(s => (
                <div key={s.id} onClick={() => toggleSubject(s.id)} className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-lg text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center gap-2"><BookOpen size={14} className="text-indigo-500" /> {s.name}</div>
                  {selectedSubjectIds.includes(s.id) && <Check size={16} className="text-indigo-600" />}
                </div>
              ))}
            </div>
          )}

          {onChangeNotes && notes.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-bold text-zinc-400 mb-1 px-2 uppercase tracking-wider">{isAr ? 'الملاحظات' : 'Notes'}</div>
              {notes.map(n => (
                <div key={n.id} onClick={() => toggleNote(n.id)} className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-lg text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center gap-2"><StickyNote size={14} className="text-amber-500" /> {n.title}</div>
                  {selectedNoteIds.includes(n.id) && <Check size={16} className="text-amber-600" />}
                </div>
              ))}
            </div>
          )}

          {onChangeTasks && tasks.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-bold text-zinc-400 mb-1 px-2 uppercase tracking-wider">{isAr ? 'المهام' : 'Tasks'}</div>
              {tasks.map(t => (
                <div key={t.id} onClick={() => toggleTask(t.id)} className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-lg text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center gap-2"><CheckSquare size={14} className="text-emerald-500" /> {t.title}</div>
                  {selectedTaskIds.includes(t.id) && <Check size={16} className="text-emerald-600" />}
                </div>
              ))}
            </div>
          )}

          {onChangeFiles && driveFiles.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-bold text-zinc-400 mb-1 px-2 uppercase tracking-wider">{isAr ? 'ملفات الدرايف' : 'Drive Files'}</div>
              {driveFiles.map(f => (
                <div key={f.id} onClick={() => toggleFile(f.id)} className="px-3 py-2 flex items-center justify-between cursor-pointer rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center gap-2"><FileText size={14} className="text-blue-500" /> {f.name}</div>
                  {selectedFileIds.includes(f.id) && <Check size={16} className="text-blue-600" />}
                </div>
              ))}
            </div>
          )}

          {!(onChangeSubjects && subjects.length > 0) && !(onChangeNotes && notes.length > 0) && !(onChangeTasks && tasks.length > 0) && !(onChangeFiles && driveFiles.length > 0) && (
             <div className="p-4 text-center text-sm text-zinc-500">{isAr ? 'لا توجد عناصر متاحة للربط' : 'No items available to link'}</div>
          )}
        </div>
      )}
    </div>
  );
}
