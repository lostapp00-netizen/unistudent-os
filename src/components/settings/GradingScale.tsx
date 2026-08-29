import React from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2 } from 'lucide-react';
import { GradeRule } from '../../types';
import { GradingScaleRow } from './GradingScaleRow';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  scale: GradeRule[];
  onChange: (newScale: GradeRule[]) => void;
}

export function GradingScale({ scale, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const { settings } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';

  const addGrade = () => {
    onChange([...scale, { 
      id: uuidv4(), 
      letter: 'A', 
      nameAr: 'ممتاز', 
      nameEn: 'Excellent', 
      minPercentage: 90, 
      maxPercentage: 97,
      maxOperator: '<',
      points: 4.0 
    }]);
  };

  const updateGrade = (id: string, updates: Partial<GradeRule>) => {
    onChange(scale.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const removeGrade = (id: string) => {
    onChange(scale.filter(g => g.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold">{t('grading_scale')}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isAr 
              ? 'يمكنك تحديد ما إذا كان الحد الأقصى شاملاً (إلى <=) أو غير شامل (إلى أقل من <) لكل تقدير' 
              : 'Specify whether the upper bound is inclusive (<=) or exclusive (<) for each grade'}
          </p>
        </div>
        <button 
          onClick={addGrade}
          className="flex items-center gap-2 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 px-3 py-1.5 rounded-xl transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          {t('add_grade')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left rtl:text-right whitespace-nowrap">
          <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
            <tr>
              <th className="pb-3 px-2 font-medium">{t('grade_letter')}</th>
              <th className="pb-3 px-2 font-medium">{t('grade_name_ar')}</th>
              <th className="pb-3 px-2 font-medium">{t('grade_name_en')}</th>
              <th className="pb-3 px-2 font-medium">{t('min')} (%)</th>
              <th className="pb-3 px-2 font-medium">{isAr ? 'الحد الأقصى (النوع والقيمة)' : 'Upper Bound (Type & %)'}</th>
              <th className="pb-3 px-2 font-medium">{t('points')}</th>
              <th className="pb-3 px-2 font-medium text-center">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {scale.map((grade) => (
              <GradingScaleRow 
                key={grade.id} 
                grade={grade} 
                onUpdate={updateGrade} 
                onDelete={removeGrade} 
              />
            ))}
            {scale.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-6 text-zinc-400">
                  {isAr ? 'لا توجد تقديرات مضافة.' : 'No grading scale added.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
