-- =========================================================================
-- TARGETED FIX: register_resident function
-- 
-- The function currently in your DB uses "occupancy_status" (wrong column).
-- The actual flats table column is "status".
-- 
-- Paste this ENTIRE file into Supabase SQL Editor and click Run.
-- https://supabase.com/dashboard/project/vckejkkswhyamhzccfiu/sql/new
-- =========================================================================

-- Step 1: Kill EVERY version of register_resident (all possible signatures)
DROP FUNCTION IF EXISTS public.register_resident(text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.register_resident(bigint, text, text, text, integer);
DROP FUNCTION IF EXISTS public.register_resident(integer, text, text, text, integer);

-- Step 2: Verify it's gone (this will show 0 rows if drop succeeded)
-- SELECT proname, pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'register_resident';

-- Step 3: Create the correct version
CREATE FUNCTION public.register_resident(
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
  v_uid     uuid;
  v_res_id  text;
  f         record;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If resident row already exists for this user, return it (idempotent)
  SELECT id INTO v_res_id
  FROM public.residents
  WHERE user_id = v_uid
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'resident_id', v_res_id,
      'flat_id',     p_flat_id,
      'status',      'already_registered'
    );
  END IF;

  -- Lock and validate flat using the correct column name: "status"
  SELECT * INTO f
  FROM public.flats
  WHERE id = p_flat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flat does not exist: %', p_flat_id;
  END IF;

  IF f.status IS DISTINCT FROM 'vacant' THEN
    RAISE EXCEPTION 'Flat % is not available (status: %)', p_flat_id, f.status;
  END IF;

  -- Generate resident ID
  v_res_id := 'res-' || replace(gen_random_uuid()::text, '-', '');

  -- Insert resident (both name AND full_name — full_name is NOT NULL in schema)
  INSERT INTO public.residents (
    id,
    flat_id,
    name,
    full_name,
    email,
    phone,
    family_count,
    status,
    user_id
  )
  VALUES (
    v_res_id,
    p_flat_id,
    p_full_name,
    p_full_name,
    p_email,
    p_phone,
    GREATEST(1, COALESCE(p_family_count, 1)),
    'active',
    v_uid
  );

  -- Update flat using correct column "status" (NOT "occupancy_status")
  UPDATE public.flats
  SET
    status     = 'occupied',
    owner_name = p_full_name
  WHERE id = p_flat_id;

  -- Sync profile row
  UPDATE public.profiles
  SET
    full_name    = p_full_name,
    phone        = COALESCE(p_phone, phone),
    family_count = GREATEST(1, COALESCE(p_family_count, 1)),
    block_id     = f.block_id,
    flat_number  = f.flat_number,
    flat_id      = p_flat_id,
    updated_at   = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'resident_id', v_res_id,
    'flat_id',     p_flat_id,
    'status',      'created'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_resident(text, text, text, text, integer) TO authenticated;
