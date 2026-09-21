import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  BookOpen, 
  Check, 
  Layers, 
  Clock, 
  Award, 
  Calendar
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';

interface SubjectPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSubjectId?: string;
  onSelectSubject: (subjectId: string | undefined) => void;
  defaultYearIndex?: number;
  defaultSemesterIndex?: number;
  title?: string;
}

export function SubjectPickerModal({
  isOpen,
  onClose,
  selectedSubjectId,
  onSelectSubject,
  defaultYearIndex,
  defaultSemesterIndex,
  title
}: SubjectPickerModalProps) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const subjects = useAppStore(state => state.subjects);
  const settings = useAppStore(state => state.settings);

  const totalYears = Number(settings.totalYears) || 4;
  const semestersPerYear = Number(settings.semestersPerYear) || 2;
  const currentSemesterInfo = (settings.semesters || []).find(s => s.isCurrent);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYearFilter, setSelectedYearFilter] = useState<number | 'all'>('all');
  const [selectedSemFilter, setSelectedSemFilter] = useState<number | 'all'>('all');

  // Set initial filters based on defaults or current semester
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      if (defaultYearIndex !== undefined && defaultYearIndex > 0) {
        setSelectedYearFilter(defaultYearIndex);
      } else if (currentSemesterInfo?.yearIndex) {
        setSelectedYearFilter(currentSemesterInfo.yearIndex);
      } else {
        setSelectedYearFilter('all');
      }

      if (defaultSemesterIndex !== undefined && defaultSemesterIndex > 0) {
        setSelectedSemFilter(defaultSemesterIndex);
      } else if (currentSemesterInfo?.semesterIndex) {
        setSelectedSemFilter(currentSemesterInfo.semesterIndex);
      } else {
        setSelectedSemFilter('all');
      }
    }
  }, [isOpen, defaultYearIndex, defaultSemesterIndex, currentSemesterInfo]);

  // Filter subjects based on search query, year, and semester
  const filteredSubjects = useMemo(() => {
    return subjects.filter(sub => {
      // Search text match
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = sub.name.toLowerCase().includes(query);
        const matchesCode = (sub.code || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCode) return false;
      }

      // Year filter
      if (selectedYearFilter !== 'all' && sub.yearIndex !== selectedYearFilter) {
        return false;
      }

      // Semester filter
      if (selectedSemFilter !== 'all' && sub.semesterIndex !== selectedSemFilter) {
        return false;
      }

      return true;
    });
  }, [subjects, searchQuery, selectedYearFilter, selectedSemFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-zinc-900 dark:text-white truncate">
                {title || (isAr ? 'اختيار المادة الدراسية المرتبطة' : 'Select Linked Subject')}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                {isAr ? 'اختر مادة لربط المجلد أو الملف بها مباشرة' : 'Link this file or folder to a specific subject'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Controls & Search */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 space-y-3.5 bg-white dark:bg-zinc-900">
          {/* Search Bar */}
          <div className="relative">
            <Search className={`w-4 h-4 text-zinc-400 absolute top-1/2 -translate-y-1/2 ${isAr ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'ابحث باسم المادة أو الكود...' : 'Search by subject name or code...'}
              className={`w-full py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${isAr ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 rounded-lg ${isAr ? 'left-3' : 'right-3'}`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Year & Semester Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Year Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 hide-scrollbar">
              <span className="text-[11px] font-bold text-zinc-400 shrink-0 ml-1">
                {isAr ? 'السنة:' : 'Year:'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedYearFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  selectedYearFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>
              {Array.from({ length: totalYears }, (_, i) => i + 1).map(y => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setSelectedYearFilter(y)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    selectedYearFilter === y
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {isAr ? `سنة ${y}` : `Y${y}`}
                </button>
              ))}
            </div>

            {/* Semester Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 hide-scrollbar">
              <span className="text-[11px] font-bold text-zinc-400 shrink-0 ml-1">
                {isAr ? 'الترم:' : 'Term:'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedSemFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  selectedSemFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>
              {Array.from({ length: semestersPerYear }, (_, i) => i + 1).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSemFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    selectedSemFilter === s
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {isAr ? `ترم ${s}` : `T${s}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Subjects List Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-2.5 flex-1 divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {/* General / Unlink Option */}
          <div
            onClick={() => { onSelectSubject(undefined); onClose(); }}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              !selectedSubjectId
                ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-2xs'
                : 'bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${
                !selectedSubjectId
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
              }`}>
                <Layers size={18} />
              </div>
              <div>
                <p className="font-black text-sm text-zinc-900 dark:text-white">
                  {isAr ? 'عام (غير مرتبط بمادة محددة)' : 'General (Not linked to any subject)'}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {isAr ? 'الملف أو المجلد يظهر في الدرايف العام للسنة والفصل الدراسي' : 'Item will be available at general drive level'}
                </p>
              </div>
            </div>

            {!selectedSubjectId && (
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Check size={14} />
              </span>
            )}
          </div>

          {/* Filtered Subjects Cards */}
          <div className="pt-2.5 space-y-2">
            {filteredSubjects.map(sub => {
              const isSelected = selectedSubjectId === sub.id;
              return (
                <div
                  key={sub.id}
                  onClick={() => { onSelectSubject(sub.id); onClose(); }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-600 shadow-2xs'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40'
                    }`}>
                      <BookOpen size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-sm text-zinc-900 dark:text-white truncate">
                          {sub.name}
                        </h4>
                        {sub.code && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-black uppercase">
                            {sub.code}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                          <Calendar size={10} />
                          <span>{isAr ? `سنة ${sub.yearIndex} • ترم ${sub.semesterIndex}` : `Y${sub.yearIndex} • T${sub.semesterIndex}`}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold">
                          <Clock size={10} />
                          <span>{sub.creditHours} {isAr ? 'ساعات' : 'hrs'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold">
                          <Award size={10} />
                          <span>{sub.totalMarks} {isAr ? 'درجة' : 'marks'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Check size={14} />
                    </span>
                  )}
                </div>
              );
            })}

            {filteredSubjects.length === 0 && (
              <div className="py-12 text-center text-zinc-400 space-y-2">
                <BookOpen size={36} className="mx-auto opacity-20 text-indigo-500" />
                <p className="font-bold text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
                  {isAr ? 'لا توجد مواد تطابق خيارات البحث والفلتر الحالية.' : 'No subjects match the selected filters.'}
                </p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedYearFilter('all'); setSelectedSemFilter('all'); }}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {isAr ? 'إعادة ضبط الفلتر' : 'Reset filters'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end bg-zinc-50/50 dark:bg-zinc-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
