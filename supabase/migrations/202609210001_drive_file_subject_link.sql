-- ==============================================================================
-- UniStudent OS — Migration: 202609210001_drive_file_subject_link.sql
-- ==============================================================================
-- الغرض من هذا التحديث:
-- 1) إضافة عمود subject_id إلى جدول public.drive_files لربط الملفات والمجلدات بالمواد
-- 2) إضافة أعمدة cohort_name و scope_type إلى جدول public.university_pending_updates
-- 3) إنشاء فهارس (Indexes) لتسريع استعلامات ملفات المواد وشجرة المجلدات
--
-- طريقة التنفيذ:
-- افتح Supabase Dashboard -> اختر مشروعك -> اضغط على SQL Editor في القائمة الجانبية -> الصق الكود واضغط Run.
-- ==============================================================================

-- 1) إضافة عمود subject_id إلى جدول ملفات ومجلدات الدرايف
ALTER TABLE public.drive_files
    ADD COLUMN IF NOT EXISTS subject_id TEXT;

-- إنشاء فهارس لتسريع البحث عن ملفات ومجلدات المادة
CREATE INDEX IF NOT EXISTS idx_drive_files_subject_id 
    ON public.drive_files (subject_id);

CREATE INDEX IF NOT EXISTS idx_drive_files_parent_subject 
    ON public.drive_files (parent_id, subject_id);

-- 2) إضافة أعمدة الدفعة ونطاق التعديل إلى جدول التحديثات المعلقة للأدمن
ALTER TABLE public.university_pending_updates
    ADD COLUMN IF NOT EXISTS cohort_name TEXT,
    ADD COLUMN IF NOT EXISTS scope_type TEXT;

-- 3) تحديث كاش PostgREST لضمان قراءة الأعمدة الجديدة فوراً في Supabase
NOTIFY pgrst, 'reload schema';
