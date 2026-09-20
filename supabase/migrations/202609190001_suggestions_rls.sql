-- ==============================================================================
-- UniStudent OS — Suggestions & Feedback Hub Schema + RLS Policies (IDEMPOTENT)
-- ==============================================================================
-- This script ensures the `suggestions` table exists with all necessary columns
-- for student complaints, feedback, bug reports, and 2-way admin conversations.
--
-- Running this file multiple times is completely safe.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.suggestions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT DEFAULT '',
    user_name TEXT DEFAULT '',
    type TEXT DEFAULT 'suggestion',
    title TEXT NOT NULL DEFAULT '',
    content TEXT DEFAULT '',
    attachments JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'new',
    admin_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all required columns exist
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS user_email TEXT DEFAULT '';
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS user_name TEXT DEFAULT '';
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'suggestion';
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT '';
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Index for performance
CREATE INDEX IF NOT EXISTS suggestions_user_id_idx ON public.suggestions (user_id);
CREATE INDEX IF NOT EXISTS suggestions_created_at_idx ON public.suggestions (created_at DESC);

-- Enable RLS and set permissive policies for students and admin
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow authenticated all suggestions" ON public.suggestions;
CREATE POLICY "allow authenticated all suggestions" ON public.suggestions
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow public read suggestions" ON public.suggestions;
CREATE POLICY "allow public read suggestions" ON public.suggestions
FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow public insert suggestions" ON public.suggestions;
CREATE POLICY "allow public insert suggestions" ON public.suggestions
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "allow public update suggestions" ON public.suggestions;
CREATE POLICY "allow public update suggestions" ON public.suggestions
FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow public delete suggestions" ON public.suggestions;
CREATE POLICY "allow public delete suggestions" ON public.suggestions
FOR DELETE USING (true);

-- Notify PostgREST schema reload
NOTIFY pgrst, 'reload schema';
