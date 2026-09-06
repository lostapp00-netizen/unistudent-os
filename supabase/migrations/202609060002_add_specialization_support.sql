-- ==============================================================================
-- Migration: 202609060002_add_specialization_support.sql
-- Adds specialization columns to university_databases and settings,
-- and updates sync_approved_university_database_to_students to support
-- both general college databases and specialization databases.
-- ==============================================================================

-- 1. Add specialization columns to university_databases
ALTER TABLE public.university_databases
ADD COLUMN IF NOT EXISTS is_specialization BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parent_database_id TEXT,
ADD COLUMN IF NOT EXISTS specialization_name_ar TEXT,
ADD COLUMN IF NOT EXISTS specialization_name_en TEXT,
ADD COLUMN IF NOT EXISTS specialization_start_year INTEGER,
ADD COLUMN IF NOT EXISTS specialization_start_semester INTEGER;

-- 2. Add specialization columns to settings
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS specialization TEXT,
ADD COLUMN IF NOT EXISTS specialization_start_year INTEGER,
ADD COLUMN IF NOT EXISTS specialization_start_semester INTEGER,
ADD COLUMN IF NOT EXISTS specialization_database_id TEXT;

-- 3. Add specialization columns to university_pending_updates
ALTER TABLE public.university_pending_updates
ADD COLUMN IF NOT EXISTS is_specialization BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS specialization_name TEXT;

