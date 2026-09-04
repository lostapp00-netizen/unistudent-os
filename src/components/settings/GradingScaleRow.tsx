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
    if (
      tempData.minPercentage === ('' as any) ||
      tempData.maxPercentage === ('' as any) ||
      tempData.points === ('' as any) ||
      isNaN(Number(tempData.minPercentage)) ||
      isNaN(Number(tempData.maxPercentage)) ||
      isNaN(Number(tempData.points))
    ) {
      alert('يرجى إدخال جميع النسب والنقاط بالأرقام بشكل صحيح (لا يمكن ترك الخانة فارغة).');
      return;
    }
    if (Number(tempData.minPercentage) < 0 || Number(tempData.maxPercentage) > 100 || Number(tempData.minPercentage) > Number(tempData.maxPercentage)) {
      alert('يرجى التأكد من صحة النسب المئوية (الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى).');
      return;
    }
    onUpdate(grade.id, {
      ...tempData,
      minPercentage: Number(tempData.minPercentage),
      maxPercentage: Number(tempData.maxPercentage),
      points: Number(tempData.points)
    });
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
            value={tempData.minPercentage === ('' as any) ? '' : tempData.minPercentage}
            onChange={(e) => setTempData({...tempData, minPercentage: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
            className="w-16 px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-zinc-800 outline-none"
          />
        </td>
        <td className="py-2 px-1">
          <div className="flex items-center gap-1.5">
            <select
              value={tempData.maxOperator || (Number(tempData.maxPercentage) >= 100 ? '<=' : '<')}
              onChange={(e) => setTempData({...tempData, maxOperator: e.target.value as '<' | '<='})}
              className="text-xs px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 font-bold text-indigo-600 dark:text-indigo-400 focus:ring-1 focus:ring-indigo-500 outline-none"
              title="نوع الحد الأقصى"
            >
              <option value="<=">إلى (≤)</option>
              <option value="<">إلى أقل من (&lt;)</option>
            </select>
            <input 
              type="number" 
              value={tempData.maxPercentage === ('' as any) ? '' : tempData.maxPercentage}
              onChange={(e) => setTempData({...tempData, maxPercentage: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
              className="w-16 px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-zinc-800 outline-none"
            />
          </div>
        </td>
        <td className="py-2 px-1">
          <input 
            type="number" 
            step="0.05"
            value={tempData.points === ('' as any) ? '' : tempData.points}
            onChange={(e) => setTempData({...tempData, points: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
            className="w-16 px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-zinc-800 outline-none"
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

  const isInclusive = grade.maxOperator ? grade.maxOperator === '<=' : grade.maxPercentage >= 100;

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="py-2 px-3 font-bold">{grade.letter}</td>
      <td className="py-2 px-3">{grade.nameAr}</td>
      <td className="py-2 px-3">{grade.nameEn}</td>
      <td className="py-2 px-3">{grade.minPercentage}%</td>
      <td className="py-2 px-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
          isInclusive 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40' 
            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
        }`}>
          <span>{isInclusive ? 'إلى (≤)' : 'إلى أقل من (<)'}</span>
          <span className="font-black">{grade.maxPercentage}%</span>
        </span>
      </td>
      <td className="py-2 px-3 font-bold">{grade.points.toFixed(2)}</td>
      <td className="py-2 px-2">
        <div className="flex items-center justify-center gap-1.5">
          <button 
            onClick={() => setIsEditing(true)}
            className="p-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all shadow-xs"
            title="تعديل"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={() => onDelete(grade.id)}
            className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-xs"
            title="حذف"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
