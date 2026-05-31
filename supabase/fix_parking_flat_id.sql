-- ============================================================
-- Parking Module Fix: Change flat_id from bigint to text
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- 1. Drop the existing foreign key constraint
ALTER TABLE public.parking 
  DROP CONSTRAINT IF EXISTS parking_flat_id_fkey;

-- 2. Change the column type from bigint to text
ALTER TABLE public.parking 
  ALTER COLUMN flat_id TYPE text USING flat_id::text;

-- 3. Re-add the foreign key constraint referencing flats(id) as text
ALTER TABLE public.parking 
  ADD CONSTRAINT parking_flat_id_fkey 
  FOREIGN KEY (flat_id) REFERENCES public.flats(id) ON DELETE CASCADE;

-- 4. Verify: make sure parking_slots table also has correct RLS for residents
-- (already exists from core migration, this is just informational)
-- The parking_slots table uses: r.flat_id = parking_slots.flat_id (both text)

-- Done! The parking.flat_id column is now text to match flats.id
