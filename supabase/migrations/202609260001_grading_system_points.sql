-- ==============================================================================
-- Migration: 202609260001_grading_system_points.sql
--
-- نظام الحساب: الطالب يختار إما الحساب بالمعدل التراكمي (GPA) أو الحساب بالنقط.
-- في نظام النقط: كل نقطة = marks_per_point درجة، والتوتال = total_points نقطة،
-- وinitial_accumulated_marks هي الدرجات المجمعة قبل استخدام التطبيق.
--
-- كل ما سبق يُخزَّن في settings بجانب semesters/grading_scale عشان يتزامن بين
-- الأجهزة ويشتغل مع النسخ الاحتياطي والاستعادة تلقائياً. درجات المواد نفسها
-- (التقييمات) لا تتغير بين النظامين — دي المصدر الوحيد للبيانات.
-- ==============================================================================

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS grading_system TEXT DEFAULT 'gpa';

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS marks_per_point NUMERIC;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS total_points NUMERIC;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS initial_accumulated_marks NUMERIC;

NOTIFY pgrst, 'reload schema';
