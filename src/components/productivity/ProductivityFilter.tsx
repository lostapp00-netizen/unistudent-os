import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export type DateFilterType = 'all' | 'today' | 'month' | 'semester' | 'custom';

export interface ProductivityFilterState {
  type: DateFilterType;
  from: string;
  to: string;
}

interface ProductivityFilterProps {
  filter: ProductivityFilterState;
  setFilter: (filter: ProductivityFilterState) => void;
  align?: 'center' | 'start' | 'end';
  className?: string;
}

export function ProductivityFilter({ filter, setFilter, align = 'center', className = '' }: ProductivityFilterProps) {
  const { settings } = useAppStore();
  const isAr = settings.language === 'ar';
  
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTypeChange = (type: DateFilterType) => {
    setFilter({ ...filter, type });
  };

  const hasActiveFilter = filter.type !== 'all';

  const getFilterLabel = () => {
    switch (filter.type) {
      case 'today': return isAr ? 'اليوم' : 'Today';
      case 'month': return isAr ? 'هذا الشهر' : 'This Month';
      case 'semester': return isAr ? 'هذا الفصل' : 'This Semester';
      case 'custom': return isAr ? 'فترة مخصصة' : 'Custom';
      default: return isAr ? 'تصفية' : 'Filter';
    }
  };

  const popoverAlignClass = 
    align === 'center' 
      ? 'left-1/2 -translate-x-1/2' 
      : align === 'end'
      ? 'right-0 rtl:right-auto rtl:left-0'
      : 'left-0 rtl:left-auto rtl:right-0';

  return (
    <div ref={popoverRef} className={`relative z-20 ${className}`}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all border shadow-xs cursor-pointer ${
          hasActiveFilter 
             ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 ring-2 ring-indigo-500/20' 
             : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
        }`}
      >
        <Filter size={16} className={hasActiveFilter ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'} /> 
        <span>{getFilterLabel()}</span>
        {hasActiveFilter && (
          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
        )}
      </button>
      
      {isOpen && (
        <div className={`absolute top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 ${popoverAlignClass}`}>
          <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <h4 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Filter size={13} className="text-indigo-500" />
              <span>{isAr ? 'الفترة الزمنية' : 'Time Period'}</span>
            </h4>
            {hasActiveFilter && (
              <button 
                type="button"
                onClick={() => {
                  setFilter({ type: 'all', from: '', to: '' });
                  setIsOpen(false);
                }}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {isAr ? 'إعادة ضبط (الكل)' : 'Reset'}
              </button>
            )}
          </div>
          
          <div className="space-y-1.5 mb-3">
            {[
              { id: 'all', label: isAr ? 'كل المدة (بدون تصفية)' : 'All Time' },
              { id: 'semester', label: isAr ? 'هذا الفصل الدراسي الحالي' : 'This Semester' },
              { id: 'month', label: isAr ? 'هذا الشهر الحالي' : 'This Month' },
              { id: 'today', label: isAr ? 'اليوم فقط' : 'Today' },
              { id: 'custom', label: isAr ? 'تحديد فترة مخصصة (من - إلى)' : 'Custom Range' },
            ].map(item => (
              <label 
                key={item.id} 
                className={`flex items-center gap-2.5 text-xs font-semibold p-2.5 rounded-xl transition-all cursor-pointer ${
                  filter.type === item.id 
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold' 
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <input 
                  type="radio" 
                  name="dateFilter" 
                  checked={filter.type === item.id} 
                  onChange={() => handleTypeChange(item.id as DateFilterType)} 
                  className="text-indigo-600 focus:ring-indigo-500 rounded-full" 
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
          
          {filter.type === 'custom' && (
            <div className="space-y-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">{isAr ? 'من تاريخ:' : 'From:'}</label>
                <input 
                  type="date" 
                  value={filter.from} 
                  onChange={(e) => setFilter({ ...filter, from: e.target.value })}
                  className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">{isAr ? 'إلى تاريخ:' : 'To:'}</label>
                <input 
                  type="date" 
                  value={filter.to} 
                  onChange={(e) => setFilter({ ...filter, to: e.target.value })}
                  className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="pt-2.5 mt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              {isAr ? 'تم' : 'Apply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
