-- ==============================================================================
-- UniStudent OS — Migration: 202609330001_notification_public_write.sql
-- ==============================================================================
-- ليه الملف ده؟
--
-- لوحة الأدمن بتدخل بكريدنشل الأدمن من غير ما تعمل جلسة Supabase Auth
-- (شوف Auth.tsx: الـ bypass بيكتب sessionStorage ويحوّل على /admin على طول)،
-- يعني كل طلبات اللوحة بتروح بصلاحية anon. جدولين الإشعارات كانوا مسموحين
-- للكتابة لـ authenticated بس، فكل كتابة من اللوحة كانت بترجع
-- 401 / 42501 «new row violates row-level security policy»:
--
--   • تسجيل رسالة تحديث جديدة لما يحصل تغيير في قاعدة البيانات  → INSERT
--   • الموافقة / الرفض / التعديل على الرسالة                    → UPDATE
--   • مسح الرسالة (soft delete) وتصفير علامات القراءة           → UPDATE / DELETE
--
-- والنتيجة إن سجل رسائل التحديثات فضل فاضي دايمًا: مافيش رسايل تتوافق عليها أو
-- تترفض. الجداول التانية في المشروع (university_databases،
-- university_pending_updates، tasks، notes، settings…) مسموحة للـ public،
-- فالملف ده بيمشّي نفس النمط على جدولين الإشعارات وبس.
--
-- طريقة التنفيذ: Supabase Dashboard -> SQL Editor -> الصق الكود واضغط Run.
-- الكود آمن يتشغّل أكتر من مرة (DROP POLICY IF EXISTS قبل كل CREATE).
-- ==============================================================================

DROP POLICY IF EXISTS "allow public write student_notifications" ON public.student_notifications;
CREATE POLICY "allow public write student_notifications" ON public.student_notifications
FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow public write student_notification_reads" ON public.student_notification_reads;
CREATE POLICY "allow public write student_notification_reads" ON public.student_notification_reads
FOR ALL TO public USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
