-- ==============================================================================
-- UniStudent OS — University Cohorts (الدفعات الدراسية) لكل كلية
-- ==============================================================================
-- الفكرة: كل كلية بقت بتدعم أكتر من دفعة (سنة دراسية)، وكل دفعة عبارة عن
-- قاعدة بيانات كاملة مستقلة تمامًا عن الدفعات الأخرى.
--
-- التصميم: الدفعة = صف مستقل في university_databases (قاعدة بيانات كاملة)،
-- والأعمدة الأربعة الجديدة دي بتوصف الدفعة على الصفوف العامة (غير التخصصات):
--   cohort_name          اسم الدفعة مثل: دفعة 2026 - 2027
--   academic_year_start  بداية السنة الدراسية مثل: 2026
--   academic_year_end    نهاية السنة الدراسية مثل: 2027
--   cohort_notes         ملاحظات الأدمن على الدفعة
-- صفوف التخصصات (is_specialization = true) بترث الدفعة من صف الأب
-- (parent_database_id) فمش محتاجة قيم على صفوفها.
--
-- الترحيل: كل كلية موجودة حاليًا بتتحول تلقائيًا لدفعة واحدة باسم السنة
-- الدراسية الجارية، بدون أي تغيير في الـ id — فالطلاب المرتبطون
-- (settings.university_database_id) لا يتأثرون إطلاقًا.
--
-- طريقة التنفيذ: افتح Supabase Dashboard > SQL Editor والصق الملف كامل ثم Run.
-- تشغيله أكثر من مرة آمن تمامًا (كله IF NOT EXISTS / WHERE cohort_name IS NULL).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1) أعمدة وصف الدفعة على university_databases
-- ------------------------------------------------------------------------------
ALTER TABLE public.university_databases
ADD COLUMN IF NOT EXISTS cohort_name TEXT,
ADD COLUMN IF NOT EXISTS academic_year_start INTEGER,
ADD COLUMN IF NOT EXISTS academic_year_end INTEGER,
ADD COLUMN IF NOT EXISTS cohort_notes TEXT DEFAULT '';

-- ------------------------------------------------------------------------------
-- 2) ترحيل تلقائي: كل كلية عامة قديمة => دفعة واحدة باسم السنة الدراسية الجارية
--    السنة الدراسية بتبدأ من أغسطس (الشهر 8) زي العرف الجامعي في مصر.
--    الـ DO block بيشتغل حتى لو عمود is_specialization نفسه مش موجود بعد.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  ay_start INTEGER;
  has_spec_col BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'university_databases'
      AND column_name = 'is_specialization'
  ) INTO has_spec_col;

  ay_start := CAST(
    CASE
      WHEN EXTRACT(MONTH FROM now()) >= 8 THEN EXTRACT(YEAR FROM now())
      ELSE EXTRACT(YEAR FROM now()) - 1
    END AS INTEGER
  );

  IF has_spec_col THEN
    UPDATE public.university_databases
    SET cohort_name = 'دفعة ' || ay_start::text || ' - ' || (ay_start + 1)::text,
        academic_year_start = ay_start,
        academic_year_end = ay_start + 1,
        cohort_notes = COALESCE(cohort_notes, '')
    WHERE (is_specialization IS NOT TRUE)
      AND (cohort_name IS NULL OR cohort_name = '');
  ELSE
    UPDATE public.university_databases
    SET cohort_name = 'دفعة ' || ay_start::text || ' - ' || (ay_start + 1)::text,
        academic_year_start = ay_start,
        academic_year_end = ay_start + 1,
        cohort_notes = ''
    WHERE (cohort_name IS NULL OR cohort_name = '');
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3) تحديث كاش PostgREST — يضمن ظهور الأعمدة الجديدة فورًا لـ Supabase JS
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
