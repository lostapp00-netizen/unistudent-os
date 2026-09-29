-- ==============================================================================
-- UniStudent OS — Migration: 202609300001_student_notifications.sql
-- ==============================================================================
-- إشعارات الطلاب (جرس الإشعارات في الداش بورد) — بتنقسم لجزئين:
--
--   1) scope = 'database' — أي تغيير يحصل في قاعدة بيانات الجامعة اللي الطالب
--      عامل لها استرداد: إضافة / تعديل / حذف / تغيير اسم / نقل — سواء الأدمن
--      عملها بنفسه أو وافق على تحديث من الطالب اللي القاعدة مسحوبة منه.
--
--   2) scope = 'general'  — منشورات ورسائل الأدمن العامة (صفحة "المنشورات
--      والرسائل العامة")، وكمان الرسائل الموجهة لطالب واحد بعينه.
--
-- audience بيحدد مين يشوف الإشعار:
--   'all'      → كل الطلاب            (منشور عام)
--   'user'     → طالب واحد بعينه      (user_id)
--   'database' → كل طالب مربوط بالقاعدة المذكورة (university_database_id)
-- كده تغيير في قاعدة البيانات مش محتاج نسخة لكل طالب، وأي طالب يربط القاعدة
-- بعدين برضه بيشوف الإشعارات.
--
-- حالة القراءة لكل طالب لوحده في student_notification_reads (قرأ = read،
-- ما قرأش = unread)، وده اللي بيغذّي الكاونتر وعلامة unread.
--
-- طريقة التنفيذ: Supabase Dashboard -> SQL Editor -> الصق الكود واضغط Run.
-- الكود آمن يتشغّل أكتر من مرة (كل الأوامر IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ==============================================================================

-- 1) جدول الإشعارات
CREATE TABLE IF NOT EXISTS public.student_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    audience TEXT NOT NULL DEFAULT 'all',
    scope TEXT NOT NULL DEFAULT 'general',
    university_database_id TEXT,
    type TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT DEFAULT '',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS student_notifications_audience_idx
    ON public.student_notifications (audience, user_id);

CREATE INDEX IF NOT EXISTS student_notifications_database_idx
    ON public.student_notifications (university_database_id)
    WHERE university_database_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS student_notifications_updated_idx
    ON public.student_notifications (updated_at DESC);

-- 2) جدول حالة القراءة (لكل طالب على حدة)
CREATE TABLE IF NOT EXISTS public.student_notification_reads (
    notification_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    read_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS student_notification_reads_user_idx
    ON public.student_notification_reads (user_id);

-- 3) سياسات الوصول (نفس نمط باقي جداول المشروع: مفتوحة للمستخدمين المسجّلين)
ALTER TABLE public.student_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow authenticated all student_notifications" ON public.student_notifications;
CREATE POLICY "allow authenticated all student_notifications" ON public.student_notifications
FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow public read student_notifications" ON public.student_notifications;
CREATE POLICY "allow public read student_notifications" ON public.student_notifications
FOR SELECT USING (true);

ALTER TABLE public.student_notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow authenticated all student_notification_reads" ON public.student_notification_reads;
CREATE POLICY "allow authenticated all student_notification_reads" ON public.student_notification_reads
FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow public read student_notification_reads" ON public.student_notification_reads;
CREATE POLICY "allow public read student_notification_reads" ON public.student_notification_reads
FOR SELECT USING (true);

-- 4) تحديث كاش PostgREST
NOTIFY pgrst, 'reload schema';
