-- ==============================================================================
-- Migration: 202609270001_university_grading_system.sql
--
-- نظام الحساب على مستوى قاعدة بيانات الجامعة/الكلية: كل قاعدة بيانات (كلية عامة
-- أو دفعة أو تخصص) بتحمل نظامها (GPA أو نقط) وقيمة النقطة والتوتال. بيتسحب من
-- الطالب المصدر وقت الإنشاء، وبيتطبَّق على الطالب وقت الاسترداد، والأدمن يقدر
-- يعدّله.
--
-- ملاحظة: نفس القيم بتتحفظ كنسخة احتياطية داخل صف الميتا (__college_meta__ /
-- __spec_meta__) جوه grading_scale، فالتطبيق شغال حتى قبل تنفيذ الـ migration دي
-- — الأعمدة دي بتخلي الفلترة والقراءة أسرع وأنضف.
-- ==============================================================================

ALTER TABLE public.university_databases
  ADD COLUMN IF NOT EXISTS grading_system TEXT;

ALTER TABLE public.university_databases
  ADD COLUMN IF NOT EXISTS marks_per_point NUMERIC;

ALTER TABLE public.university_databases
  ADD COLUMN IF NOT EXISTS total_points NUMERIC;

-- ──────────────────────────────────────────────────────────────────────────────
-- Extend the scalar allow-list of the item-level patch writer so the new columns
-- can actually be written through apply_university_database_patch().
-- (The function skips any key whose column does not exist, so this is safe on
-- older deployments as well.)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.write_university_database_arrays(
  p_id text,
  p_drive_files jsonb,
  p_subjects jsonb,
  p_grading_scale jsonb,
  p_scalars jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'university_name_ar','university_name_en','college_name_ar','college_name_en',
    'cohort_name','cohort_notes','source_user_id','source_user_name','source_user_email',
    'total_years','semesters_per_year','specialization_start_year','specialization_start_semester',
    'is_visible','is_specialization','parent_database_id','specialization_name_ar','specialization_name_en',
    'academic_year_start','academic_year_end',
    'grading_system','marks_per_point','total_points'
  ];
  v_key text;
  v_val jsonb;
  v_sets text := '';
  v_available_years integer[];
BEGIN
  -- Allow explicit array changes inside this sanctioned transaction only.
  PERFORM set_config('app.university_patch', 'on', true);

  IF p_scalars IS NOT NULL AND jsonb_typeof(p_scalars) = 'object' THEN
    IF p_scalars ? 'available_years' THEN
      v_available_years := ARRAY(SELECT jsonb_array_elements_text(p_scalars->'available_years'))::integer[];
    END IF;

    FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_scalars) LOOP
      IF NOT (v_key = ANY(v_allowed)) THEN
        CONTINUE;
      END IF;
      -- Optional columns (added by later migrations) may not exist on older
      -- deployments — skip them instead of failing the whole write.
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'university_databases'
          AND column_name = v_key
      ) THEN
        CONTINUE;
      END IF;
      v_sets := v_sets || format('%I = %s, ', v_key, quote_nullable(v_val #>> '{}'));
    END LOOP;
  END IF;

  IF v_available_years IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'university_databases'
      AND column_name = 'available_years'
  ) THEN
    v_sets := v_sets || format('available_years = %L, ', v_available_years);
  END IF;

  EXECUTE format(
    'UPDATE public.university_databases SET %s drive_files = %L::jsonb, subjects = %L::jsonb, grading_scale = %L::jsonb, updated_at = now() WHERE id = %L',
    v_sets,
    COALESCE(p_drive_files, '[]'::jsonb)::text,
    COALESCE(p_subjects, '[]'::jsonb)::text,
    COALESCE(p_grading_scale, '[]'::jsonb)::text,
    p_id
  );

  RETURN jsonb_build_object(
    'id', p_id,
    'drive_files', COALESCE(p_drive_files, '[]'::jsonb),
    'subjects', COALESCE(p_subjects, '[]'::jsonb),
    'grading_scale', COALESCE(p_grading_scale, '[]'::jsonb)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';