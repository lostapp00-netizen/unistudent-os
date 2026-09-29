-- ==============================================================================
-- UniStudent OS — Migration: 202609320001_notification_review.sql
-- ==============================================================================
-- رسائل التحديثات بقت محتاجة موافقة الأدمن قبل ما تتبعت للطلاب:
--
--   review_state = 'pending'  → مستنية قرار الأدمن (مش بتظهر لأي طالب)
--   review_state = 'approved' → اتبعتت (بتظهر لطلاب القاعدة)
--   review_state = 'rejected' → الأدمن رفضها (متتبعتش)
--
-- المنشورات العامة اللي الأدمن بيكتبها بنفسه بتتسجّل 'approved' على طول لأنه هو
-- اللي كتبها. الرسائل القديمة كلها بتتعامل كـ 'approved' (default) فمفيش حاجة
-- هتختفي من عند الطلاب.
--
-- طريقة التنفيذ: Supabase Dashboard -> SQL Editor -> الصق الكود واضغط Run.
-- آمن يتشغّل أكتر من مرة.
-- ==============================================================================

ALTER TABLE public.student_notifications
    ADD COLUMN IF NOT EXISTS review_state TEXT DEFAULT 'approved';

UPDATE public.student_notifications
   SET review_state = 'approved'
 WHERE review_state IS NULL;

CREATE INDEX IF NOT EXISTS student_notifications_review_idx
    ON public.student_notifications (review_state, updated_at DESC);

NOTIFY pgrst, 'reload schema';
