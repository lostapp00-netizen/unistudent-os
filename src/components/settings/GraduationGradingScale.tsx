import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2, Save, X, Award } from 'lucide-react';
import { GraduationGradeRule } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  scale: GraduationGradeRule[];
  onChange: (newScale: GraduationGradeRule[]) => void;
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
}

export function GraduationGradingScale({ scale, onChange, enabled, onToggleEnabled }: Props) {
  const { i18n } = useTranslation();
  const { settings } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';

  const addGrade = () => {
    onChange([
      ...scale,
      {
        id: uuidv4(),
        letter: 'A',
        nameAr: 'ممتاز',
        nameEn: 'Excellent',
        minPercentage: 85,
        maxPercentage: 100,
        maxOperator: '<=',
        minGpa: 3.5,
        maxGpa: 4.0,
        gpaOperator: '<='
      }
    ]);
  };

  const updateGrade = (id: string, updates: Partial<GraduationGradeRule>) => {
    onChange(scale.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const removeGrade = (id: string) => {
    onChange(scale.filter(g => g.id !== id));
  };

  return (
    <div className="space-y-5 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
      {/* Header & Toggle Switch */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              {isAr ? 'سلم تقديرات التخرج التراكمي (اختياري)' : 'Graduation Honors & Grading Scale (Optional)'}
            </h2>
          </div>
          <p className="text-xs text-zinc-500 max-w-xl">
            {isAr
              ? 'مخطط تقديرات عام للتخرج لحساب مرتبة الشرف والتقدير النهائي عند انتهاء السنوات الدراسية (مثل سنة رابعة ترم ثانٍ). يتم حسابه بناءً على التراكمي CGPA أو النسبة المئوية العامة.'
              : 'Cumulative graduation grading scale to compute honors and final grade upon graduation (e.g. final semester).'}
          </p>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/80 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            {enabled ? (isAr ? 'مفعل' : 'Enabled') : (isAr ? 'معطل' : 'Disabled')}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onToggleEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Content if Enabled */}
      {enabled && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-zinc-500">
              {isAr
                ? 'قم بإعداد درجات التخرج، الرموز، ونطاقات المعدل التراكمي والنسب المئوية:'
                : 'Configure graduation honors, letters, CGPA and percentage ranges:'}
            </span>
            <button
              onClick={addGrade}
              className="flex items-center gap-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 px-3 py-1.5 rounded-xl transition-colors font-bold border border-purple-200 dark:border-purple-800/50 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إضافة تقدير تخرج' : 'Add Graduation Grade'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left rtl:text-right whitespace-nowrap">
              <thead className="text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 text-xs">
                <tr>
                  <th className="pb-3 px-2 font-bold">{isAr ? 'الرمز' : 'Letter'}</th>
                  <th className="pb-3 px-2 font-bold">{isAr ? 'اسم التقدير بالعربي' : 'Name (Ar)'}</th>
                  <th className="pb-3 px-2 font-bold">{isAr ? 'اسم التقدير بالإنجليزي' : 'Name (En)'}</th>
                  <th className="pb-3 px-2 font-bold">{isAr ? 'النسبة المئوية (%)' : 'Percentage (%)'}</th>
                  <th className="pb-3 px-2 font-bold">{isAr ? 'المعدل التراكمي CGPA' : 'CGPA Range'}</th>
                  <th className="pb-3 px-2 font-bold text-center">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {scale.map((rule) => (
                  <GraduationScaleRow
                    key={rule.id}
                    rule={rule}
                    onUpdate={updateGrade}
                    onDelete={removeGrade}
                  />
                ))}
                {scale.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-zinc-400 text-xs">
                      {isAr ? 'لا توجد تقديرات تخرج مضافة. اضغط على زر الإضافة أعلاه.' : 'No graduation grades added.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function GraduationScaleRow({
  rule,
  onUpdate,
  onDelete
}: {
  rule: GraduationGradeRule;
  onUpdate: (id: string, updates: Partial<GraduationGradeRule>) => void;
  onDelete: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempData, setTempData] = useState({ ...rule });

  const handleSave = () => {
    onUpdate(rule.id, tempData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempData({ ...rule });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr className="bg-purple-50/50 dark:bg-purple-900/10 transition-colors">
        <td className="py-2 px-1">
          <input
            type="text"
            value={tempData.letter}
            onChange={(e) => setTempData({ ...tempData, letter: e.target.value })}
            className="w-14 px-2 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none font-bold text-purple-600"
          />
        </td>
        <td className="py-2 px-1">
          <input
            type="text"
            value={tempData.nameAr}
            onChange={(e) => setTempData({ ...tempData, nameAr: e.target.value })}
            className="w-full min-w-[120px] px-2 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none"
          />
        </td>
        <td className="py-2 px-1">
          <input
            type="text"
            value={tempData.nameEn}
            onChange={(e) => setTempData({ ...tempData, nameEn: e.target.value })}
            className="w-full min-w-[120px] px-2 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none"
          />
        </td>
        <td className="py-2 px-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={tempData.minPercentage}
              onChange={(e) => setTempData({ ...tempData, minPercentage: Number(e.target.value) })}
              className="w-12 px-1.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none"
              placeholder="من"
            />
            <select
              value={tempData.maxOperator || (tempData.maxPercentage >= 100 ? '<=' : '<')}
              onChange={(e) => setTempData({ ...tempData, maxOperator: e.target.value as '<' | '<=' })}
              className="text-[11px] px-1 py-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none font-bold text-purple-600"
            >
              <option value="<=">≤</option>
              <option value="<">&lt;</option>
            </select>
            <input
              type="number"
              value={tempData.maxPercentage}
              onChange={(e) => setTempData({ ...tempData, maxPercentage: Number(e.target.value) })}
              className="w-12 px-1.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none"
              placeholder="إلى"
            />
          </div>
        </td>
        <td className="py-2 px-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              value={tempData.minGpa !== undefined ? tempData.minGpa : 0}
              onChange={(e) => setTempData({ ...tempData, minGpa: Number(e.target.value) })}
              className="w-14 px-1.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none font-bold"
              placeholder="Min GPA"
            />
            <select
              value={tempData.gpaOperator || (tempData.maxGpa && tempData.maxGpa >= 4 ? '<=' : '<')}
              onChange={(e) => setTempData({ ...tempData, gpaOperator: e.target.value as '<' | '<=' })}
              className="text-[11px] px-1 py-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none font-bold text-purple-600"
            >
              <option value="<=">≤</option>
              <option value="<">&lt;</option>
            </select>
            <input
              type="number"
              step="0.01"
              value={tempData.maxGpa !== undefined ? tempData.maxGpa : 4.0}
              onChange={(e) => setTempData({ ...tempData, maxGpa: Number(e.target.value) })}
              className="w-14 px-1.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none font-bold"
              placeholder="Max GPA"
            />
          </div>
        </td>
        <td className="py-2 px-2">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={handleSave}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
            >
              <Save size={15} />
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const isInclusive = rule.maxOperator ? rule.maxOperator === '<=' : rule.maxPercentage >= 100;
  const isGpaInclusive = rule.gpaOperator ? rule.gpaOperator === '<=' : (rule.maxGpa ? rule.maxGpa >= 4.0 : true);

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="py-2.5 px-3 font-bold text-purple-600 dark:text-purple-400">{rule.letter}</td>
      <td className="py-2.5 px-3 font-semibold text-zinc-800 dark:text-zinc-200">{rule.nameAr}</td>
      <td className="py-2.5 px-3 text-zinc-500 dark:text-zinc-400">{rule.nameEn}</td>
      <td className="py-2.5 px-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
          <span>{rule.minPercentage}%</span>
          <span>{isInclusive ? 'إلى (≤)' : 'إلى أقل من (<)'}</span>
          <span>{rule.maxPercentage}%</span>
        </span>
      </td>
      <td className="py-2.5 px-3">
        {rule.minGpa !== undefined && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
            <span>{rule.minGpa.toFixed(2)}</span>
            <span>{isGpaInclusive ? 'إلى (≤)' : 'إلى أقل من (<)'}</span>
            <span>{rule.maxGpa?.toFixed(2) || '4.00'}</span>
          </span>
        )}
      </td>
      <td className="py-2.5 px-2">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 rounded-xl transition-all shadow-2xs"
            title="تعديل"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-2xs"
            title="حذف"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}
