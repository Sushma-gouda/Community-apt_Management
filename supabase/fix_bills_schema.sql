-- =========================================================================
-- FIX: Update Bills Schema
-- 
-- The frontend assumes the bills table has transaction_id, payment_method,
-- and generated_at fields. This script adds them to the existing bills table.
-- =========================================================================

-- 1. Add 'transaction_id' column
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'transaction_id') THEN
    ALTER TABLE public.bills ADD COLUMN transaction_id text;
  END IF;
END $$;

-- 2. Add 'payment_method' column
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'payment_method') THEN
    ALTER TABLE public.bills ADD COLUMN payment_method text;
  END IF;
END $$;

-- 3. Add 'generated_at' column (maps to created_at logic but named for frontend)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'generated_at') THEN
    ALTER TABLE public.bills ADD COLUMN generated_at timestamptz not null default now();
  END IF;
END $$;

-- 4. Update bills RLS for Admins (Admin can update all bills)
DROP POLICY IF EXISTS "bills_update" ON public.bills;
CREATE POLICY "bills_update"
  ON public.bills FOR UPDATE
  USING (
    public.profile_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = bills.resident_id AND r.user_id = auth.uid()
    )
  );

-- Notify success
SELECT 'Bills schema updated successfully!' as result;
