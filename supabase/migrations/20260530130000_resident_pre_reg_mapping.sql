-- Migration: Support pre-registered resident mapping
-- Adds RPC functions for secure lookup and mapping of pre-registered residents during signup.

-- 1. Function to check if a resident was pre-registered by an admin using their email
create or replace function public.check_pre_registered_resident(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  f record;
  b record;
begin
  select * into r from public.residents 
  where lower(trim(email)) = lower(trim(p_email)) 
    and user_id is null 
  limit 1;
  
  if not found then
    return null;
  end if;

  select * into f from public.flats where id = r.flat_id limit 1;
  select * into b from public.blocks where id = f.block_id limit 1;

  return jsonb_build_object(
    'found', true,
    'resident_id', r.id,
    'flat_id', r.flat_id,
    'flat_number', f.flat_number,
    'block_id', f.block_id,
    'block_name', b.name,
    'name', r.name,
    'phone', r.phone,
    'family_count', r.family_count
  );
end;
$$;

grant execute on function public.check_pre_registered_resident(text) to anon, authenticated;

-- 2. Function for a newly registered user to claim their pre-registered resident profile
create or replace function public.claim_resident_profile(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
  f record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the resident row to prevent race conditions
  select * into r from public.residents 
  where lower(trim(email)) = lower(trim(p_email)) 
    and user_id is null 
  for update;
  
  if not found then
    raise exception 'No pre-registered resident profile found for this email';
  end if;

  -- Link the resident row to the authenticated user
  update public.residents
  set user_id = v_uid
  where id = r.id;

  -- Sync profiles table
  select * into f from public.flats where id = r.flat_id limit 1;
  
  update public.profiles
  set
    full_name = r.name,
    phone = r.phone,
    family_count = r.family_count,
    block_id = f.block_id,
    flat_number = f.flat_number,
    flat_id = r.flat_id,
    updated_at = now()
  where id = v_uid;

  return jsonb_build_object('resident_id', r.id, 'flat_id', r.flat_id);
end;
$$;

grant execute on function public.claim_resident_profile(text) to authenticated;
