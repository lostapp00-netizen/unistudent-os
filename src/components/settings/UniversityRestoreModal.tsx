import React, { useState, useEffect } from 'react';
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
  ChevronRight, 
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Folder,
  Layers,
  CheckCircle2,
  Loader2
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
  
  // Selected State
  const [selectedUniKey, setSelectedUniKey] = useState<string | null>(null);
  const [selectedDb, setSelectedDb] = useState<UniversityDatabase | null>(null);
  const [importDrive, setImportDrive] = useState(true);
  const [importing, setImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSuccessMessage(null);
      setSelectedUniKey(null);
      setSelectedDb(null);
      db.getUniversityDatabases()
        .then(dbs => setDatabases(dbs))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Group databases by unique university name (AR or EN)
  const groupedUniversities = databases.reduce((acc, current) => {
    const key = current.universityNameAr || current.universityNameEn || 'جامعة أخرى';
    if (!acc[key]) {
      acc[key] = {
        nameAr: current.universityNameAr,
        nameEn: current.universityNameEn,
        databases: []
      };
    }
    acc[key].databases.push(current);
    return acc;
  }, {} as Record<string, { nameAr: string; nameEn: string; databases: UniversityDatabase[] }>);

  // Filter universities by search
  const filteredUniversities = Object.entries(groupedUniversities).filter(([key, group]) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchAr = group.nameAr?.toLowerCase().includes(q);
    const matchEn = group.nameEn?.toLowerCase().includes(q);
    const matchColleges = group.databases.some(
      d => d.collegeNameAr?.toLowerCase().includes(q) || d.collegeNameEn?.toLowerCase().includes(q)
    );
    return matchAr || matchEn || matchColleges;
  });

  const handleImport = async () => {
    if (!selectedDb) return;
    try {
      setImporting(true);
      await importFromUniversityDatabase(selectedDb.id, { importDrive });
      setSuccessMessage(
        isAr 
          ? `تم استرداد الخطة والمواد (${selectedDb.subjects?.length || 0} مادة) بنجاح!` 
          : `Academic plan and (${selectedDb.subjects?.length || 0} subjects) imported successfully!`
      );
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (e: any) {
      console.error('Import error:', e);
      alert(isAr ? 'حدث خطأ أثناء الاسترداد. يرجى المحاولة لاحقاً.' : 'Failed to import. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white">
                {isAr ? 'استرداد من قاعدة بيانات الجامعات' : 'Restore from University Database'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isAr ? 'اختر جامعتك وكليتك لاستيراد الخطة والمواد والدرايف تلقائياً' : 'Select your university & college to import academic plan, subjects & drive'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {successMessage ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{successMessage}</h3>
              <p className="text-xs text-zinc-500">
                {isAr ? 'جاري تحديث حسابك بالمواد الجديدة...' : 'Updating your account with imported subjects...'}
              </p>
            </div>
          ) : loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
              <p className="text-xs font-bold">{isAr ? 'جاري جلب قواعد بيانات الجامعات المتاحة...' : 'Loading available universities...'}</p>
            </div>
          ) : databases.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <Building2 size={48} className="mx-auto opacity-20" />
              <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                {isAr ? 'لا توجد قواعد بيانات للجامعات مسجلة حالياً.' : 'No university databases available yet.'}
              </p>
              <p className="text-xs text-zinc-400">
                {isAr ? 'يمكنك إدخال بياناتك وموادك يدوياً، أو مراجعة إدارة الموقع.' : 'You can enter your subjects manually or contact the admin.'}
              </p>
            </div>
          ) : (
            <>
              {/* Step 1: Select University if not yet picked */}
              {!selectedUniKey && (
                <div className="space-y-4">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isAr ? 'ابحث عن اسم الجامعة أو الكلية (عربي / English)...' : 'Search by university or college (AR / EN)...'}
                      className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                    {filteredUniversities.map(([key, group]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedUniKey(key)}
                        className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-500 dark:hover:border-indigo-500 text-left rtl:text-right transition-all group flex items-center justify-between gap-3 shadow-2xs hover:shadow-md cursor-pointer"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">
                              {group.nameAr || group.nameEn}
                            </h4>
                          </div>
                          {group.nameEn && group.nameAr && (
                            <p className="text-[11px] text-zinc-400 font-medium truncate">
                              {group.nameEn}
                            </p>
                          )}
                          <span className="inline-block text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                            {group.databases.length} {isAr ? 'كلية متاحة' : 'colleges available'}
                          </span>
                        </div>
                        <ArrowIcon size={16} className="text-zinc-400 group-hover:text-indigo-600 transition-transform group-hover:scale-110 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Select College within University */}
              {selectedUniKey && !selectedDb && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedUniKey(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <ArrowIcon size={14} className="rotate-180" />
                      <span>{isAr ? 'تغيير الجامعة' : 'Change University'}</span>
                    </button>
                    <span className="text-xs font-bold text-zinc-500">
                      {groupedUniversities[selectedUniKey]?.nameAr} ({groupedUniversities[selectedUniKey]?.nameEn})
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                    {isAr ? 'اختر الكلية:' : 'Select College:'}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                    {groupedUniversities[selectedUniKey]?.databases.map((dbItem) => (
                      <button
                        key={dbItem.id}
                        onClick={() => setSelectedDb(dbItem)}
                        className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-500 dark:hover:border-indigo-500 text-left rtl:text-right transition-all group flex items-center justify-between gap-3 shadow-2xs hover:shadow-md cursor-pointer"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <GraduationCap size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">
                              {dbItem.collegeNameAr || dbItem.collegeNameEn}
                            </h4>
                          </div>
                          {dbItem.collegeNameEn && dbItem.collegeNameAr && (
                            <p className="text-[11px] text-zinc-400 font-medium truncate">
                              {dbItem.collegeNameEn}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                            <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              {dbItem.subjects?.length || 0} {isAr ? 'مادة' : 'subjects'}
                            </span>
                            <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              {dbItem.totalYears || 4} {isAr ? 'سنوات' : 'years'}
                            </span>
                            <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              {dbItem.driveFiles?.length || 0} {isAr ? 'ملف درايف' : 'drive files'}
                            </span>
                          </div>
                        </div>
                        <ArrowIcon size={16} className="text-zinc-400 group-hover:text-indigo-600 transition-transform group-hover:scale-110 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Review and Confirm Import */}
              {selectedDb && (
                <div className="space-y-5">
                  <button
                    onClick={() => setSelectedDb(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <ArrowIcon size={14} className="rotate-180" />
                    <span>{isAr ? 'اختيار كلية أخرى' : 'Pick another college'}</span>
                  </button>

                  <div className="p-4 rounded-3xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {isAr ? 'بيانات القالب المختار' : 'Selected Template'}
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                          {selectedDb.universityNameAr} ({selectedDb.universityNameEn})
                        </h3>
                        <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                          {selectedDb.collegeNameAr} {selectedDb.collegeNameEn ? ` - ${selectedDb.collegeNameEn}` : ''}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Sparkles size={20} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40 text-center">
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
                        <span className="text-[10px] font-bold text-zinc-500">{isAr ? 'سنوات دراسية' : 'Years'}</span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-950">
                        <span className="block text-base font-black text-indigo-600 dark:text-indigo-400">
                          {selectedDb.driveFiles?.length || 0}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-500">{isAr ? 'ملفات درايف' : 'Files'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importDrive}
                        onChange={(e) => setImportDrive(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-200">
                        {isAr ? 'استيراد مجلدات وملفات الدرايف المرجعية لهذه الكلية' : 'Import reference Drive folders and files for this college'}
                      </span>
                    </label>
                  </div>

                  {/* Preview of subjects sample */}
                  {selectedDb.subjects && selectedDb.subjects.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                        {isAr ? 'عينة من المواد الجاهزة للاستيراد:' : 'Sample of subjects ready to import:'}
                      </h4>
                      <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1">
                        {selectedDb.subjects.slice(0, 8).map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/60">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{s.name}</span>
                            <span className="text-[10px] font-medium text-zinc-400 shrink-0">
                              {s.creditHours} {isAr ? 'ساعات' : 'hrs'} • {s.totalMarks} {isAr ? 'درجة' : 'marks'} • {isAr ? `سنة ${s.yearIndex} ترم ${s.semesterIndex}` : `Y${s.yearIndex} S${s.semesterIndex}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
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
              <span>{isAr ? 'تأكيد واسترداد الخطة والمواد' : 'Confirm and Import Plan & Subjects'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
