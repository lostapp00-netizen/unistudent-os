-- ==============================================================================
-- UniStudent OS — Core tables: schema guard + RLS policies (IDEMPOTENT)
-- ==============================================================================
-- المشكلة: الجداول الأساسية (settings/subjects/tasks/notes/appointments/
-- schedule_items/groups/drive_files) كانت بتتنشأ يدويًا في Supabase ومن غير
-- سياسات RLS، فأي إضافة أو حذف من الموقع كان بيفشل بصمت:
--   - إضافة + ريفرش  => العنصر بيختفي
--   - حذف + ريفرش    => العنصر بيرجع
--
-- الحل: تشغيل RLS + سياسات واسعة للمستخدم المسجل (نفس نمط سياسات جداول
-- الجامعات الموجودة في university_databases_schema.sql)، وضمان وجود كل
-- الأعمدة اللي الكود بيكتبها.
--
-- طريقة التنفيذ: افتح Supabase Dashboard > SQL Editor والصق الملف كامل ثم Run.
-- تشغيله أكثر من مرة آمن تمامًا (كله IF NOT EXISTS / DROP+CREATE POLICY).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1) settings — بيانات الطالب (الاسم/الإيميل/الربط بقاعدة الجامعة)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
    user_id TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    university TEXT DEFAULT '',
    college TEXT DEFAULT '',
    specialization TEXT DEFAULT '',
    university_database_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS specialization TEXT DEFAULT '';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS specialization_start_year INTEGER;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS specialization_start_semester INTEGER;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS specialization_database_id TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS university_database_id TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS grading_scale JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS semesters JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS available_years INTEGER[] DEFAULT ARRAY[1,2,3,4]::INTEGER[];
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow authenticated all settings" ON public.settings;
CREATE POLICY "allow authenticated all settings" ON public.settings
FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow public read settings" ON public.settings;
CREATE POLICY "allow public read settings" ON public.settings
FOR SELECT USING (true);

-- ------------------------------------------------------------------------------
-- 2) subjects — المواد وتقسيم الدرجات (distributions = الدرجات)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT DEFAULT '',
    credit_hours NUMERIC DEFAULT 3,
    total_marks NUMERIC DEFAULT 100,
    year_index INTEGER DEFAULT 1,
    semester_index INTEGER DEFAULT 1,
    status TEXT DEFAULT 'current',
    distributions JSONB DEFAULT '[]'::jsonb,
    include_in_gpa BOOLEAN DEFAULT true,
    final_grade_letter TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS code TEXT DEFAULT '';
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS credit_hours NUMERIC DEFAULT 3;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS total_marks NUMERIC DEFAULT 100;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS year_index INTEGER DEFAULT 1;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS semester_index INTEGER DEFAULT 1;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'current';
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS distributions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS include_in_gpa BOOLEAN DEFAULT true;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS final_grade_letter TEXT;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS university_template_id TEXT;

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow authenticated all subjects" ON public.subjects;
CREATE POLICY "allow authenticated all subjects" ON public.subjects
FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow public read subjects" ON public.subjects;
CREATE POLICY "allow public read subjects" ON public.subjects
FOR SELECT USING (true);

-- ------------------------------------------------------------------------------
-- 3) tasks — المهام
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    date TEXT,
    completed BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'medium',
    type TEXT DEFAULT 'task',
    group_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'task';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS group_id TEXT;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow authenticated all tasks" ON public.tasks;
CREATE POLICY "allow authenticated all tasks" ON public.tasks
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4) notes — الملاحظات
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    date TEXT,
    group_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS group_id TEXT;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow authenticated all notes" ON public.notes;
CREATE POLICY "allow authenticated all notes" ON public.notes
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5) appointments — المواعيد
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'task',
    date TEXT,
    time TEXT,
    location TEXT DEFAULT '',
    doctor_name TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    group_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'task';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_name TEXT DEFAULT '';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS group_id TEXT;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow authenticated all appointments" ON public.appointments;
CREATE POLICY "allow authenticated all appointments" ON public.appointments
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6) schedule_items — الجدول (محاضرات/سكاشن/لابات) — instructor = اسم الدكتور
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subject_id TEXT,
    day INTEGER DEFAULT 0,
    start_time TEXT DEFAULT '',
    end_time TEXT DEFAULT '',
    location TEXT DEFAULT '',
    type TEXT DEFAULT 'lecture',
    instructor TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS subject_id TEXT;
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS day INTEGER DEFAULT 0;
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '';
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT '';
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'lecture';
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS instructor TEXT DEFAULT '';

ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow authenticated all schedule_items" ON public.schedule_items;
CREATE POLICY "allow authenticated all schedule_items" ON public.schedule_items
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7) groups — مجموعات الألوان
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'indigo',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'indigo';

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow authenticated all groups" ON public.groups;
CREATE POLICY "allow authenticated all groups" ON public.groups
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 8) drive_files — الدرايف (فولدرات وملفات)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drive_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size BIGINT DEFAULT 0,
    type TEXT DEFAULT 'file',
    url TEXT DEFAULT '',
    upload_date TEXT,
    b2_file_id TEXT,
    parent_id TEXT,
    year_index INTEGER,
    semester_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.drive_files ADD COLUMN IF NOT EXISTS size BIGINT DEFAULT 0;
ALTER TABLE public.drive_files ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'file';
ALTER TABLE public.drive_files ADD COLUMN IF NOT EXISTS url TEXT DEFAULT '';
ALTER TABLE public.drive_files ADD COLUMN IF NOT EXISTS upload_date TEXT;
ALTER TABLE public.drive_files ADD COLUMN IF NOT EXISTS b2_file_id TEXT;
ALTER TABLE public.drive_files ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE public.drive_files ADD COLUMN IF NOT EXISTS year_index INTEGER;
ALTER TABLE public.drive_files ADD COLUMN IF NOT EXISTS semester_index INTEGER;

ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow authenticated all drive_files" ON public.drive_files;
CREATE POLICY "allow authenticated all drive_files" ON public.drive_files
FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow public read drive_files" ON public.drive_files;
CREATE POLICY "allow public read drive_files" ON public.drive_files
FOR SELECT USING (true);

-- ------------------------------------------------------------------------------
-- 9) إعادة تأكيد سياسات جداول الجامعات (عشان لو الـ schema القديم متطبقش)
-- ------------------------------------------------------------------------------
ALTER TABLE public.registered_universities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access registered_universities" ON public.registered_universities;
CREATE POLICY "Allow all access registered_universities" ON public.registered_universities
FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.university_databases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read university_databases" ON public.university_databases;
CREATE POLICY "Allow public read university_databases" ON public.university_databases
FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all modifications university_databases" ON public.university_databases;
CREATE POLICY "Allow all modifications university_databases" ON public.university_databases
FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.university_pending_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access university_pending_updates" ON public.university_pending_updates;
CREATE POLICY "Allow all access university_pending_updates" ON public.university_pending_updates
FOR ALL USING (true) WITH CHECK (true);
