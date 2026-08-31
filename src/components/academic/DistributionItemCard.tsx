import React, { useState } from 'react';
import { Edit2, Save, Trash2, CheckCircle, Lock } from 'lucide-react';
import { GradeDistributionItem } from '../../types';

interface Props {
  distribution: GradeDistributionItem;
  isSubjectFinished: boolean;
  onUpdate: (id: string, updates: Partial<GradeDistributionItem>) => void;
  onDelete?: (id: string) => void;
  isRtl: boolean;
}

export function DistributionItemCard({ distribution, isSubjectFinished, onUpdate, onDelete, isRtl }: Props) {
  const [isEditing, setIsEditing] = useState(
    distribution.achievedMarks === null || distribution.achievedMarks === undefined
  );
  
  const [tempMarks, setTempMarks] = useState<string>(
    distribution.achievedMarks !== null && distribution.achievedMarks !== undefined ? String(distribution.achievedMarks) : ''
  );

  // If subject is finished globally, lock everything
  const isLocked = isSubjectFinished || (distribution.status === 'final' && !isEditing);

  const handleSave = (status: 'current' | 'final') => {
    if (tempMarks.trim() === '') {
      onUpdate(distribution.id, {
        achievedMarks: null,
        status
      });
      setIsEditing(false);
      return;
    }

    const parsed = Number(tempMarks);
    if (isNaN(parsed) || parsed < 0 || parsed > distribution.maxMarks) {
      alert(isRtl ? `يرجى إدخال درجة صحيحة بين 0 و ${distribution.maxMarks}` : `Please enter a valid grade between 0 and ${distribution.maxMarks}`);
      return;
    }
    
    onUpdate(distribution.id, {
      achievedMarks: parsed,
      status
    });
    setIsEditing(false);
  };

  return (
    <div className={`p-4 rounded-2xl border transition-all ${isEditing ? 'bg-indigo-50/10 dark:bg-indigo-900/10 border-indigo-200/30 dark:border-indigo-800' : 'bg-white/5 border-white/10'}`}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-zinc-300 flex items-center gap-2">
            {distribution.status === 'final' && !isEditing && <Lock className="w-3 h-3 text-emerald-400" />}
            {distribution.name}
          </span>
          <span className="text-xs text-zinc-500 font-medium">من {distribution.maxMarks}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <input 
            type="number" 
            min="0"
            max={distribution.maxMarks}
            disabled={!isEditing || isSubjectFinished}
            value={tempMarks}
            onChange={e => setTempMarks(e.target.value)}
            placeholder={isRtl ? "الدرجة..." : "Marks..."}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-indigo-500 disabled:opacity-60 disabled:bg-zinc-800/50 text-white"
          />
          
          {isEditing && !isSubjectFinished && (
            <div className="flex gap-2">
              <button
                onClick={() => handleSave('current')}
                title={isRtl ? 'حفظ حالي (قابل للتعديل)' : 'Save as Current'}
                className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 p-2 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">{isRtl ? 'حالي' : 'Current'}</span>
              </button>
              <button
                onClick={() => handleSave('final')}
                title={isRtl ? 'حفظ نهائي (مغلق)' : 'Save as Final'}
                className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 p-2 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{isRtl ? 'نهائي' : 'Final'}</span>
              </button>
            </div>
          )}

          {!isEditing && !isSubjectFinished && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30 p-2 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
              title={isRtl ? 'تعديل الدرجة' : 'Edit Marks'}
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
