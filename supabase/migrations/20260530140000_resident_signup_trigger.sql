-- Migration: Automate resident mapping inside the handle_new_user trigger
-- Bypasses the need for post-signup RPC calls by handling creation and linking directly on auth user insert.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  fam int;
  f_id text;
  b_id text;
  f_num text;
  f_name text;
  p_num text;
  v_res_id text;
  existing_res record;
begin
  r := coalesce(nullif(trim(new.raw_user_meta_data ->> 'role'), ''), 'resident');
  if r not in ('admin', 'resident', 'security') then
    r := 'resident';
  end if;

  f_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  p_num := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  
  begin
    fam := (nullif(trim(new.raw_user_meta_data ->> 'family_count'), ''))::integer;
  exception
    when others then
      fam := 1;
  end;

  f_id := nullif(trim(new.raw_user_meta_data ->> 'flat_id'), '');
  b_id := nullif(trim(new.raw_user_meta_data ->> 'block_id'), '');
  f_num := nullif(trim(new.raw_user_meta_data ->> 'flat_number'), '');

  if r = 'resident' then
    -- Check if there is a pre-registered resident profile with this email
    select * into existing_res from public.residents 
    where lower(trim(email)) = lower(trim(new.email)) 
      and user_id is null 
    limit 1;

    if found then
      -- 1. Link existing resident row to this auth user
      update public.residents
      set user_id = new.id
      where id = existing_res.id;

      -- 2. Populate profiles table with pre-registered info
      select block_id, flat_number into b_id, f_num from public.flats where id = existing_res.flat_id;
      f_id := existing_res.flat_id;
      f_name := existing_res.name;
      p_num := existing_res.phone;
      fam := existing_res.family_count;
    else
      -- No pre-registered resident, create a new resident row if flat_id is provided
      if f_id is not null then
        v_res_id := 'res-' || replace(gen_random_uuid()::text, '-', '');
        
        insert into public.residents (id, flat_id, name, email, phone, family_count, status, user_id)
        values (
          v_res_id, 
          f_id, 
          coalesce(f_name, new.email), 
          new.email, 
          p_num, 
          greatest(1, coalesce(fam, 1)), 
          'active', 
          new.id
        )
        on conflict (user_id) do nothing;

        -- Mark flat as occupied
        update public.flats
        set status = 'occupied', owner_name = coalesce(f_name, new.email)
        where id = f_id;
      end if;
    end if;
  end if;

  -- Insert/Upsert into profiles
  insert into public.profiles (id, role, full_name, phone, block_id, flat_number, family_count, flat_id)
  values (
    new.id,
    r,
    f_name,
    p_num,
    b_id,
    f_num,
    fam,
    f_id
  )
  on conflict (id) do update set
    role = excluded.role,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    block_id = coalesce(excluded.block_id, public.profiles.block_id),
    flat_number = coalesce(excluded.flat_number, public.profiles.flat_number),
    family_count = coalesce(excluded.family_count, public.profiles.family_count),
    flat_id = coalesce(excluded.flat_id, public.profiles.flat_id),
    updated_at = now();

  return new;
end;
$$;
