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
  const [showSettingsPanel, setShowSettingsPanel] = useState(true);

  const currentSemester = settings.semesters.find(s => s.isCurrent);
  const currentScale = settings.gradingScale || [];

  // Get current configured threshold
  const threshold = getWarningThreshold(settings);
  const currentLetter = threshold.letter;
  const currentPoints = threshold.points;

  // Sort grading scale for display (from high to low)
  const sortedScale = [...currentScale].sort((a, b) => b.points - a.points);

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

  // Handlers for bidirectional threshold updates
  const handleGradeLetterChange = (letter: string) => {
    const matchedRule = getMatchingGradeRuleByLetter(letter, settings.gradingScale);
    const points = matchedRule ? matchedRule.points : currentPoints;
    updateSettings({
      warningGradeLetter: letter,
      warningGpaPoints: points
    });
  };

  const handleGpaPointsChange = (val: number) => {
    // Clamp between 0 and max points in scale (or 4.0)
    const maxScalePoints = sortedScale.length > 0 ? Math.max(...sortedScale.map(r => r.points), 4.0) : 4.0;
    const clampedPoints = Math.max(0, Math.min(maxScalePoints, Number(val.toFixed(2))));
    const matchedRule = getMatchingGradeRuleByPoints(clampedPoints, settings.gradingScale);
    updateSettings({
      warningGradeLetter: matchedRule ? matchedRule.letter : currentLetter,
      warningGpaPoints: clampedPoints
    });
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

      {/* Warning Threshold Settings Card */}
      <section className="bg-gradient-to-br from-white via-zinc-50/50 to-amber-50/30 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-amber-950/20 rounded-3xl p-6 sm:p-7 border border-amber-200/80 dark:border-amber-900/40 shadow-sm transition-all">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {isAr ? 'إعدادات حد الإنذار الأكاديمي' : 'Academic Warning Threshold Settings'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isAr 
                  ? 'حدد التقدير أو معدل GPA المطلوب لإطلاق الإنذار، ويتم التحويل التلقائي بينهما' 
                  : 'Select either Grade Letter or GPA points, and they will automatically synchronize'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-amber-100/70 dark:bg-amber-900/30 px-3 py-1.5 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-bold">
            <Sparkles size={14} />
            <span>
              {isAr ? 'حد الإنذار الفعّال:' : 'Active Threshold:'} {currentLetter} ({currentPoints.toFixed(2)} GPA)
            </span>
          </div>
        </div>

        {/* Dual Input Controls: Grade Letter & GPA Points */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* 1. By Grade Letter */}
          <div className="bg-white/80 dark:bg-zinc-800/60 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 shadow-sm flex flex-col justify-between">
            <div>
              <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                {isAr ? '1. التحديد حسب التقدير (Letter Grade)' : '1. Select by Letter Grade'}
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                {isAr 
                  ? 'اختر التقدير الذي يعتبر تحته إنذاراً للمادة:' 
                  : 'Choose the grade letter threshold for warnings:'}
              </p>
              
              {/* Grade Pills */}
              <div className="flex flex-wrap gap-2">
                {sortedScale.map(grade => {
                  const isSelected = currentLetter === grade.letter;
                  return (
                    <button
                      key={grade.id}
                      type="button"
                      onClick={() => handleGradeLetterChange(grade.letter)}
                      className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-105 ring-2 ring-amber-400/30'
                          : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-600'
                      }`}
                    >
                      <span>{grade.letter}</span>
                      <span className={`text-[10px] font-medium opacity-80 ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                        ({grade.points.toFixed(1)})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-700/50 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>{isAr ? 'النقاط المقابلة في اللائحة:' : 'Equivalent points in scale:'}</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                {currentPoints.toFixed(2)} GPA
              </span>
            </div>
          </div>

          {/* 2. By GPA Points */}
          <div className="bg-white/80 dark:bg-zinc-800/60 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 shadow-sm flex flex-col justify-between">
            <div>
              <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                {isAr ? '2. التحديد حسب معدل النقاط (GPA Points)' : '2. Select by GPA Points'}
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                {isAr 
                  ? 'أدخل معدل النقاط المطلوب (مثال: 2.00 أو 1.70):' 
                  : 'Enter minimum GPA points threshold (e.g., 2.00 or 1.70):'}
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleGpaPointsChange(Math.max(0, currentPoints - 0.1))}
                  className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center text-lg shadow-sm"
                  title="-0.1"
                >
                  -
                </button>
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="4.0"
                    value={currentPoints}
                    onChange={(e) => handleGpaPointsChange(parseFloat(e.target.value) || 0)}
                    className="w-full text-center text-xl font-black py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <span className="absolute left-3 rtl:left-auto rtl:right-3 top-2.5 text-xs text-zinc-400 font-medium pointer-events-none">
                    GPA
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleGpaPointsChange(currentPoints + 0.1)}
                  className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center text-lg shadow-sm"
                  title="+0.1"
                >
                  +
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[11px] text-zinc-400 font-medium">{isAr ? 'قيم سريعة:' : 'Presets:'}</span>
                {[2.0, 1.7, 1.0, 2.3].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleGpaPointsChange(val)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      Math.abs(currentPoints - val) < 0.05
                        ? 'bg-amber-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {val.toFixed(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-700/50 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>{isAr ? 'التقدير الأقرب المطابق:' : 'Closest matching grade:'}</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                {currentLetter} ({getMatchingGradeRuleByLetter(currentLetter, settings.gradingScale)?.nameAr || getMatchingGradeRuleByLetter(currentLetter, settings.gradingScale)?.nameEn || ''})
              </span>
            </div>
          </div>
        </div>

        {/* Live Conversion Banner */}
        <div className="mt-5 p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/10 border border-amber-300/60 dark:border-amber-800/40 flex items-start sm:items-center gap-3 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
          <p className="leading-relaxed">
            {isAr ? (
              <>
                سيتم تصنيف أي مادة كـ <strong>إنذار أكاديمي</strong> إذا كان معدلها المحقق <strong>{currentPoints.toFixed(2)} أو أقل</strong> (يعادل تقدير <strong>{currentLetter} أو أقل</strong>).
              </>
            ) : (
              <>
                Any subject with achieved grade points of <strong>{currentPoints.toFixed(2)} or below</strong> (equivalent to grade <strong>{currentLetter} or below</strong>) will be flagged as an academic warning.
              </>
            )}
          </p>
        </div>
      </section>

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

