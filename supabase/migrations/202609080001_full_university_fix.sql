-- ==============================================================================
-- Migration: 202609080001_full_university_fix.sql
-- Comprehensive schema fix for UniStudent OS:
-- 1. Available years & Specialization timing columns in university_databases
-- 2. Specialization timing columns in settings
-- 3. Duplicate prevention index in university_pending_updates
-- ==============================================================================

-- 1. university_databases columns
ALTER TABLE public.university_databases
ADD COLUMN IF NOT EXISTS available_years INTEGER[] DEFAULT ARRAY[1]::INTEGER[],
ADD COLUMN IF NOT EXISTS is_specialization BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parent_database_id TEXT,
ADD COLUMN IF NOT EXISTS specialization_name_ar TEXT,
ADD COLUMN IF NOT EXISTS specialization_name_en TEXT,
ADD COLUMN IF NOT EXISTS specialization_start_year INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS specialization_start_semester INTEGER DEFAULT 1;

-- 2. settings columns for student profile restore
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS specialization TEXT,
ADD COLUMN IF NOT EXISTS specialization_start_year INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS specialization_start_semester INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS specialization_database_id TEXT;

-- 3. university_pending_updates metadata columns
ALTER TABLE public.university_pending_updates
ADD COLUMN IF NOT EXISTS is_specialization BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS specialization_name TEXT;

-- 4. Performance & Deduplication indexes
CREATE INDEX IF NOT EXISTS idx_udb_available_years ON public.university_databases USING gin(available_years);
CREATE INDEX IF NOT EXISTS idx_udb_parent_database_id ON public.university_databases(parent_database_id);
CREATE INDEX IF NOT EXISTS idx_settings_specialization_db_id ON public.settings(specialization_database_id);

-- Optional partial index to help database-level deduplication for pending updates
CREATE INDEX IF NOT EXISTS idx_pending_updates_active ON public.university_pending_updates (university_database_id, type, status);
