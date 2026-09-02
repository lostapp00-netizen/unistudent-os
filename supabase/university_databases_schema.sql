-- ==============================================================================
-- UniStudent OS - University Databases, Registered Universities & Sync Schema
-- ==============================================================================

-- 1. جدول الجامعات المسجلة ككيانات مستقلة (Registered Universities)
CREATE TABLE IF NOT EXISTS public.registered_universities (
    key TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.registered_universities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access registered_universities" ON public.registered_universities;
CREATE POLICY "Allow all access registered_universities" 
ON public.registered_universities FOR ALL 
USING (true)
WITH CHECK (true);


-- 2. جدول قواعد بيانات الجامعات والكليات (University Databases)
CREATE TABLE IF NOT EXISTS public.university_databases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    university_name_ar TEXT NOT NULL,
    university_name_en TEXT,
    college_name_ar TEXT NOT NULL,
    college_name_en TEXT,
    source_user_id TEXT,
    source_user_email TEXT,
    source_user_name TEXT,
    total_years INTEGER DEFAULT 4,
    semesters_per_year INTEGER DEFAULT 2,
    subjects JSONB DEFAULT '[]'::jsonb,
    drive_files JSONB DEFAULT '[]'::jsonb,
    grading_scale JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- تمكين RLS وسياسات الأمان
ALTER TABLE public.university_databases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read university_databases" ON public.university_databases;
CREATE POLICY "Allow public read university_databases" 
ON public.university_databases FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow all modifications university_databases" ON public.university_databases;
CREATE POLICY "Allow all modifications university_databases" 
ON public.university_databases FOR ALL 
USING (true)
WITH CHECK (true);


-- 3. جدول التحديثات المقترحة والمعلقة من الطلاب المصدر (Pending Updates)
CREATE TABLE IF NOT EXISTS public.university_pending_updates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    university_database_id TEXT,
    university_name TEXT,
    college_name TEXT,
    source_user_id TEXT,
    source_user_email TEXT,
    source_user_name TEXT,
    type TEXT,
    description TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- تمكين RLS وسياسات الأمان
ALTER TABLE public.university_pending_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access university_pending_updates" ON public.university_pending_updates;
CREATE POLICY "Allow all access university_pending_updates" 
ON public.university_pending_updates FOR ALL 
USING (true)
WITH CHECK (true);


-- 4. تحديث جدول إعدادات الطلاب (settings) لدعم ربط وتوثيق قاعدة بيانات الجامعة المستردة
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS university_database_id TEXT;

-- 5. التحقق من أعمدة جدول المواد (subjects) لضمان حفظ السنة والترم وتوزيع الدرجات بدقة
ALTER TABLE public.subjects 
ADD COLUMN IF NOT EXISTS year_index INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS semester_index INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS code TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS credit_hours NUMERIC DEFAULT 3,
ADD COLUMN IF NOT EXISTS total_marks NUMERIC DEFAULT 100,
ADD COLUMN IF NOT EXISTS distributions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS include_in_gpa BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS final_grade_letter TEXT;

