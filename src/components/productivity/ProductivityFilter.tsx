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
}

export function ProductivityFilter({ filter, setFilter }: ProductivityFilterProps) {
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

  return (
    <div ref={popoverRef} className="relative z-20">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
          hasActiveFilter 
             ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' 
             : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
        }`}
      >
        <Filter size={16} /> {isAr ? 'تصفية' : 'Filter'}
      </button>
      
      {isOpen && (
        <div className={`absolute top-full mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 z-50 ${isAr ? 'left-0' : 'right-0'}`}>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
            {isAr ? 'الفترة الزمنية' : 'Time Period'}
          </h4>
          
          <div className="space-y-1 mb-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-2 rounded-lg transition-colors">
              <input type="radio" name="dateFilter" checked={filter.type === 'all'} onChange={() => handleTypeChange('all')} className="rounded-full text-indigo-600 focus:ring-indigo-500" />
              {isAr ? 'كل المدة' : 'All Time'}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-2 rounded-lg transition-colors">
              <input type="radio" name="dateFilter" checked={filter.type === 'semester'} onChange={() => handleTypeChange('semester')} className="rounded-full text-indigo-600 focus:ring-indigo-500" />
              {isAr ? 'هذا الفصل الدراسي' : 'This Semester'}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-2 rounded-lg transition-colors">
              <input type="radio" name="dateFilter" checked={filter.type === 'month'} onChange={() => handleTypeChange('month')} className="rounded-full text-indigo-600 focus:ring-indigo-500" />
              {isAr ? 'هذا الشهر' : 'This Month'}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-2 rounded-lg transition-colors">
              <input type="radio" name="dateFilter" checked={filter.type === 'today'} onChange={() => handleTypeChange('today')} className="rounded-full text-indigo-600 focus:ring-indigo-500" />
              {isAr ? 'هذا اليوم' : 'Today'}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-2 rounded-lg transition-colors">
              <input type="radio" name="dateFilter" checked={filter.type === 'custom'} onChange={() => handleTypeChange('custom')} className="rounded-full text-indigo-600 focus:ring-indigo-500" />
              {isAr ? 'تحديد فترة' : 'Custom Range'}
            </label>
          </div>
          
          {filter.type === 'custom' && (
            <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{isAr ? 'من' : 'From'}</label>
                <input 
                  type="date" 
                  value={filter.from} 
                  onChange={(e) => setFilter({ ...filter, from: e.target.value })}
                  className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{isAr ? 'إلى' : 'To'}</label>
                <input 
                  type="date" 
                  value={filter.to} 
                  onChange={(e) => setFilter({ ...filter, to: e.target.value })}
                  className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
