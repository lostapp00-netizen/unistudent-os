import React, { useState } from 'react';
import { GradeRule } from '../../types';
import { Edit2, Save, Trash2, X } from 'lucide-react';

interface Props {
  grade: GradeRule;
  onUpdate: (id: string, updates: Partial<GradeRule>) => void;
  onDelete: (id: string) => void;
}

export function GradingScaleRow({ grade, onUpdate, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempData, setTempData] = useState({ ...grade });

  const handleSave = () => {
    onUpdate(grade.id, tempData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempData({ ...grade });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr className="bg-indigo-50/50 dark:bg-indigo-900/10 transition-colors">
        <td className="py-2 px-1">
          <input 
            type="text" 
            value={tempData.letter}
            onChange={(e) => setTempData({...tempData, letter: e.target.value})}
            className="w-16 px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-zinc-800 outline-none font-bold"
          />
        </td>
        <td className="py-2 px-1">
          <input 
            type="text" 
            value={tempData.nameAr}
            onChange={(e) => setTempData({...tempData, nameAr: e.target.value})}
            className="w-full min-w-[100px] px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-zinc-800 outline-none"
          />
        </td>
        <td className="py-2 px-1">
          <input 
            type="text" 
            value={tempData.nameEn}
            onChange={(e) => setTempData({...tempData, nameEn: e.target.value})}
            className="w-full min-w-[100px] px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-zinc-800 outline-none"
          />
        </td>
        <td className="py-2 px-1">
          <input 
            type="number" 
            value={tempData.minPercentage}
            onChange={(e) => setTempData({...tempData, minPercentage: Number(e.target.value)})}
            className="w-20 px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-zinc-800 outline-none"
          />
        </td>
        <td className="py-2 px-1">
          <input 
            type="number" 
            value={tempData.maxPercentage}
            onChange={(e) => setTempData({...tempData, maxPercentage: Number(e.target.value)})}
            className="w-20 px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-zinc-800 outline-none"
          />
        </td>
        <td className="py-2 px-1">
          <input 
            type="number" 
            step="0.1"
            value={tempData.points}
            onChange={(e) => setTempData({...tempData, points: Number(e.target.value)})}
            className="w-20 px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-zinc-800 outline-none"
          />
        </td>
        <td className="py-2 px-2">
          <div className="flex items-center justify-center gap-1">
            <button 
              onClick={handleSave}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
            >
              <Save size={16} />
            </button>
            <button 
              onClick={handleCancel}
              className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="py-2 px-3 font-bold">{grade.letter}</td>
      <td className="py-2 px-3">{grade.nameAr}</td>
      <td className="py-2 px-3">{grade.nameEn}</td>
      <td className="py-2 px-3">{grade.minPercentage}</td>
      <td className="py-2 px-3">{grade.maxPercentage}</td>
      <td className="py-2 px-3">{grade.points.toFixed(2)}</td>
      <td className="py-2 px-2">
        <div className="flex items-center justify-center gap-1.5">
          <button 
            onClick={() => setIsEditing(true)}
            className="p-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all shadow-xs"
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={() => onDelete(grade.id)}
            className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-xs"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
