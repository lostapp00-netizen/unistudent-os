-- ==============================================================================
-- Migration: 202609070001_available_years_and_spec_decoupling.sql
-- Adds available_years column to university_databases, and ensures specialization
-- columns exist on both university_databases and settings.
-- ==============================================================================

-- 1. Add available_years to university_databases
ALTER TABLE public.university_databases
ADD COLUMN IF NOT EXISTS available_years INTEGER[] DEFAULT ARRAY[1]::INTEGER[];

-- 2. Ensure specialization timing is available on general college databases as well
ALTER TABLE public.university_databases
ADD COLUMN IF NOT EXISTS specialization_start_year INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS specialization_start_semester INTEGER DEFAULT 1;

-- 3. Performance index
CREATE INDEX IF NOT EXISTS idx_udb_available_years ON public.university_databases USING gin(available_years);
