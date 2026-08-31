import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, RotateCcw, X, Check, Calendar } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export interface UnifiedSemesterFilterProps {
  filterYears: number[];
  filterSemesters: number[];
  setFilterYears: React.Dispatch<React.SetStateAction<number[]>>;
  setFilterSemesters: React.Dispatch<React.SetStateAction<number[]>>;
  className?: string;
  showResetToCurrent?: boolean;
  align?: 'start' | 'center' | 'end';
}

/**
 * Returns formatted localized label for the active year and semester filter
 */
export function getUnifiedFilterLabel(
  filterYears: number[],
  filterSemesters: number[],
  isAr: boolean
): string {
  if (filterYears.length === 1 && filterSemesters.length === 1) {
    return `${isAr ? 'السنة' : 'Year'} ${filterYears[0]} • ${isAr ? 'الفصل' : 'Semester'} ${filterSemesters[0]}`;
  }
  if (filterYears.length === 0 && filterSemesters.length === 0) {
    return isAr ? 'جميع السنوات والفصول' : 'All Years & Terms';
  }
  if (filterYears.length === 1 && filterSemesters.length === 0) {
    return `${isAr ? 'السنة' : 'Year'} ${filterYears[0]} (${isAr ? 'كل الفصول' : 'All Terms'})`;
  }
  if (filterYears.length === 0 && filterSemesters.length === 1) {
    return `${isAr ? 'الفصل' : 'Semester'} ${filterSemesters[0]} (${isAr ? 'كل السنوات' : 'All Years'})`;
  }
  return isAr ? `فصول متعددة (${filterYears.length + filterSemesters.length})` : `Multiple Terms (${filterYears.length + filterSemesters.length})`;
}

/**
 * Unified Badge displaying the active filter label consistently across all pages
 */
