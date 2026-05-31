-- ============================================================
-- Maintenance Tasks Overhaul Migration
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- 1. Truncate existing data to avoid constraint/type mismatch issues
TRUNCATE TABLE public.maintenance RESTART IDENTITY CASCADE;

-- 2. Add new columns
ALTER TABLE public.maintenance 
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS completion_date date;

-- 3. Drop deprecated columns (used for asset tracking)
ALTER TABLE public.maintenance 
  DROP COLUMN IF EXISTS last_service_date,
  DROP COLUMN IF EXISTS next_due_date;

-- 4. Set Default Values (optional but safe for new tasks)
ALTER TABLE public.maintenance 
  ALTER COLUMN status SET DEFAULT 'Scheduled',
  ALTER COLUMN priority SET DEFAULT 'Medium';

