create or replace function public.update_my_resident_profile(
  p_name       text    default null,
  p_phone      text    default null,
  p_family_count integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $body
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.residents
  set
    name         = coalesce(p_name, name),
    full_name    = coalesce(p_name, full_name),
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
$body;

grant execute on function public.update_my_resident_profile to authenticated;
