-- Seguridad de fotos de perfil y límite distribuido para Edge Functions.
-- Las fotos de identidad no son contenido público: se leen solo con sesión
-- y autorización de propietario/traslado/admin. Las apps las sirven con
-- createSignedUrl; no se debe volver a usar getPublicUrl para estos buckets.

update storage.buckets
set public = false
where id in ('fotos-perfil', 'fotos-perfil-conductor');

drop policy if exists "todos_ven_fotos_perfil" on storage.objects;
drop policy if exists "todos_ven_fotos_perfil_conductor" on storage.objects;

drop policy if exists "usuario_lee_su_foto_perfil" on storage.objects;
create policy "usuario_lee_su_foto_perfil"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fotos-perfil'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin_lee_fotos_perfil" on storage.objects;
create policy "admin_lee_fotos_perfil"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fotos-perfil' and public.es_admin());

-- Un conductor ve su propia foto; un usuario solo ve la foto del conductor
-- asignado a uno de sus traslados. El admin conserva acceso operativo.
drop policy if exists "conductor_lee_fotos_perfil_autorizadas" on storage.objects;
create policy "conductor_lee_fotos_perfil_autorizadas"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fotos-perfil-conductor'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and (
      public.es_admin()
      or exists (
        select 1
        from public.conductores c
        where c.id::text = (storage.foldername(name))[1]
          and c.auth_user_id = auth.uid()
      )
      or exists (
        select 1
        from public.traslados t
        join public.usuarios u on u.id = t.usuario_id
        where t.conductor_id::text = (storage.foldername(name))[1]
          and u.auth_user_id = auth.uid()
      )
    )
  );

-- Rate limit atómico en Postgres: la clave es el usuario autenticado y el
-- bucket lógico identifica la operación. Solo service_role puede invocarlo.
create table if not exists public.edge_function_rate_limits (
  bucket text not null check (bucket ~ '^[a-z0-9._-]{1,80}$'),
  rate_key text not null check (length(rate_key) between 1 and 200),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (bucket, rate_key)
);

alter table public.edge_function_rate_limits enable row level security;
revoke all on table public.edge_function_rate_limits from public, anon, authenticated;
grant all on table public.edge_function_rate_limits to service_role;

create or replace function public.consumir_rate_limit(
  p_bucket text,
  p_rate_key text,
  p_max_attempts integer,
  p_window_seconds integer
) returns table (permitido boolean, reintentar_en integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_inicio timestamptz;
  v_intentos integer;
begin
  if p_bucket !~ '^[a-z0-9._-]{1,80}$'
    or p_rate_key is null or length(p_rate_key) not between 1 and 200
    or p_max_attempts < 1 or p_window_seconds < 1 then
    raise exception 'Parámetros de rate limit inválidos.';
  end if;

  insert into public.edge_function_rate_limits(bucket, rate_key, window_started_at, attempts)
  values (p_bucket, p_rate_key, v_now, 1)
  on conflict (bucket, rate_key) do update
  set window_started_at = case
        when public.edge_function_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          then v_now
        else public.edge_function_rate_limits.window_started_at
      end,
      attempts = case
        when public.edge_function_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          then 1
        else public.edge_function_rate_limits.attempts + 1
      end
  returning window_started_at, attempts into v_inicio, v_intentos;

  permitido := v_intentos <= p_max_attempts;
  reintentar_en := greatest(
    1,
    ceil(extract(epoch from (v_inicio + make_interval(secs => p_window_seconds) - v_now)))::integer
  );
  return next;
end;
$$;

revoke all on function public.consumir_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consumir_rate_limit(text, text, integer, integer)
  to service_role;

comment on table public.edge_function_rate_limits is
  'Contadores atómicos internos para limitar Edge Functions por usuario autenticado.';
