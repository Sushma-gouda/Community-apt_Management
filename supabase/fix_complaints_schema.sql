-- =========================================================================
-- FIX: Update Complaints Schema
-- 
-- The frontend assumes the complaints table has description, category, and 
-- priority fields. This script updates the existing table to match.
-- =========================================================================

-- 1. Rename 'body' to 'description' if 'description' doesn't exist
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complaints' AND column_name = 'body') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complaints' AND column_name = 'description') THEN
    ALTER TABLE public.complaints RENAME COLUMN body TO description;
  END IF;
END $$;

-- 2. Add 'category' column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complaints' AND column_name = 'category') THEN
    ALTER TABLE public.complaints ADD COLUMN category text DEFAULT 'General';
  END IF;
END $$;

-- 3. Add 'priority' column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complaints' AND column_name = 'priority') THEN
    ALTER TABLE public.complaints ADD COLUMN priority text DEFAULT 'medium';
  END IF;
END $$;

-- 4. Ensure RLS allows all necessary operations for Admins
DROP POLICY IF EXISTS "complaints_update" ON public.complaints;
CREATE POLICY "complaints_update"
  ON public.complaints FOR UPDATE
  USING (
    public.profile_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = complaints.resident_id AND r.user_id = auth.uid()
    )
  );

-- Notify success
SELECT 'Complaints schema updated successfully!' as result;
