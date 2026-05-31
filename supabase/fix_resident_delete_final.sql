-- =========================================================================
-- FIX: Allow Admins to Remove Residents
-- 
-- This script adds the missing DELETE policy so admins can remove residents.
-- It also adds a secure, atomic RPC function to handle the removal cleanly.
-- =========================================================================

-- 1. Add missing DELETE policy for residents (Admins only)
DROP POLICY IF EXISTS "residents_delete_admin" ON public.residents;
CREATE POLICY "residents_delete_admin"
  ON public.residents FOR DELETE
  USING (public.profile_role() = 'admin');


-- 2. Create a secure, atomic RPC function to handle the removal
CREATE OR REPLACE FUNCTION public.admin_remove_resident(p_res_id text, p_flat_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the user is an admin
  IF public.profile_role() != 'admin' THEN
    RAISE EXCEPTION 'Not authorized. Only admins can remove residents.';
  END IF;

  -- Step A: Mark the flat as vacant
  IF p_flat_id IS NOT NULL THEN
    UPDATE public.flats 
    SET status = 'vacant', owner_name = NULL 
    WHERE id = p_flat_id;
  END IF;

  -- Step B: Delete the resident record
  DELETE FROM public.residents WHERE id = p_res_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_remove_resident(text, text) TO authenticated;
