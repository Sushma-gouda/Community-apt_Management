-- =====================================================================
-- FIX: Maintenance Table RLS Policies
-- Run this in your Supabase SQL Editor
-- =====================================================================

-- 1. Ensure Row Level Security (RLS) is active
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent naming conflicts
DROP POLICY IF EXISTS "maintenance_select_all" ON public.maintenance;
DROP POLICY IF EXISTS "maintenance_write_admin" ON public.maintenance;

-- 3. Create Select Policy: Read access for all authenticated users (residents & admins)
CREATE POLICY "maintenance_select_all"
  ON public.maintenance
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Create Admin Write Policy: Full CRUD (Insert/Update/Delete) for administrators
CREATE POLICY "maintenance_write_admin"
  ON public.maintenance
  FOR ALL
  TO authenticated
  USING (public.profile_role() = 'admin')
  WITH CHECK (public.profile_role() = 'admin');
