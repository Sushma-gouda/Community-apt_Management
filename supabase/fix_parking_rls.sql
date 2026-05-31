ALTER TABLE public.parking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parking_select_admin" ON public.parking;
DROP POLICY IF EXISTS "parking_insert_admin" ON public.parking;
DROP POLICY IF EXISTS "parking_update_admin" ON public.parking;
DROP POLICY IF EXISTS "parking_delete_admin" ON public.parking;
DROP POLICY IF EXISTS "parking_select_resident" ON public.parking;

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
