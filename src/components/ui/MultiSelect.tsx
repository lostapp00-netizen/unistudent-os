import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Option = {
  id: string;
  label: string;
};

interface MultiSelectProps {
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ options, selectedIds, onChange, placeholder }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(itemId => itemId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeOption = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(selectedIds.filter(itemId => itemId !== id));
  };

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 flex flex-wrap gap-2 items-center min-h-[42px] cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500 transition-shadow"
      >
        {selectedOptions.length === 0 ? (
          <span className="text-zinc-500 text-sm flex-1">{placeholder || t('select_items')}</span>
        ) : (
          <div className="flex flex-wrap gap-2 flex-1">
            {selectedOptions.map(opt => (
              <span key={opt.id} className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1 font-medium border border-emerald-200 dark:border-emerald-800/50">
                {opt.label}
                <button 
                  onClick={(e) => removeOption(e, opt.id)}
                  className="hover:text-rose-500 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <ChevronDown size={16} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-3 text-sm text-zinc-500 text-center">لا توجد خيارات متاحة</div>
          ) : (
            <div className="p-1">
              {options.map(opt => {
                const isSelected = selectedIds.includes(opt.id);
                return (
                  <div 
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={`px-3 py-2 flex items-center justify-between cursor-pointer rounded-lg text-sm transition-colors ${
                      isSelected 
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium' 
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={16} />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
