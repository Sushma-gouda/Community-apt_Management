create or replace function public.profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() limit 1),
    (auth.jwt() -> 'user_metadata' ->> 'role')
  );
$$;
