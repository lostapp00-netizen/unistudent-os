-- ==============================================================================
-- Migration: 202609060003_fix_sync_student_scope.sql
-- Fixes over-broad student selection in sync_approved_university_database_to_students:
--   1. General college DB: students receive pushes ONLY via explicit
--      university_database_id link (drops university+college name matching).
--   2. Specialization DB: students receive pushes ONLY via explicit
--      specialization_database_id link, or an explicit college/university link
--      COMBINED with a non-empty exact specialization name match.
--   3. Phase filtering: general DB pushes foundation subjects only
--      (before spec milestone); spec DB pushes spec-phase subjects only.
--   4. No more bulk rewriting of students' university_database_id (no "heal").
-- ==============================================================================

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
    v_updated_students_count INT := 0;
    v_is_specialization BOOLEAN := FALSE;
    v_start_year INT := 2;
    v_start_sem INT := 1;
    v_in_phase BOOLEAN := FALSE;
BEGIN
    -- 1. Fetch the target university database
    SELECT * INTO v_udb
    FROM public.university_databases
    WHERE id = p_university_database_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'University database not found');
    END IF;

    v_is_specialization := COALESCE(v_udb.is_specialization, FALSE);
    v_start_year := COALESCE(v_udb.specialization_start_year, 2);
    v_start_sem := COALESCE(v_udb.specialization_start_semester, 1);

    -- 2. Loop over strictly-scoped subscribed students
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
                      AND COALESCE(specialization, '') <> ''
                      AND COALESCE(v_udb.specialization_name_ar, '') <> ''
                      AND TRIM(specialization) = TRIM(v_udb.specialization_name_ar)
                  )
              ))
              -- General College case: explicit ID link ONLY (no name matching)
              OR (NOT v_is_specialization AND (
                  university_database_id = p_university_database_id
              ))
          )
    LOOP
        -- B. Sync Template Subjects (phase-filtered)
        FOR v_subject IN SELECT * FROM jsonb_array_elements(COALESCE(v_udb.subjects, '[]'::jsonb))
        LOOP
            -- Phase filter: general DB pushes foundation subjects only,
            -- spec DB pushes spec-phase subjects only.
            v_in_phase :=
                (COALESCE((v_subject->>'yearIndex')::int, 1) > v_start_year)
                OR (COALESCE((v_subject->>'yearIndex')::int, 1) = v_start_year AND COALESCE((v_subject->>'semesterIndex')::int, 1) >= v_start_sem);

            IF NOT v_is_specialization THEN
                v_in_phase := NOT v_in_phase;
            END IF;

            IF NOT v_in_phase THEN
                CONTINUE;
            END IF;

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

REVOKE ALL ON FUNCTION public.sync_approved_university_database_to_students(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.sync_approved_university_database_to_students(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_approved_university_database_to_students(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.sync_approved_university_database_to_students(TEXT) TO service_role;