export function UnifiedFilterBadge({
  filterYears,
  filterSemesters,
  onClick,
  className = ''
}: {
  filterYears: number[];
  filterSemesters: number[];
  onClick?: () => void;
  className?: string;
}) {
  const { settings } = useAppStore();
  const isAr = settings.language === 'ar';
  const label = getUnifiedFilterLabel(filterYears, filterSemesters, isAr);
  const isFiltered = filterYears.length > 0 || filterSemesters.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-bold text-xs px-3 py-1.5 rounded-xl border transition-all ${
        isFiltered
          ? 'bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70 shadow-2xs'
          : 'bg-zinc-100/80 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60'
      } ${onClick ? 'cursor-pointer hover:opacity-90 active:scale-98' : 'cursor-default'} ${className}`}
    >
      <Calendar size={13} className={isFiltered ? 'text-indigo-600 dark:text-indigo-400 shrink-0' : 'text-zinc-400 shrink-0'} />
      <span>{label}</span>
    </button>
  );
}

/**
 * Unified Year & Semester Filter Dropdown/Modal with consistent UI across all pages
 */
export function UnifiedSemesterFilter({
  filterYears,
  filterSemesters,
  setFilterYears,
  setFilterSemesters,
  className = '',
  showResetToCurrent = true,
}: UnifiedSemesterFilterProps) {
  const { t } = useTranslation();
  const { settings } = useAppStore();
  const isAr = settings.language === 'ar';

  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleYear = (y: number) => {
    setFilterYears(prev => prev.includes(y) ? prev.filter(yr => yr !== y) : [...prev, y]);
  };

  const toggleSemester = (s: number) => {
    setFilterSemesters(prev => prev.includes(s) ? prev.filter(sem => sem !== s) : [...prev, s]);
  };

  const resetToCurrentSemester = () => {
    if (currentSemester) {
      setFilterYears([currentSemester.yearIndex]);
      setFilterSemesters([currentSemester.semesterIndex]);
    } else {
      setFilterYears([]);
      setFilterSemesters([]);
    }
  };

  const clearAll = () => {
    setFilterYears([]);
    setFilterSemesters([]);
  };

  const totalSelections = filterYears.length + filterSemesters.length;
  const hasActiveFilter = totalSelections > 0;
  const isDifferentFromCurrent = currentSemester && (
    filterYears.length !== 1 || 
    filterYears[0] !== currentSemester.yearIndex || 
    filterSemesters.length !== 1 || 
    filterSemesters[0] !== currentSemester.semesterIndex
  );

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Trigger Filter Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all border shadow-xs cursor-pointer select-none ${
          hasActiveFilter
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 ring-2 ring-indigo-500/20'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
        }`}
      >
        <Filter size={15} className={hasActiveFilter ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'} />
        <span>{t('filter')}</span>
        {hasActiveFilter && (
          <span className="flex items-center justify-center bg-indigo-600 text-white min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black mr-0.5 rtl:mr-0 rtl:ml-0.5">
            {totalSelections}
          </span>
        )}
      </button>

      {/* Quick Reset to Current Term Button */}
      {showResetToCurrent && isDifferentFromCurrent && (
        <button
          type="button"
          onClick={resetToCurrentSemester}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border border-zinc-200/60 dark:border-zinc-700/60"
          title={isAr ? 'الرجوع للفصل الدراسي الحالي' : 'Reset to Current Semester'}
        >
          <RotateCcw size={12} className="text-indigo-500 shrink-0" />
          <span className="whitespace-nowrap">{isAr ? 'الفصل الحالي' : 'Current Term'}</span>
        </button>
      )}

      {/* Filter Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            ref={popoverRef}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 select-none"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3.5 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Filter size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white leading-tight">
                    {isAr ? 'تصفية حسب السنة والفصل' : 'Filter by Year & Term'}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {isAr ? 'اختر السنوات أو الفصول المراد عرض بياناتها' : 'Select academic years or terms to display'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {isAr ? 'مسح الفلتر' : 'Clear All'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Filter Content */}
            <div className="space-y-4">
              {/* Year Filter Section */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">
                    {t('year')} ({settings.totalYears || 4} {isAr ? 'سنوات' : 'years'})
                  </h4>
                  {filterYears.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterYears([])}
                      className="text-[11px] text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold"
                    >
                      {isAr ? 'الكل' : 'All'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: settings.totalYears || 4 }).map((_, i) => {
                    const yearNum = i + 1;
                    const isSelected = filterYears.includes(yearNum);
                    return (
                      <label
                        key={yearNum}
                        className={`flex items-center justify-between text-sm cursor-pointer p-3 rounded-2xl border transition-all ${
                          isSelected
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-bold shadow-2xs'
                            : 'bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200/70 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <span className="text-xs font-bold">{t('year')} {yearNum}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleYear(yearNum)}
                          className="rounded-lg text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-600 bg-transparent w-4 h-4 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Semester Filter Section */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">
                    {t('semester')} ({settings.semestersPerYear || 2} {isAr ? 'فصول' : 'semesters'})
                  </h4>
                  {filterSemesters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterSemesters([])}
                      className="text-[11px] text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold"
                    >
                      {isAr ? 'الكل' : 'All'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: settings.semestersPerYear || 2 }).map((_, i) => {
                    const semNum = i + 1;
                    const isSelected = filterSemesters.includes(semNum);
                    return (
                      <label
                        key={semNum}
                        className={`flex items-center justify-between text-sm cursor-pointer p-3 rounded-2xl border transition-all ${
                          isSelected
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-bold shadow-2xs'
                            : 'bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200/70 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <span className="text-xs font-bold">{t('semester')} {semNum}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSemester(semNum)}
                          className="rounded-lg text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-600 bg-transparent w-4 h-4 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              {currentSemester ? (
                <button
                  type="button"
                  onClick={resetToCurrentSemester}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>{isAr ? 'تحديد الفصل الحالي' : 'Set to Current'}</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>{isAr ? 'تطبيق الفلتر' : 'Apply'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
