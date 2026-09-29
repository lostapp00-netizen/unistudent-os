-- ==============================================================================
-- UniStudent OS — Migration: 202609310001_pending_updates_activity.sql
-- ==============================================================================
-- المشكلة: طلب التعديل اللي بييجي من الطالب المصدر بيتسجّل مرة واحدة (created_at)،
-- ولو الطالب عدّل نفس العنصر تاني قبل الموافقة، الكود بيحدّث نفس السطر (عشان
-- مايبقاش فيه نسختين من نفس التعديل). النتيجة: الطلب بيبقى بنفس التاريخ القديم
-- وبيقع في آخر القايمة عند الأدمن، فبيبان كإن التحديث "ما وصلش" أصلاً.
--
-- الحل: عمود updated_at بيتحدّث مع كل تعديل، والأدمن بيرتّب القايمة عليه — يعني
-- أي طلب جديد أو معدَّل بيطلع فوق على طول.
--
-- طريقة التنفيذ: Supabase Dashboard -> SQL Editor -> الصق الكود واضغط Run.
-- آمن يتشغّل أكتر من مرة.
-- ==============================================================================

ALTER TABLE public.university_pending_updates
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- الطلبات القديمة: اعتبر آخر نشاط هو وقت الحل (لو اتحلّت) وإلا وقت الإنشاء.
UPDATE public.university_pending_updates
   SET updated_at = COALESCE(resolved_at, created_at, now())
 WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS university_pending_updates_activity_idx
    ON public.university_pending_updates (updated_at DESC);

NOTIFY pgrst, 'reload schema';
