-- =========================================================================
-- FIX: Allow Admins to DELETE residents
-- 
-- The residents table has RLS enabled but lacked a DELETE policy.
-- This caused the "Remove" button in the admin dashboard to fail silently.
-- =========================================================================

-- Step 1: Add DELETE policy for residents (admins only)
DROP POLICY IF EXISTS "residents_delete_admin" ON public.residents;
CREATE POLICY "residents_delete_admin"
  ON public.residents FOR DELETE
  USING (public.profile_role() = 'admin');

-- Note: We also need a policy for profiles deletion? 
-- Actually, profiles is linked to auth.users ON DELETE CASCADE.
-- If the admin removes a resident, does it delete auth.users? 
-- We can't delete auth.users directly from public schema without an RPC.
-- But the UI calls deleteResident which just deletes from the residents table.
-- That's fine for removing them from the resident directory.
