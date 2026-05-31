-- Migration: Allow residents to update their own profile data
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vckejkkswhyamhzccfiu/sql/new

-- 1. Extend the residents update policy to allow residents to update their own record
drop policy if exists "residents_update_admin" on public.residents;
create policy "residents_update_admin"
  on public.residents for update
  using (
    public.profile_role() = 'admin'
    or user_id = auth.uid()  -- residents can update their own row
  )
  with check (
    public.profile_role() = 'admin'
    or user_id = auth.uid()
  );

-- 2. Add a security-definer RPC for resident self-update (alternative approach)
--    This is useful as a fallback if the RLS policy isn't applied.
create or replace function public.update_my_resident_profile(
  p_name       text    default null,
  p_phone      text    default null,
  p_family_count integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.residents
  set
    name         = coalesce(p_name, name),
    phone        = coalesce(p_phone, phone),
    family_count = coalesce(p_family_count, family_count)
  where user_id = v_uid;

  -- Also sync full_name to profiles for consistency
  if p_name is not null then
    update public.profiles
    set full_name = p_name, updated_at = now()
    where id = v_uid;
  end if;
end;
$$;

grant execute on function public.update_my_resident_profile to authenticated;
