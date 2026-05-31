-- =====================================================================
-- Notice & Announcements Module
-- =====================================================================

-- 1. Create notices table
CREATE TABLE IF NOT EXISTS public.notices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  priority text NOT NULL DEFAULT 'Normal',
  target_audience text NOT NULL DEFAULT 'All Residents',
  target_block text NULL,
  publish_date timestamptz NOT NULL DEFAULT now(),
  expiry_date timestamptz NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Ensure Row Level Security (RLS) is active
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent naming conflicts
DROP POLICY IF EXISTS "notices_select" ON public.notices;
DROP POLICY IF EXISTS "notices_write_admin" ON public.notices;

-- 4. Create Select Policy: Read access for all authenticated users (filtered dynamically)
-- Residents can only see notices that are published, not expired, and targeted to them or their block.
-- Admins can see all notices.
CREATE POLICY "notices_select"
  ON public.notices
  FOR SELECT
  TO authenticated
  USING (
    public.profile_role() = 'admin'
    OR (
      publish_date <= now()
      AND (expiry_date IS NULL OR expiry_date > now())
      AND (
        target_audience = 'All Residents'
        OR target_block = (
          SELECT b.name 
          FROM public.blocks b 
          JOIN public.flats f ON f.block_id = b.id 
          JOIN public.profiles p ON p.flat_id = f.id 
          WHERE p.id = auth.uid()
          LIMIT 1
        )
      )
    )
  );

-- 5. Create Admin Write Policy: Full CRUD for administrators
CREATE POLICY "notices_write_admin"
  ON public.notices
  FOR ALL
  TO authenticated
  USING (public.profile_role() = 'admin')
  WITH CHECK (public.profile_role() = 'admin');

-- 6. Reload PostgREST API Gateway cache
NOTIFY pgrst, 'reload schema';
