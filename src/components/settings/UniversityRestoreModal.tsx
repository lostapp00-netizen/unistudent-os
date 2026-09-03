import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../lib/db';
import { UniversityDatabase } from '../../types';
import { 
  Building2, 
  GraduationCap, 
  Search, 
  BookOpen, 
  HardDrive, 
  Calendar, 
  Check, 
  X, 
  Sparkles, 
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Folder,
  CheckCircle2,
  Loader2,
  Award,
  Layers,
  ChevronRight
} from 'lucide-react';

interface UniversityRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UniversityRestoreModal({ isOpen, onClose, onSuccess }: UniversityRestoreModalProps) {
  const { t, i18n } = useTranslation();
  const { settings, importFromUniversityDatabase } = useAppStore();
  const isAr = i18n.language === 'ar' || settings.language === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const [loading, setLoading] = useState(true);
  const [databases, setDatabases] = useState<UniversityDatabase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Accordion expanded university key
  const [expandedUniKey, setExpandedUniKey] = useState<string | null>(null);
  const [selectedDb, setSelectedDb] = useState<UniversityDatabase | null>(null);
  const [importDrive, setImportDrive] = useState(true);
  const [importing, setImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSuccessMessage(null);
      setExpandedUniKey(null);
      setSelectedDb(null);
      db.getUniversityDatabases()
        .then(dbs => {
          setDatabases(dbs);
          // If search matches or single uni, expand first
          if (dbs.length > 0) {
            const firstKey = dbs[0].universityNameAr || dbs[0].universityNameEn || 'جامعة';
            setExpandedUniKey(firstKey);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Group databases by unique university name (AR or EN)
  const registered = useMemo(() => {
    if (!isOpen) return [];
    return db.getRegisteredUniversities();
  }, [isOpen]);

  const regMap = useMemo(() => new Map(registered.map(r => [r.key.trim(), r])), [registered]);

  const groupedUniversities = useMemo(() => {
    if (!isOpen) return {};
    return databases.reduce((acc, current) => {
      // If college is hidden by admin, do not show to students
      if (current.isVisible === false || (current as any).is_visible === false) {
        return acc;
      }

      const key = (current.universityNameAr || current.universityNameEn || 'جامعة أخرى').trim();
      const regUni = regMap.get(key) || 
                     regMap.get((current.universityNameAr || '').trim()) || 
                     regMap.get((current.universityNameEn || '').trim());
      
      // If university is hidden by admin, do not show to students
      if (regUni && regUni.isVisible === false) {
        return acc;
      }

      if (!acc[key]) {
        acc[key] = {
          key,
          nameAr: current.universityNameAr || key,
          nameEn: current.universityNameEn || key,
          databases: []
        };
      }
      acc[key].databases.push(current);
      return acc;
    }, {} as Record<string, { key: string; nameAr: string; nameEn: string; databases: UniversityDatabase[] }>);
  }, [databases, regMap, isOpen]);

  // Filter universities by search
  const filteredUniversities = useMemo(() => {
    if (!isOpen) return [];
    return Object.values(groupedUniversities).filter(group => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchAr = group.nameAr?.toLowerCase().includes(q);
      const matchEn = group.nameEn?.toLowerCase().includes(q);
      const matchColleges = group.databases.some(
        d => d.collegeNameAr?.toLowerCase().includes(q) || d.collegeNameEn?.toLowerCase().includes(q)
      );
      return matchAr || matchEn || matchColleges;
    });
  }, [groupedUniversities, searchQuery, isOpen]);

  const handleToggleExpand = (key: string) => {
    setExpandedUniKey(prev => prev === key ? null : key);
  };

  const handleImport = async () => {
    if (!selectedDb) return;
    try {
      setImporting(true);
      await importFromUniversityDatabase(selectedDb.id, { importDrive });
      const uniName = isAr ? selectedDb.universityNameAr : (selectedDb.universityNameEn || selectedDb.universityNameAr);
      const colName = isAr ? selectedDb.collegeNameAr : (selectedDb.collegeNameEn || selectedDb.collegeNameAr);
      setSuccessMessage(
        isAr 
          ? `تم استرداد قاعدة البيانات بنجاح من ${uniName} - ${colName} (${selectedDb.subjects?.length || 0} مادة ولائحة التقديرات)!` 
          : `Database successfully restored from ${uniName} - ${colName} (${selectedDb.subjects?.length || 0} subjects & grading scale)!`
      );
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1600);
    } catch (e: any) {
      console.error('Import error:', e);
      alert(isAr ? 'حدث خطأ أثناء الاسترداد. يرجى المحاولة لاحقاً.' : 'Failed to import. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-5xl max-h-[94vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white">
                {isAr ? 'استرداد من قاعدة بيانات الجامعات' : 'Restore from University Database'}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isAr ? 'اختر الجامعة واضغط لعرض كلياتها واستيراد الخطة الدراسية والمواد ولائحة التقديرات المعتمدة' : 'Select university, expand to view colleges and restore subjects & grading scale'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {successMessage ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white">{successMessage}</h3>
              <p className="text-xs text-zinc-500">
                {isAr ? 'جاري تحديث حسابك بالمواد والخطة ولائحة التقديرات الجديدة...' : 'Updating your account with imported curriculum and grading scale...'}
              </p>
            </div>
          ) : loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
              <p className="text-xs font-bold">{isAr ? 'جاري جلب قواعد بيانات الجامعات المتاحة...' : 'Loading available universities...'}</p>
            </div>
          ) : filteredUniversities.length === 0 && !searchQuery.trim() ? (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <Building2 size={48} className="mx-auto opacity-20" />
              <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                {isAr ? 'لا توجد قواعد بيانات للجامعات متاحة حالياً.' : 'No university databases available yet.'}
              </p>
              <p className="text-xs text-zinc-400">
                {isAr ? 'يمكنك إدخال بياناتك وموادك يدوياً، أو مراجعة إدارة الموقع.' : 'You can enter your subjects manually or contact the admin.'}
              </p>
            </div>
          ) : !selectedDb ? (
            /* STEP 1: HIERARCHICAL ACCORDION SELECTOR */
            <div className="space-y-4">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث عن اسم الجامعة أو الكلية (عربي / English)...' : 'Search university or college (AR / EN)...'}
                  className="w-full pl-11 rtl:pl-4 rtl:pr-11 pr-4 py-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              <div className="space-y-3.5 max-h-[60vh] sm:max-h-[560px] overflow-y-auto pr-1">
                {filteredUniversities.map((group) => {
                  const isExpanded = expandedUniKey === group.key;

                  return (
                    <div 
                      key={group.key}
                      className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden transition-all"
                    >
                      {/* University Header Row (Accordion Trigger) */}
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(group.key)}
                        className="w-full p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left rtl:text-right hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-lg shadow-indigo-500/20">
                            <Building2 size={26} />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h4 className="font-black text-lg sm:text-xl text-zinc-900 dark:text-white tracking-tight leading-snug">
                                {group.nameAr || group.nameEn}
                              </h4>
                              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-full border border-indigo-200/80 dark:border-indigo-800/80 shrink-0">
                                {group.databases.length} {isAr ? 'كليات متاحة' : 'Colleges'}
                              </span>
                            </div>
                            {group.nameEn && group.nameEn !== group.nameAr && (
                              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-bold">
                                {group.nameEn}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
                          <span className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {isExpanded ? (isAr ? 'إخفاء الكليات' : 'Hide Colleges') : (isAr ? 'استعراض الكليات المتاحة' : 'View Colleges')}
                          </span>
                          <div className={`w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-600 bg-indigo-50 dark:bg-indigo-950' : ''}`}>
                            <ChevronDown size={20} />
                          </div>
                        </div>
                      </button>

                      {/* Expanded Colleges List */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 bg-zinc-50/70 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3 animate-in fade-in duration-150">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {group.databases.map((dbItem) => (
                              <div
                                key={dbItem.id}
                                onClick={() => setSelectedDb(dbItem)}
                                className="p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/70 bg-white dark:bg-zinc-900 hover:border-indigo-500 dark:hover:border-indigo-500 text-left rtl:text-right transition-all group flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md cursor-pointer"
                              >
                                <div className="space-y-1.5 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <GraduationCap size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                                      <h5 className="font-black text-sm sm:text-base text-zinc-900 dark:text-white truncate">
                                        {dbItem.collegeNameAr || dbItem.collegeNameEn}
                                      </h5>
                                    </div>
                                    <ArrowIcon size={16} className="text-zinc-400 group-hover:text-indigo-600 transition-transform group-hover:scale-110 shrink-0" />
                                  </div>
                                  {dbItem.collegeNameEn && dbItem.collegeNameAr && dbItem.collegeNameEn !== dbItem.collegeNameAr && (
                                    <p className="text-xs text-zinc-400 font-bold truncate">
                                      {dbItem.collegeNameEn}
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 font-bold">
                                  <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg">
                                    {dbItem.subjects?.length || 0} {isAr ? 'مادة دراسية' : 'subjects'}
                                  </span>
                                  <span className="bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                                    {dbItem.totalYears || 4} {isAr ? 'سنوات' : 'years'}
                                  </span>
                                  <span className="bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                                    {dbItem.driveFiles?.length || 0} {isAr ? 'ملفات درايف' : 'files'}
                                  </span>
                                  {dbItem.gradingScale && dbItem.gradingScale.length > 0 && (
                                    <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg">
                                      {isAr ? 'لائحة تقديرات معتمدة' : 'Grading scale'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredUniversities.length === 0 && (
                  <div className="py-12 text-center text-zinc-400">
                    <p className="text-xs font-bold">{isAr ? 'لا توجد نتائج مطابقة لبحثك.' : 'No results matching your query.'}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* STEP 2: REVIEW & CONFIRM RESTORE */
            <div className="space-y-5 animate-in fade-in duration-150">
              <button
                onClick={() => setSelectedDb(null)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <ArrowIcon size={14} className="rotate-180" />
                <span>{isAr ? 'الرجوع لاختيار كلية أو جامعة أخرى' : 'Back to select another college'}</span>
              </button>

              {/* Summary Card */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-50/80 to-blue-50/50 dark:from-indigo-950/40 dark:to-zinc-900 border border-indigo-200/80 dark:border-indigo-800/60 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 mb-1">
                      {isAr ? 'قاعدة البيانات المعتمدة للاسترداد' : 'Selected Database'}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                      {selectedDb.universityNameAr} {selectedDb.universityNameEn ? `(${selectedDb.universityNameEn})` : ''}
                    </h3>
                    <p className="text-xs sm:text-sm font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {selectedDb.collegeNameAr} {selectedDb.collegeNameEn ? `- ${selectedDb.collegeNameEn}` : ''}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                    <Sparkles size={22} />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                  <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-950">
                    <span className="block text-base font-black text-indigo-600 dark:text-indigo-400">
                      {selectedDb.subjects?.length || 0}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500">{isAr ? 'مادة دراسية' : 'Subjects'}</span>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-950">
                    <span className="block text-base font-black text-indigo-600 dark:text-indigo-400">
                      {selectedDb.totalYears || 4}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500">{isAr ? 'سنوات' : 'Years'}</span>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-950">
                    <span className="block text-base font-black text-indigo-600 dark:text-indigo-400">
                      {selectedDb.semestersPerYear || 2}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500">{isAr ? 'فصول/سنة' : 'Terms/Yr'}</span>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-950">
                    <span className="block text-base font-black text-indigo-600 dark:text-indigo-400">
                      {selectedDb.driveFiles?.length || 0}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500">{isAr ? 'ملفات درايف' : 'Files'}</span>
                  </div>
                </div>
              </div>

              {/* Grading Scale Table Preview */}
              {selectedDb.gradingScale && selectedDb.gradingScale.length > 0 && (
                <div className="space-y-2 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <Award size={15} className="text-indigo-600" />
                      <span>{isAr ? 'جدول لائحة التقديرات المعتمدة التي سيتم استردادها:' : 'Accredited Grading Scale Table to Import:'}</span>
                    </h4>
                    <span className="text-[10px] font-bold text-zinc-400">
                      {selectedDb.gradingScale.length} {isAr ? 'تقديرات' : 'rules'}
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[140px] overflow-y-auto">
                    <table className="w-full text-xs text-left rtl:text-right">
                      <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 text-[10px] uppercase font-black">
                        <tr>
                          <th className="py-2 px-3">{isAr ? 'الرمز' : 'Grade'}</th>
                          <th className="py-2 px-3">{isAr ? 'الاسم' : 'Name'}</th>
                          <th className="py-2 px-3 text-center">{isAr ? 'النسبة المئوية' : 'Percentage'}</th>
                          <th className="py-2 px-3 text-center">{isAr ? 'النقاط (GPA)' : 'Points'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {selectedDb.gradingScale.map((rule, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                            <td className="py-1.5 px-3 font-black text-indigo-600">{rule.letter}</td>
                            <td className="py-1.5 px-3 font-bold text-zinc-700 dark:text-zinc-300">{isAr ? rule.nameAr : (rule.nameEn || rule.nameAr)}</td>
                            <td className="py-1.5 px-3 text-center font-medium text-zinc-500">
                              {rule.minPercentage}% {rule.maxOperator === '<' ? '<' : '≤'} {rule.maxPercentage}%
                            </td>
                            <td className="py-1.5 px-3 text-center font-black text-zinc-900 dark:text-white">{rule.points.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sample of subjects */}
              {selectedDb.subjects && selectedDb.subjects.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <BookOpen size={14} className="text-indigo-600" />
                    <span>{isAr ? 'عينة من المواد الجاهزة للاستيراد والخطة:' : 'Sample of subjects ready to import:'}</span>
                  </h4>
                  <div className="max-h-[130px] overflow-y-auto space-y-1.5 pr-1">
                    {selectedDb.subjects.slice(0, 10).map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-100 dark:border-zinc-700/60">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{s.name}</span>
                        <span className="text-[10px] font-medium text-zinc-400 shrink-0">
                          {s.creditHours} {isAr ? 'ساعات' : 'hrs'} • {s.totalMarks} {isAr ? 'درجة' : 'marks'} • {isAr ? `سنة ${s.yearIndex} ترم ${s.semesterIndex}` : `Y${s.yearIndex} S${s.semesterIndex}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importDrive}
                    onChange={(e) => setImportDrive(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-200">
                    {isAr ? 'استيراد مجلدات وملفات الدرايف المرجعية لهذه الكلية' : 'Import reference Drive folders & files for this college'}
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {selectedDb && !successMessage && (
          <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
            <button
              onClick={() => setSelectedDb(null)}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-2xl transition-all text-xs sm:text-sm font-black shadow-lg shadow-indigo-500/25 cursor-pointer"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{isAr ? 'تأكيد واسترداد الخطة والمواد ولائحة التقديرات' : 'Confirm & Restore Plan, Subjects & Scale'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
