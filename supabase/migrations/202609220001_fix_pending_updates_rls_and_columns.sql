-- ==============================================================================
-- UniStudent OS — Migration: 202609220001_fix_pending_updates_rls_and_columns.sql
-- ==============================================================================
-- الغرض من هذا التحديث:
-- 1) التأكد من وجود كافة أعمدة جدول التحديثات المعلقة (public.university_pending_updates)
--    بما في ذلك اسم الجامعة، الكلية، الدفعة، التخصص، النطاق والمصدر
-- 2) تمكين وتجديد سياسة الأمان (RLS Policy) للسماح للطلاب بإرسال التحديثات المقترحة
--    وللأدمن بمراجعتها والموافقة عليها دون أي قيود صلاحيات
-- 3) إضافة الفهارس لتسريع استرجاع التحديثات المعلقة للأدمن
--
-- طريقة التنفيذ:
-- افتح Supabase Dashboard -> اختر مشروعك -> اضغط على SQL Editor -> الصق الكود واضغط Run.
-- ==============================================================================

-- 1. التأكد من إنشاء الجدول وكافة أعمدته
CREATE TABLE IF NOT EXISTS public.university_pending_updates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    university_database_id TEXT,
    university_name TEXT,
    college_name TEXT,
    cohort_name TEXT,
    is_specialization BOOLEAN DEFAULT FALSE,
    specialization_name TEXT,
    scope_type TEXT DEFAULT 'general',
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

-- التأكد من إضافة الأعمدة في حال كان الجدول منشأ مسبقاً
ALTER TABLE public.university_pending_updates
    ADD COLUMN IF NOT EXISTS university_name TEXT,
    ADD COLUMN IF NOT EXISTS college_name TEXT,
    ADD COLUMN IF NOT EXISTS cohort_name TEXT,
    ADD COLUMN IF NOT EXISTS is_specialization BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS specialization_name TEXT,
    ADD COLUMN IF NOT EXISTS scope_type TEXT DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS source_user_id TEXT,
    ADD COLUMN IF NOT EXISTS source_user_email TEXT,
    ADD COLUMN IF NOT EXISTS source_user_name TEXT,
    ADD COLUMN IF NOT EXISTS type TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 2. تمكين RLS وسياسات الصلاحيات للجدول
ALTER TABLE public.university_pending_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access university_pending_updates" ON public.university_pending_updates;
DROP POLICY IF EXISTS "Enable all operations for university_pending_updates" ON public.university_pending_updates;

CREATE POLICY "Allow all access university_pending_updates"
    ON public.university_pending_updates
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 3. إنشاء فهارس البحث والتصفية
CREATE INDEX IF NOT EXISTS idx_pending_updates_db_status 
    ON public.university_pending_updates (university_database_id, status);

CREATE INDEX IF NOT EXISTS idx_pending_updates_source 
    ON public.university_pending_updates (source_user_id, status);

CREATE INDEX IF NOT EXISTS idx_pending_updates_created 
    ON public.university_pending_updates (created_at DESC);

-- 4. إشعار PostgREST بتحديث المخطط فوراً
NOTIFY pgrst, 'reload schema';
