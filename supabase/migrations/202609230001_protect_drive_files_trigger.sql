-- ==============================================================================
-- Migration: 202609230001_protect_drive_files_trigger.sql
-- 
-- حماية drive_files و subjects من المسح العرضي
-- 
-- المشكلة: أي UPDATE على university_databases ممكن يبعت drive_files: []
-- (بسبب race condition أو stale cache في JavaScript) ويمسح كل الملفات.
--
-- الحل: trigger على مستوى الداتابيز يمنع أي UPDATE يقلل عدد العناصر.
-- الطريقة الوحيدة لحذف ملف: تبعت array أقل بعنصر واحد بس (حذف فردي).
-- أي محاولة لتقليل أكتر من كده بيتم حجبها تلقائياً.
-- ==============================================================================

-- 1) Create the protection function
CREATE OR REPLACE FUNCTION public.protect_university_db_arrays()
RETURNS TRIGGER AS $$
DECLARE
  old_df_count INT;
  new_df_count INT;
  old_subj_count INT;
  new_subj_count INT;
BEGIN
  -- ── Protect drive_files ──
  old_df_count := jsonb_array_length(COALESCE(OLD.drive_files, '[]'::jsonb));
  new_df_count := jsonb_array_length(COALESCE(NEW.drive_files, '[]'::jsonb));
  
  -- Block if: old has items AND new would lose more than 1 item
  -- (legitimate single-file deletion = lose 1; bug/race = lose many or all)
  IF old_df_count > 1 AND new_df_count < (old_df_count - 1) THEN
    RAISE WARNING '[protect_university_db] BLOCKED drive_files reduction: % -> % for id=%',
      old_df_count, new_df_count, NEW.id;
    NEW.drive_files := OLD.drive_files;
  END IF;
  
  -- Special case: going from any count to 0 is ALWAYS blocked
  IF old_df_count > 0 AND new_df_count = 0 THEN
    RAISE WARNING '[protect_university_db] BLOCKED drive_files wipe: % -> 0 for id=%',
      old_df_count, NEW.id;
    NEW.drive_files := OLD.drive_files;
  END IF;

  -- ── Protect subjects ──
  old_subj_count := jsonb_array_length(COALESCE(OLD.subjects, '[]'::jsonb));
  new_subj_count := jsonb_array_length(COALESCE(NEW.subjects, '[]'::jsonb));
  
  IF old_subj_count > 1 AND new_subj_count < (old_subj_count - 1) THEN
    RAISE WARNING '[protect_university_db] BLOCKED subjects reduction: % -> % for id=%',
      old_subj_count, new_subj_count, NEW.id;
    NEW.subjects := OLD.subjects;
  END IF;

  IF old_subj_count > 0 AND new_subj_count = 0 THEN
    RAISE WARNING '[protect_university_db] BLOCKED subjects wipe: % -> 0 for id=%',
      old_subj_count, NEW.id;
    NEW.subjects := OLD.subjects;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Drop old trigger if exists, then create
DROP TRIGGER IF EXISTS protect_university_db_arrays_trigger ON public.university_databases;

CREATE TRIGGER protect_university_db_arrays_trigger
  BEFORE UPDATE ON public.university_databases
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_university_db_arrays();

-- 3) Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
