import React, { useState } from 'react';
import { Edit2, Save, Trash2, X } from 'lucide-react';
import { GradeDistributionItem } from '../../types';

interface Props {
  distribution: GradeDistributionItem;
  isSubjectFinished: boolean;
  remainingMarks: number;
  onUpdate: (id: string, name: string, maxMarks: number) => void;
  onDelete: (id: string) => void;
  isRtl: boolean;
}

export function DistributionDefinitionRow({ distribution, isSubjectFinished, remainingMarks, onUpdate, onDelete, isRtl }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(distribution.name);
  const [tempMarks, setTempMarks] = useState<number | ''>(distribution.maxMarks);

  const handleSave = () => {
    if (!tempName.trim() || tempMarks === '' || tempMarks <= 0) return;
    
    // Check if new marks exceed remaining possible marks (considering we are returning our own old maxMarks to the pool)
    const extraNeeded = Number(tempMarks) - distribution.maxMarks;
    if (extraNeeded > remainingMarks) {
      alert(isRtl ? `الدرجات المتبقية المتاحة هي ${remainingMarks + distribution.maxMarks} فقط.` : `Only ${remainingMarks + distribution.maxMarks} marks available.`);
      return;
    }

    onUpdate(distribution.id, tempName, Number(tempMarks));
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempName(distribution.name);
    setTempMarks(distribution.maxMarks);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl">
        <div className="flex-1 flex gap-2">
          <input 
            type="text" 
            value={tempName}
            onChange={e => setTempName(e.target.value)}
            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={isRtl ? 'اسم التقييم...' : 'Name...'}
          />
          <input 
            type="number" 
            value={tempMarks}
            onChange={e => setTempMarks(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-24 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-center font-bold"
            placeholder={isRtl ? 'الدرجة' : 'Marks'}
          />
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button 
            onClick={handleSave}
            className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1 text-sm font-bold shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span className="sm:hidden">{isRtl ? 'حفظ' : 'Save'}</span>
          </button>
          <button 
            onClick={handleCancel}
            className="flex-1 sm:flex-none px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1 text-sm font-bold"
          >
            <X className="w-4 h-4" />
            <span className="sm:hidden">{isRtl ? 'إلغاء' : 'Cancel'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl">
      <div className="font-medium text-zinc-700 dark:text-zinc-200">{distribution.name}</div>
      <div className="flex items-center gap-3">
        <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-lg">
          {distribution.maxMarks} {isRtl ? 'درجة' : 'Marks'}
        </div>
        {!isSubjectFinished && (
          <div className="flex items-center gap-1.5 border-r rtl:border-l rtl:border-r-0 border-zinc-200 dark:border-zinc-700 pr-3 rtl:pl-3 rtl:pr-0 mr-1 rtl:ml-1 rtl:mr-0">
            <button 
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all shadow-xs"
              title={isRtl ? 'تعديل' : 'Edit'}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(distribution.id)}
              className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-xs"
              title={isRtl ? 'حذف' : 'Delete'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
