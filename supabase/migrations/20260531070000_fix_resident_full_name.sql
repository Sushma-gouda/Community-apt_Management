-- Migration: Fix resident insert to include full_name (NOT NULL column)
-- The residents table has both `name` (nullable) and `full_name` (NOT NULL).
-- All INSERT statements must provide full_name or inserts silently fail.
-- This migration also fixes duplicate function overloads and re-applies
-- the correct trigger + RPC functions.

-- 1. Drop conflicting overloaded functions
DROP FUNCTION IF EXISTS public.register_resident(bigint, text, text, text, integer);
DROP FUNCTION IF EXISTS public.register_resident(text, text, text, text, integer);

-- 2. Correct register_resident RPC (idempotent, sets both name and full_name)
CREATE OR REPLACE FUNCTION public.register_resident(
  p_flat_id      text,
  p_full_name    text,
  p_email        text,
  p_phone        text,
  p_family_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_res_id  text;
  f         record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Idempotency: if already registered, return existing
  SELECT id INTO v_res_id FROM public.residents WHERE user_id = v_uid LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('resident_id', v_res_id, 'flat_id', p_flat_id);
  END IF;

  SELECT * INTO STRICT f FROM public.flats WHERE id = p_flat_id FOR UPDATE;
  IF f.status IS DISTINCT FROM 'vacant' THEN
    RAISE EXCEPTION 'Flat is not available';
  END IF;

  v_res_id := 'res-' || REPLACE(gen_random_uuid()::text, '-', '');

  -- Both `name` and `full_name` set — full_name is NOT NULL
  INSERT INTO public.residents (id, flat_id, name, full_name, email, phone, family_count, status, user_id)
  VALUES (v_res_id, p_flat_id, p_full_name, p_full_name, p_email, p_phone,
          GREATEST(1, COALESCE(p_family_count, 1)), 'active', v_uid);

  UPDATE public.flats SET status = 'occupied', owner_name = p_full_name WHERE id = p_flat_id;

  UPDATE public.profiles
  SET full_name = p_full_name, phone = p_phone,
      family_count = GREATEST(1, COALESCE(p_family_count, 1)),
      block_id = f.block_id, flat_number = f.flat_number, flat_id = p_flat_id, updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object('resident_id', v_res_id, 'flat_id', p_flat_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_resident(text, text, text, text, integer) TO authenticated;

-- 3. check_pre_registered_resident
CREATE OR REPLACE FUNCTION public.check_pre_registered_resident(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; f record; b record;
BEGIN
  SELECT * INTO r FROM public.residents
  WHERE lower(trim(email)) = lower(trim(p_email)) AND user_id IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT * INTO f FROM public.flats WHERE id = r.flat_id LIMIT 1;
  SELECT * INTO b FROM public.blocks WHERE id = f.block_id LIMIT 1;
  RETURN jsonb_build_object(
    'found', true, 'resident_id', r.id, 'flat_id', r.flat_id,
    'flat_number', f.flat_number, 'block_id', f.block_id, 'block_name', b.name,
    'name', COALESCE(r.full_name, r.name), 'phone', r.phone, 'family_count', r.family_count
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.check_pre_registered_resident(text) TO anon, authenticated;

-- 4. claim_resident_profile (pre-registered flow)
CREATE OR REPLACE FUNCTION public.claim_resident_profile(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); r record; f record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO r FROM public.residents
  WHERE lower(trim(email)) = lower(trim(p_email)) AND (user_id IS NULL OR user_id = v_uid)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No pre-registered resident profile found for this email'; END IF;
  UPDATE public.residents SET user_id = v_uid WHERE id = r.id;
  SELECT * INTO f FROM public.flats WHERE id = r.flat_id LIMIT 1;
  UPDATE public.profiles
  SET full_name = COALESCE(r.full_name, r.name), phone = r.phone, family_count = r.family_count,
      block_id = f.block_id, flat_number = f.flat_number, flat_id = r.flat_id, updated_at = now()
  WHERE id = v_uid;
  UPDATE public.flats SET status = 'occupied', owner_name = COALESCE(r.full_name, r.name)
  WHERE id = r.flat_id AND status = 'vacant';
  RETURN jsonb_build_object('resident_id', r.id, 'flat_id', r.flat_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.claim_resident_profile(text) TO authenticated;

-- 5. handle_new_user trigger — sets both name and full_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r text; fam int; f_id text; b_id text; f_num text;
  f_name text; p_num text; v_res_id text; existing_res record;
BEGIN
  r := COALESCE(NULLIF(TRIM(new.raw_user_meta_data ->> 'role'), ''), 'resident');
  IF r NOT IN ('admin', 'resident', 'security') THEN r := 'resident'; END IF;

  f_name := NULLIF(TRIM(new.raw_user_meta_data ->> 'full_name'), '');
  p_num  := NULLIF(TRIM(new.raw_user_meta_data ->> 'phone'), '');
  BEGIN
    fam := (NULLIF(TRIM(new.raw_user_meta_data ->> 'family_count'), ''))::integer;
  EXCEPTION WHEN OTHERS THEN fam := 1; END;
  f_id  := NULLIF(TRIM(new.raw_user_meta_data ->> 'flat_id'), '');
  b_id  := NULLIF(TRIM(new.raw_user_meta_data ->> 'block_id'), '');
  f_num := NULLIF(TRIM(new.raw_user_meta_data ->> 'flat_number'), '');

  IF r = 'resident' THEN
    SELECT * INTO existing_res FROM public.residents
    WHERE lower(trim(email)) = lower(trim(new.email)) AND user_id IS NULL LIMIT 1;

    IF FOUND THEN
      UPDATE public.residents SET user_id = new.id WHERE id = existing_res.id;
      SELECT block_id, flat_number INTO b_id, f_num FROM public.flats WHERE id = existing_res.flat_id;
      f_id   := existing_res.flat_id;
      f_name := COALESCE(existing_res.full_name, existing_res.name);
      p_num  := existing_res.phone;
      fam    := existing_res.family_count;
      UPDATE public.flats SET status = 'occupied', owner_name = f_name
      WHERE id = f_id AND status = 'vacant';
    ELSE
      IF f_id IS NOT NULL THEN
        v_res_id := 'res-' || REPLACE(gen_random_uuid()::text, '-', '');
        -- BOTH name AND full_name required
        INSERT INTO public.residents (id, flat_id, name, full_name, email, phone, family_count, status, user_id)
        VALUES (v_res_id, f_id, COALESCE(f_name, new.email), COALESCE(f_name, new.email),
                new.email, p_num, GREATEST(1, COALESCE(fam, 1)), 'active', new.id)
        ON CONFLICT (user_id) DO NOTHING;
        UPDATE public.flats SET status = 'occupied', owner_name = COALESCE(f_name, new.email) WHERE id = f_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, role, full_name, phone, block_id, flat_number, family_count, flat_id)
  VALUES (new.id, r, f_name, p_num, b_id, f_num, fam, f_id)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    block_id = COALESCE(EXCLUDED.block_id, public.profiles.block_id),
    flat_number = COALESCE(EXCLUDED.flat_number, public.profiles.flat_number),
    family_count = COALESCE(EXCLUDED.family_count, public.profiles.family_count),
    flat_id = COALESCE(EXCLUDED.flat_id, public.profiles.flat_id),
    updated_at = now();
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. update_my_resident_profile RPC — updates both name columns
CREATE OR REPLACE FUNCTION public.update_my_resident_profile(
  p_name text DEFAULT NULL, p_phone text DEFAULT NULL, p_family_count integer DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.residents
  SET name = COALESCE(p_name, name), full_name = COALESCE(p_name, full_name),
      phone = COALESCE(p_phone, phone), family_count = COALESCE(p_family_count, family_count)
  WHERE user_id = v_uid;
  IF p_name IS NOT NULL THEN
    UPDATE public.profiles SET full_name = p_name, updated_at = now() WHERE id = v_uid;
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.update_my_resident_profile TO authenticated;

-- 7. Fix RLS policy so residents can update their own row
DROP POLICY IF EXISTS "residents_update_admin" ON public.residents;
CREATE POLICY "residents_update_admin" ON public.residents FOR UPDATE
  USING (public.profile_role() = 'admin' OR user_id = auth.uid())
  WITH CHECK (public.profile_role() = 'admin' OR user_id = auth.uid());

-- 8. Backfill existing rows where full_name may be blank
UPDATE public.residents
SET full_name = COALESCE(NULLIF(TRIM(full_name), ''), name, email, 'Unknown')
WHERE full_name IS NULL OR TRIM(full_name) = '';