-- 4. Upgrade sync_approved_university_database_to_students RPC
CREATE OR REPLACE FUNCTION public.sync_approved_university_database_to_students(
    p_university_database_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_udb RECORD;
    v_student RECORD;
    v_subject JSONB;
    v_file JSONB;
    v_template_subject_ids TEXT[] := ARRAY[]::TEXT[];
    v_template_file_ids TEXT[] := ARRAY[]::TEXT[];
    v_updated_students_count INT := 0;
    v_is_specialization BOOLEAN := FALSE;
BEGIN
    -- 1. Fetch the target university database
    SELECT * INTO v_udb
    FROM public.university_databases
    WHERE id = p_university_database_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'University database not found');
    END IF;

    v_is_specialization := COALESCE(v_udb.is_specialization, FALSE);

    -- Collect all template subject IDs and file IDs from the database record
    FOR v_subject IN SELECT * FROM jsonb_array_elements(COALESCE(v_udb.subjects, '[]'::jsonb))
    LOOP
        IF v_subject->>'id' IS NOT NULL THEN
            v_template_subject_ids := array_append(v_template_subject_ids, v_subject->>'id');
        END IF;
    END LOOP;

    FOR v_file IN SELECT * FROM jsonb_array_elements(COALESCE(v_udb.drive_files, '[]'::jsonb))
    LOOP
        IF v_file->>'id' IS NOT NULL THEN
            v_template_file_ids := array_append(v_template_file_ids, v_file->>'id');
        END IF;
    END LOOP;

    -- 2. Loop over subscribed students
    FOR v_student IN
        SELECT user_id, university_database_id, specialization_database_id, university, college, specialization
        FROM public.settings
        WHERE user_id IS NOT NULL
          AND user_id <> COALESCE(v_udb.source_user_id, '')
          AND (
              -- Specialization case:
              (v_is_specialization AND (
                  specialization_database_id = p_university_database_id
                  OR (
                      (university_database_id = v_udb.parent_database_id OR TRIM(college) = TRIM(v_udb.college_name_ar))
                      AND TRIM(COALESCE(specialization, '')) = TRIM(COALESCE(v_udb.specialization_name_ar, ''))
                  )
              ))
              -- General College case:
              OR (NOT v_is_specialization AND (
                  university_database_id = p_university_database_id
                  OR (
                      TRIM(university) = TRIM(v_udb.university_name_ar)
                      AND TRIM(college) = TRIM(v_udb.college_name_ar)
                  )
                  OR (
                      v_udb.university_name_en IS NOT NULL 
                      AND TRIM(university) = TRIM(v_udb.university_name_en)
                      AND TRIM(college) = TRIM(COALESCE(v_udb.college_name_en, v_udb.college_name_ar))
                  )
              ))
          )
    LOOP
        -- A. Heal / synchronize the database ID in student settings
        IF v_is_specialization THEN
            UPDATE public.settings
            SET specialization_database_id = p_university_database_id,
                specialization = COALESCE(v_udb.specialization_name_ar, specialization),
                updated_at = NOW()
            WHERE user_id = v_student.user_id;
        ELSE
            UPDATE public.settings
            SET university_database_id = p_university_database_id,
                grading_scale = CASE 
                    WHEN v_udb.grading_scale IS NOT NULL AND jsonb_array_length(v_udb.grading_scale) > 0 
                    THEN v_udb.grading_scale 
                    ELSE grading_scale 
                END,
                updated_at = NOW()
            WHERE user_id = v_student.user_id;
        END IF;

        -- B. Sync Template Subjects
        FOR v_subject IN SELECT * FROM jsonb_array_elements(COALESCE(v_udb.subjects, '[]'::jsonb))
        LOOP
            IF EXISTS (
                SELECT 1 FROM public.subjects
                WHERE user_id = v_student.user_id
                  AND (
                      university_template_id = (v_subject->>'id')
                      OR id = (v_subject->>'id')
                      OR (
                          COALESCE(v_subject->>'code', '') <> ''
                          AND code = (v_subject->>'code')
                          AND year_index = (v_subject->>'yearIndex')::int
                          AND semester_index = (v_subject->>'semesterIndex')::int
                      )
                      OR (
                          LOWER(TRIM(name)) = LOWER(TRIM(v_subject->>'name'))
                          AND year_index = (v_subject->>'yearIndex')::int
                          AND semester_index = (v_subject->>'semesterIndex')::int
                      )
                  )
            ) THEN
                UPDATE public.subjects
                SET name = v_subject->>'name',
                    code = COALESCE(v_subject->>'code', code),
                    credit_hours = COALESCE((v_subject->>'creditHours')::numeric, credit_hours),
                    total_marks = COALESCE((v_subject->>'totalMarks')::numeric, total_marks),
                    year_index = COALESCE((v_subject->>'yearIndex')::int, year_index),
                    semester_index = COALESCE((v_subject->>'semesterIndex')::int, semester_index),
                    university_template_id = v_subject->>'id',
                    include_in_gpa = COALESCE((v_subject->>'includeInGpa')::boolean, include_in_gpa),
                    updated_at = NOW()
                WHERE user_id = v_student.user_id
                  AND (
                      university_template_id = (v_subject->>'id')
                      OR id = (v_subject->>'id')
                      OR (
                          COALESCE(v_subject->>'code', '') <> ''
                          AND code = (v_subject->>'code')
                          AND year_index = (v_subject->>'yearIndex')::int
                          AND semester_index = (v_subject->>'semesterIndex')::int
                      )
                      OR (
                          LOWER(TRIM(name)) = LOWER(TRIM(v_subject->>'name'))
                          AND year_index = (v_subject->>'yearIndex')::int
                          AND semester_index = (v_subject->>'semesterIndex')::int
                      )
                  );
            ELSE
                INSERT INTO public.subjects (
                    id,
                    user_id,
                    university_template_id,
                    name,
                    code,
                    credit_hours,
                    total_marks,
                    year_index,
                    semester_index,
                    status,
                    include_in_gpa,
                    distributions,
                    created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid()::text,
                    v_student.user_id,
                    v_subject->>'id',
                    v_subject->>'name',
                    COALESCE(v_subject->>'code', ''),
                    COALESCE((v_subject->>'creditHours')::numeric, 3),
                    COALESCE((v_subject->>'totalMarks')::numeric, 100),
                    COALESCE((v_subject->>'yearIndex')::int, 1),
                    COALESCE((v_subject->>'semesterIndex')::int, 1),
                    COALESCE(v_subject->>'status', 'current'),
                    COALESCE((v_subject->>'includeInGpa')::boolean, true),
                    COALESCE(v_subject->'distributions', '[]'::jsonb),
                    NOW(),
                    NOW()
                );
            END IF;
        END LOOP;

        v_updated_students_count := v_updated_students_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated_students_count', v_updated_students_count,
        'database_id', p_university_database_id,
        'is_specialization', v_is_specialization
    );
END;
$$;
