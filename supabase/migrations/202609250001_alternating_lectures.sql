-- ==============================================================================
-- Migration: 202609250001_alternating_lectures.sql
--
-- المحاضرات التبادلية: زوجان من المحاضرات يتبادلان الظهور في الجدول حسب تاريخ
-- البداية والمدة. التخزين في settings بجانب semesters/grading_scale عشان
-- يتزامن بين الأجهزة ويشتغل مع النسخ الاحتياطي والاستعادة تلقائياً.
--
-- الشكل: [{ id, itemAId, itemBId, startItemId, startDate, intervalDays, active, createdAt }]
-- ==============================================================================

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS alternating_lectures JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
