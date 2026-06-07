-- Migration: Add alt_phone and bio to residents table
-- Run this in the Supabase SQL Editor:

ALTER TABLE public.residents 
ADD COLUMN IF NOT EXISTS alt_phone text,
ADD COLUMN IF NOT EXISTS bio text;

-- Also update the update_my_resident_profile function if it exists
CREATE OR REPLACE FUNCTION public.update_my_resident_profile(
  p_name       text    default null,
  p_phone      text    default null,
  p_family_count integer default null,
  p_alt_phone  text    default null,
  p_bio        text    default null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.residents
  SET
    name         = COALESCE(p_name, name),
    full_name    = COALESCE(p_name, full_name),
    phone        = COALESCE(p_phone, phone),
    family_count = COALESCE(p_family_count, family_count),
    alt_phone    = COALESCE(p_alt_phone, alt_phone),
    bio          = COALESCE(p_bio, bio)
  WHERE user_id = v_uid;

  -- Also sync full_name to profiles for consistency
  IF p_name IS NOT NULL THEN
    UPDATE public.profiles
    SET full_name = p_name, updated_at = now()
    WHERE id = v_uid;
  END IF;
END;
$body;

GRANT EXECUTE ON FUNCTION public.update_my_resident_profile TO authenticated;

-- Reload schema cache so API picks up the new columns immediately
NOTIFY pgrst, 'reload schema';
