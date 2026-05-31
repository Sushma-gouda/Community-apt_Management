-- 1. Fix profile_role function to fallback to JWT claims if profile is missing
create or replace function public.profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() limit 1),
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role')
  );
$$;

-- 2. Ensure RLS is enabled on parking
ALTER TABLE public.parking ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "parking_select_admin" ON public.parking;
DROP POLICY IF EXISTS "parking_insert_admin" ON public.parking;
DROP POLICY IF EXISTS "parking_update_admin" ON public.parking;
DROP POLICY IF EXISTS "parking_delete_admin" ON public.parking;
DROP POLICY IF EXISTS "parking_select_resident" ON public.parking;

-- 4. Create proper policies
CREATE POLICY "parking_select_admin"
  ON public.parking FOR SELECT
  USING (public.profile_role() = 'admin');

CREATE POLICY "parking_insert_admin"
  ON public.parking FOR INSERT
  WITH CHECK (public.profile_role() = 'admin');

CREATE POLICY "parking_update_admin"
  ON public.parking FOR UPDATE
  USING (public.profile_role() = 'admin')
  WITH CHECK (public.profile_role() = 'admin');

CREATE POLICY "parking_delete_admin"
  ON public.parking FOR DELETE
  USING (public.profile_role() = 'admin');

CREATE POLICY "parking_select_resident"
  ON public.parking FOR SELECT
  USING (
    public.profile_role() = 'security'
    OR EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.flat_id::text = parking.flat_id::text
        AND r.user_id = auth.uid()
    )
  );
