-- ==============================================================================
-- Migration: 202609060004_drive_file_phase.sql
-- Adds year/semester phase metadata to drive_files so source-student uploads
-- can be routed to the correct university database (general vs specialization).
-- ==============================================================================

ALTER TABLE public.drive_files
    ADD COLUMN IF NOT EXISTS year_index INT,
    ADD COLUMN IF NOT EXISTS semester_index INT;
