-- ==============================================================================
-- Migration: 202609240001_university_database_item_patch.sql
--
-- المشكلة: كل تحديث على university_databases كان يبعت drive_files / subjects
-- كمصفوفة كاملة مبنية من لقطة العميل. لو اللقطة قديمة أو ناقصة (سباق زمني أو
-- عنصر جديد نزل بعد آخر قراءة) كان أي عنصر غايب منها بيتمسح بصمت.
-- والتريجر القديم كان بيقارن الأعداد فقط، فمقدرش يكتشف استبدال بنفس العدد
-- (عنصر يختفي وعنصر آخر يحل مكانه).
--
-- الحل:
--   1) apply_university_database_patch(...)  → upsert بالمعرّف + حذف بالمعرّفات
--      الصريحة فقط. غياب عنصر من الـ patch = لا يعني حذفه أبداً.
--   2) replace_university_database_arrays(...) → استبدال كامل صريح ومقصود
--      (تغيير الطالب المصدر / إعادة بناء القاعدة).
--   3) التريجر: أي UPDATE يقلل العناصر بدون المرور على الدوال دي يترفض بـ Exception
--      واضح بدل التراجع الصامت.
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1) Helper: upsert by id inside a jsonb array
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.jsonb_upsert_by_id(p_base jsonb, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result jsonb := COALESCE(p_base, '[]'::jsonb);
  v_item jsonb;
  v_idx int;
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'array' THEN
    RETURN v_result;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_patch) LOOP
    IF COALESCE(v_item->>'id', '') = '' THEN
      CONTINUE;
    END IF;

    SELECT (t.ord - 1)::int INTO v_idx
    FROM jsonb_array_elements(v_result) WITH ORDINALITY AS t(e, ord)
    WHERE t.e->>'id' = v_item->>'id'
    LIMIT 1;

    IF v_idx IS NULL THEN
      v_result := v_result || jsonb_build_array(v_item);
    ELSE
      v_result := jsonb_set(v_result, ARRAY[v_idx::text], (v_result -> v_idx) || v_item, true);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2) Helper: remove items by id (no cascade)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.jsonb_remove_ids(p_base jsonb, p_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_removed text[] := COALESCE(p_ids, ARRAY[]::text[]);
  v_result jsonb;
BEGIN
  IF array_length(v_removed, 1) IS NULL THEN
    RETURN COALESCE(p_base, '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO v_result
  FROM jsonb_array_elements(COALESCE(p_base, '[]'::jsonb)) e
  WHERE COALESCE(e->>'id', '') <> ALL(v_removed);

  RETURN v_result;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3) Helper: remove drive items by id + cascade folders' descendants
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.jsonb_remove_drive_ids(p_base jsonb, p_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_removed text[] := COALESCE(p_ids, ARRAY[]::text[]);
  v_children text[];
BEGIN
  IF array_length(v_removed, 1) IS NULL THEN
    RETURN COALESCE(p_base, '[]'::jsonb);
  END IF;

  -- Expand the removed set with every descendant of a removed folder.
  LOOP
    SELECT COALESCE(array_agg(DISTINCT c->>'id'), ARRAY[]::text[]) INTO v_children
    FROM jsonb_array_elements(COALESCE(p_base, '[]'::jsonb)) c
    WHERE COALESCE(c->>'parentId', c->>'parent_id') = ANY(v_removed)
      AND COALESCE(c->>'id', '') <> ''
      AND NOT (COALESCE(c->>'id', '') = ANY(v_removed));

    EXIT WHEN array_length(v_children, 1) IS NULL;

    v_removed := v_removed || v_children;
  END LOOP;

  RETURN public.jsonb_remove_ids(p_base, v_removed);
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4) Internal writer: final arrays + scalars, in ONE atomic UPDATE
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
    'academic_year_start','academic_year_end'
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

-- ──────────────────────────────────────────────────────────────────────────────
-- 5) Public RPC: item-level patch (the normal write path)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_university_database_patch(
  p_id text,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_removed_drive_file_ids text[] DEFAULT NULL,
  p_removed_subject_ids text[] DEFAULT NULL,
  p_removed_grading_scale_ids text[] DEFAULT NULL,
  p_scalars jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.university_databases%ROWTYPE;
  v_drive jsonb;
  v_subjects jsonb;
  v_scale jsonb;
BEGIN
  SELECT * INTO v_row FROM public.university_databases WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'university_databases row % not found', p_id;
  END IF;

  v_drive := public.jsonb_upsert_by_id(COALESCE(v_row.drive_files, '[]'::jsonb), p_patch->'driveFiles');
  v_drive := public.jsonb_remove_drive_ids(v_drive, p_removed_drive_file_ids);

  v_subjects := public.jsonb_upsert_by_id(COALESCE(v_row.subjects, '[]'::jsonb), p_patch->'subjects');
  v_subjects := public.jsonb_remove_ids(v_subjects, p_removed_subject_ids);

  v_scale := public.jsonb_upsert_by_id(COALESCE(v_row.grading_scale, '[]'::jsonb), p_patch->'gradingScale');
  v_scale := public.jsonb_remove_ids(v_scale, p_removed_grading_scale_ids);

  RETURN public.write_university_database_arrays(p_id, v_drive, v_subjects, v_scale, p_scalars);
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6) Public RPC: explicit full replacement (switch source student, rebuild)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.replace_university_database_arrays(
  p_id text,
  p_drive_files jsonb DEFAULT NULL,
  p_subjects jsonb DEFAULT NULL,
  p_grading_scale jsonb DEFAULT NULL,
  p_scalars jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.university_databases%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.university_databases WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'university_databases row % not found', p_id;
  END IF;

  RETURN public.write_university_database_arrays(
    p_id,
    COALESCE(p_drive_files, v_row.drive_files, '[]'::jsonb),
    COALESCE(p_subjects, v_row.subjects, '[]'::jsonb),
    COALESCE(p_grading_scale, v_row.grading_scale, '[]'::jsonb),
    p_scalars
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 7) Guard trigger: no unexplained array reduction, ever
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_university_db_arrays()
RETURNS TRIGGER AS $$
DECLARE
  v_sanctioned text := current_setting('app.university_patch', true);
  old_df_count int;
  new_df_count int;
  old_subj_count int;
  new_subj_count int;
  old_scale_count int;
  new_scale_count int;
BEGIN
  -- Writes coming from the sanctioned RPCs are allowed to remove items
  -- (the RPC already validated the explicit removal ids).
  IF v_sanctioned = 'on' THEN
    RETURN NEW;
  END IF;

  old_df_count := jsonb_array_length(COALESCE(OLD.drive_files, '[]'::jsonb));
  new_df_count := jsonb_array_length(COALESCE(NEW.drive_files, '[]'::jsonb));
  IF new_df_count < old_df_count THEN
    RAISE EXCEPTION 'Blocked: drive_files % -> % for id=% — use apply_university_database_patch() to remove items explicitly',
      old_df_count, new_df_count, NEW.id;
  END IF;

  old_subj_count := jsonb_array_length(COALESCE(OLD.subjects, '[]'::jsonb));
  new_subj_count := jsonb_array_length(COALESCE(NEW.subjects, '[]'::jsonb));
  IF new_subj_count < old_subj_count THEN
    RAISE EXCEPTION 'Blocked: subjects % -> % for id=% — use apply_university_database_patch() to remove items explicitly',
      old_subj_count, new_subj_count, NEW.id;
  END IF;

  old_scale_count := jsonb_array_length(COALESCE(OLD.grading_scale, '[]'::jsonb));
  new_scale_count := jsonb_array_length(COALESCE(NEW.grading_scale, '[]'::jsonb));
  IF new_scale_count < old_scale_count THEN
    RAISE EXCEPTION 'Blocked: grading_scale % -> % for id=% — use apply_university_database_patch() to remove items explicitly',
      old_scale_count, new_scale_count, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_university_db_arrays_trigger ON public.university_databases;

CREATE TRIGGER protect_university_db_arrays_trigger
  BEFORE UPDATE ON public.university_databases
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_university_db_arrays();

-- ──────────────────────────────────────────────────────────────────────────────
-- 8) Grants + schema reload
-- ──────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.apply_university_database_patch(text, jsonb, text[], text[], text[], jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_university_database_arrays(text, jsonb, jsonb, jsonb, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
