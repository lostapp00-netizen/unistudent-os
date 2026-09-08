import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { 
  calculateSubjectGrade, 
  getWarningThreshold, 
  getMatchingGradeRuleByLetter, 
  getMatchingGradeRuleByPoints, 
  isSubjectAtWarningRisk 
} from '../../lib/academic';
import { 
  AlertTriangle, 
  ArrowLeft, 
  ArrowRight, 
  ShieldAlert, 
  Target, 
  Sliders, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight, 
  Layers, 
  Info 
} from 'lucide-react';

export function AcademicWarnings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subjects, settings, updateSettings } = useAppStore();
  const isAr = settings.language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  // Selected semester filter: 'current' | 'all' | semesterId
  const [selectedSemesterScope, setSelectedSemesterScope] = useState<'current' | 'all'>('current');
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);

  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const currentScale = (settings.gradingScale || []).filter(g => g && !String(g.id || '').startsWith('__') && (typeof g.points === 'number' || !isNaN(Number(g.points))));

  // Get current configured threshold
  const threshold = getWarningThreshold(settings);
  const currentLetter = threshold.letter;
  const currentPoints = Number(threshold.points || 0);

  // Temp state while editing in modal
  const [tempLetter, setTempLetter] = useState(currentLetter);
  const [tempPoints, setTempPoints] = useState<number | ''>(currentPoints);

  // Sort grading scale for display (from high to low)
  const sortedScale = [...currentScale].sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));

  // Filter subjects based on scope
  const scopedSubjects = subjects.filter(s => {
    if (selectedSemesterScope === 'current') {
      if (!currentSemester) return true;
      return s.yearIndex === currentSemester.yearIndex && s.semesterIndex === currentSemester.semesterIndex;
    }
    return true;
  });

  // Warning subjects using the configured threshold
  const warningSubjects = scopedSubjects.filter(s => 
    isSubjectAtWarningRisk(s, settings.gradingScale, currentPoints)
  );

  const openModal = () => {
    setTempLetter(currentLetter);
    setTempPoints(currentPoints);
    setIsEditingThreshold(false);
    setIsThresholdModalOpen(true);
  };

  // Handlers for modal threshold changes
  const handleGradeLetterChange = (letter: string) => {
    const matchedRule = getMatchingGradeRuleByLetter(letter, settings.gradingScale);
    const points = matchedRule ? matchedRule.points : (tempPoints !== '' ? tempPoints : currentPoints);
    setTempLetter(letter);
    setTempPoints(points);
  };

  const handleGpaPointsChange = (val: number | '') => {
    if (val === '') {
      setTempPoints('');
      return;
    }
    const maxScalePoints = sortedScale.length > 0 ? Math.max(...sortedScale.map(r => Number(r.points || 0)), 4.0) : 4.0;
    const clampedPoints = Math.max(0, Math.min(maxScalePoints, Number(val.toFixed(2))));
    const matchedRule = getMatchingGradeRuleByPoints(clampedPoints, settings.gradingScale);
    setTempPoints(clampedPoints);
    if (matchedRule) {
      setTempLetter(matchedRule.letter);
    }
  };

  const handleSaveThreshold = async () => {
    if (tempPoints === '' || isNaN(Number(tempPoints)) || Number(tempPoints) < 0) {
      alert(isAr ? 'يرجى إدخال معدل النقاط المطلوب بشكل صحيح (لا يمكن ترك الحقل فارغاً).' : 'Please enter valid GPA points.');
      return;
    }

    const finalPoints = Number(tempPoints);
    updateSettings({
      warningGradeLetter: tempLetter,
      warningGpaPoints: finalPoints
    });

    const { userId } = useAppStore.getState();
    if (userId) {
      const { db } = await import('../../lib/db');
      db.upsertSettings(userId, {
        warningGradeLetter: tempLetter,
        warningGpaPoints: finalPoints
      }).catch(console.error);
    }

    setIsThresholdModalOpen(false);
    setIsEditingThreshold(false);
    setSaveSuccessToast(true);
    setTimeout(() => setSaveSuccessToast(false), 3000);
  };

  return (
    <div className="flex flex-col min-h-full gap-6 pb-12">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/academic')}
            className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
            title={isAr ? 'رجوع' : 'Back'}
          >
            <BackIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3 text-zinc-900 dark:text-white">
              <AlertTriangle className="text-rose-500 w-8 h-8 flex-shrink-0" />
              {t('warnings_improvements')}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              {isAr 
                ? 'مراقبة المواد المعرضة للخطر وتحديد حد الإنذار الأكاديمي المناسب' 
                : 'Monitor subjects at risk and configure custom academic warning thresholds'}
            </p>
          </div>
        </div>

        {/* Scope Selector (Current Semester vs All) */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 self-stretch sm:self-auto">
          <button
            onClick={() => setSelectedSemesterScope('current')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              selectedSemesterScope === 'current'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {isAr ? 'الفصل الحالي' : 'Current Semester'}
          </button>
          <button
            onClick={() => setSelectedSemesterScope('all')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              selectedSemesterScope === 'all'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {isAr ? 'جميع الفصول' : 'All Semesters'}
          </button>
        </div>
      </header>

      {/* Success Toast */}
      {saveSuccessToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} />
          <span>{isAr ? 'تم حفظ وتطبيق إعدادات حد الإنذار بنجاح!' : 'Warning threshold settings saved successfully!'}</span>
        </div>
      )}

      {/* Warning Threshold Summary Card with Settings Button */}
      <section className="bg-gradient-to-br from-white via-zinc-50/50 to-amber-50/30 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-amber-950/20 rounded-3xl p-6 sm:p-7 border border-amber-200/80 dark:border-amber-900/40 shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
            <Sliders size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {isAr ? 'حد الإنذار الأكاديمي المعتمد' : 'Active Warning Threshold'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                {currentLetter} ({currentPoints.toFixed(2)} GPA)
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {isAr 
                ? `أي مادة يقل تقديرها عن (${currentLetter}) أو يقل معدلها عن (${currentPoints.toFixed(2)} نقاط) تعتبر في مرحلة الإنذار.`
                : `Any subject with grade below (${currentLetter}) or GPA below (${currentPoints.toFixed(2)}) is flagged for risk.`}
            </p>
          </div>
        </div>

        <button
          onClick={openModal}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-center"
        >
          <Sliders size={16} />
          <span>{isAr ? 'ضبط إعدادات حد الإنذار' : 'Configure Threshold'}</span>
        </button>
      </section>

      {/* Threshold Modal */}
      {isThresholdModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    {isAr ? 'إعدادات حد الإنذار الأكاديمي' : 'Warning Threshold Settings'}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {isAr 
                      ? 'حدد التقدير أو النقاط وسيتم التحويل التلقائي بينهما' 
                      : 'Configure the threshold using letter grade or GPA points'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsThresholdModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl"
              >
                <BackIcon size={20} />
              </button>
            </div>

            {/* Mode Banner: View vs Edit */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <Sparkles size={14} className="text-amber-500" />
                <span>
                  {isAr ? 'الحد المختار حالياً:' : 'Selected:'} {tempLetter} ({typeof tempPoints === 'number' ? tempPoints.toFixed(2) : (tempPoints || '0.00')} GPA)
                </span>
              </div>

              {!isEditingThreshold ? (
                <button
                  type="button"
                  onClick={() => setIsEditingThreshold(true)}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800/50 transition-all flex items-center gap-1.5"
                >
                  <span>{isAr ? 'تعديل القيم' : 'Edit Values'}</span>
                </button>
              ) : (
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/40">
                  {isAr ? 'وضع التعديل نشط' : 'Editing Mode Active'}
                </span>
              )}
            </div>

            {/* Dual Controls */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!isEditingThreshold ? 'opacity-60 pointer-events-none' : ''}`}>
              {/* 1. Grade Letter */}
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                    {isAr ? '1. التحديد حسب التقدير' : '1. By Letter Grade'}
                  </label>
                  <p className="text-[11px] text-zinc-500 mb-3">
                    {isAr ? 'اختر التقدير المعتمد للإنذار:' : 'Choose grade letter threshold:'}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {sortedScale.map(grade => {
                      const isSelected = tempLetter === grade.letter;
                      return (
                        <button
                          key={grade.id}
                          type="button"
                          disabled={!isEditingThreshold}
                          onClick={() => handleGradeLetterChange(grade.letter)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                          }`}
                        >
                          <span>{grade.letter}</span>
                          <span className={`text-[10px] ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                            ({Number(grade.points || 0).toFixed(1)})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700/50 flex items-center justify-between text-xs text-zinc-500">
                  <span>{isAr ? 'النقاط المقابلة:' : 'Equivalent GPA:'}</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {typeof tempPoints === 'number' ? tempPoints.toFixed(2) : (tempPoints || '0.00')} GPA
                  </span>
                </div>
              </div>

              {/* 2. GPA Points */}
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                    {isAr ? '2. التحديد حسب معدل النقاط' : '2. By GPA Points'}
                  </label>
                  <p className="text-[11px] text-zinc-500 mb-3">
                    {isAr ? 'أدخل معدل النقاط المطلوب (مثال: 2.00):' : 'Enter GPA threshold (e.g., 2.00):'}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!isEditingThreshold}
                      onClick={() => handleGpaPointsChange(Math.max(0, (Number(tempPoints) || 0) - 0.1))}
                      className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 transition-colors flex items-center justify-center"
                    >
                      -
                    </button>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="4.0"
                        disabled={!isEditingThreshold}
                        value={tempPoints === '' ? '' : tempPoints}
                        onChange={(e) => {
                          if (e.target.value === '') {
                            handleGpaPointsChange('');
                          } else {
                            handleGpaPointsChange(parseFloat(e.target.value));
                          }
                        }}
                        className="w-full text-center text-lg font-black py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!isEditingThreshold}
                      onClick={() => handleGpaPointsChange((Number(tempPoints) || 0) + 0.1)}
                      className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700/50 flex items-center justify-between text-xs text-zinc-500">
                  <span>{isAr ? 'التقدير المقابل:' : 'Equivalent Letter:'}</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {tempLetter}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsThresholdModalOpen(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-all"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>

              {isEditingThreshold && (
                <button
                  type="button"
                  onClick={handleSaveThreshold}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>{isAr ? 'حفظ التعديلات' : 'Save Changes'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning Status Overview */}
      <div className={`rounded-3xl p-6 border transition-all ${
        warningSubjects.length > 0
          ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
          : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            warningSubjects.length > 0
              ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
          }`}>
            {warningSubjects.length > 0 ? <ShieldAlert size={24} /> : <CheckCircle2 size={24} />}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h2 className={`text-xl font-black ${
                warningSubjects.length > 0 
                  ? 'text-rose-900 dark:text-rose-200' 
                  : 'text-emerald-900 dark:text-emerald-200'
              }`}>
                {warningSubjects.length > 0 
                  ? (isAr ? `تنبيه: يوجد ${warningSubjects.length} مواد تحتاج إلى تحسين` : `Warning: ${warningSubjects.length} subjects need improvement`) 
                  : (isAr ? 'ممتاز! لا توجد مواد تحت حد الإنذار' : 'Great! No subjects below warning threshold')}
              </h2>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                warningSubjects.length > 0
                  ? 'bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
                  : 'bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
              }`}>
                {selectedSemesterScope === 'current' ? (isAr ? 'الفصل الحالي' : 'Current Semester') : (isAr ? 'كل الفصول' : 'All Semesters')}
              </span>
            </div>
            <p className={`text-sm leading-relaxed ${
              warningSubjects.length > 0 
                ? 'text-rose-700 dark:text-rose-400/90' 
                : 'text-emerald-700 dark:text-emerald-400/90'
            }`}>
              {warningSubjects.length > 0
                ? (isAr 
                    ? `المواد الموضحة أدناه حققت معدل نقاط أقل من أو يساوي ${currentPoints.toFixed(2)} (${currentLetter}). ركّز على رفع درجات هذه المواد لتفادي تراجع المعدل التراكمي.`
                    : `The subjects below achieved grade points at or below ${currentPoints.toFixed(2)} (${currentLetter}). Focus on improving these grades to avoid a GPA decrease.`)
                : (isAr
                    ? `جميع المواد في ${selectedSemesterScope === 'current' ? 'الفصل الحالي' : 'سجلك'} أعلى من حد الإنذار (${currentLetter} / ${currentPoints.toFixed(2)} GPA). واصل هذا الأداء الرائع!`
                    : `All subjects in ${selectedSemesterScope === 'current' ? 'the current semester' : 'your record'} are above the warning threshold (${currentLetter} / ${currentPoints.toFixed(2)} GPA). Keep it up!`)}
            </p>
          </div>
        </div>
      </div>

      {/* Subjects at Risk List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-xl text-zinc-900 dark:text-white flex items-center gap-2">
            <span>{isAr ? 'المواد المعرضة للخطر' : 'Subjects at Risk'}</span>
            <span className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full font-bold">
              {warningSubjects.length}
            </span>
          </h3>
        </div>
        
        {warningSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {warningSubjects.map(subject => {
              let gradeInfo = calculateSubjectGrade(subject, settings.gradingScale);
              if (!gradeInfo && subject.finalGradeLetter) {
                const rule = getMatchingGradeRuleByLetter(subject.finalGradeLetter, settings.gradingScale);
                if (rule) {
                  gradeInfo = {
                    totalAchieved: 0,
                    percentage: rule.minPercentage,
                    letter: rule.letter,
                    points: rule.points
                  };
                }
              }

              const isFinished = subject.status === 'finished';
              const subjectPoints = gradeInfo ? gradeInfo.points : 0;
              const subjectLetter = gradeInfo ? gradeInfo.letter : 'F';
              
              return (
                <div 
                  key={subject.id} 
                  className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-rose-200/80 dark:border-rose-900/40 shadow-sm flex flex-col hover:border-rose-400 dark:hover:border-rose-700 transition-all group"
                >
                  {/* Card Header with Badges */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 pr-2 rtl:pr-0 rtl:pl-2">
                      <h4 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        {subject.name}
                      </h4>
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5 font-medium">
                        <span>{subject.code}</span>
                        <span>•</span>
                        <span>{subject.creditHours} {isAr ? 'ساعات' : 'Credits'}</span>
                        {selectedSemesterScope === 'all' && (
                          <>
                            <span>•</span>
                            <span>{isAr ? `سنة ${subject.yearIndex} ف${subject.semesterIndex}` : `Y${subject.yearIndex} S${subject.semesterIndex}`}</span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Dual Grade & GPA Display Badge */}
                    <div className="flex flex-col items-end rtl:items-start gap-1">
                      <div className="px-3 py-1.5 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-lg flex items-center justify-center shadow-xs">
                        {subjectLetter}
                      </div>
                      <span className="text-[11px] font-black text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/40">
                        {subjectPoints.toFixed(2)} GPA
                      </span>
                    </div>
                  </div>
                  
                  {/* Achievement & Progress Section */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl p-4 mb-4 flex-1 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-zinc-500 font-medium">{isAr ? 'الدرجة المحققة' : 'Achieved Marks'}</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {gradeInfo?.totalAchieved || 0} / {subject.totalMarks} ({Math.round(gradeInfo?.percentage || 0)}%)
                      </span>
                    </div>

                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-rose-500 to-rose-600 h-2.5 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.max(5, gradeInfo?.percentage || 0))}%` }}
                      ></div>
                    </div>

                    {/* Threshold Comparison Banner */}
                    <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">{isAr ? 'حد الإنذار:' : 'Warning Threshold:'}</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {currentLetter} ({currentPoints.toFixed(2)} GPA)
                      </span>
                    </div>

                    <div className="mt-2 text-xs font-semibold text-center text-rose-600 dark:text-rose-400">
                      {isFinished 
                        ? (isAr ? 'المادة منتهية ولم يعد بالإمكان تحسين درجاتها.' : 'Subject finished, cannot be modified.') 
                        : (isAr ? 'لا يزال بإمكانك تحسين درجاتك في هذه المادة!' : 'You can still improve your grades in this subject!')}
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <button 
                    onClick={() => navigate(`/academic/${subject.id}`)}
                    className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-xs group/btn"
                  >
                    <span>{isFinished ? (isAr ? 'عرض تفاصيل المادة' : 'View Details') : (isAr ? 'تحديث وتعديل الدرجات' : 'Update Grades')}</span>
                    <ChevronRight className="w-4 h-4 rtl:rotate-180 group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1 transition-transform" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-zinc-200 dark:border-zinc-800 flex flex-col items-center shadow-sm">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mb-4 ring-8 ring-emerald-50/50 dark:ring-emerald-950/20">
              <Target size={40} />
            </div>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-2">
              {isAr ? 'سجلك الأكاديمي سليم ومستقر!' : 'No Academic Warnings!'}
            </h3>
            <p className="text-zinc-500 max-w-md text-sm leading-relaxed">
              {isAr 
                ? `عمل رائع! جميع المواد المسجلة حققت تقديرات ومعدلات أعلى من حد الإنذار (${currentLetter} / ${currentPoints.toFixed(2)} GPA).` 
                : `Great job! All your subjects are currently performing above the warning threshold (${currentLetter} / ${currentPoints.toFixed(2)} GPA).`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

