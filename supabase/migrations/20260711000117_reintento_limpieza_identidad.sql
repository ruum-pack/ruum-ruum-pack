-- PII — Cola reintentable para eliminar versiones de identidad reemplazadas.
alter table public.documentos_identidad_usuario
  add column intentos_eliminacion integer not null default 0 check (intentos_eliminacion >= 0),
  add column ultimo_intento_eliminacion_en timestamptz,
  add column requiere_alerta_eliminacion boolean not null default false;

drop index if exists public.documento_identidad_limpieza_pendiente_idx;
create index documento_identidad_limpieza_pendiente_idx
  on public.documentos_identidad_usuario(ultimo_intento_eliminacion_en, reemplazado_en)
  where not es_actual and eliminado_storage_en is null;

create or replace function public.reclamar_limpieza_documentos_identidad(p_limite integer default 50)
returns table(documento_id uuid, ruta text, intento integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Acceso exclusivo de procesos internos.';
  end if;

  return query
  with pendientes as (
    select d.id
    from public.documentos_identidad_usuario d
    where not d.es_actual
      and d.eliminado_storage_en is null
      and (d.ultimo_intento_eliminacion_en is null
        or d.ultimo_intento_eliminacion_en < now() - interval '10 minutes')
    order by d.reemplazado_en
    for update skip locked
    limit least(greatest(p_limite, 1), 100)
  ), reclamados as (
    update public.documentos_identidad_usuario d set
      intentos_eliminacion = d.intentos_eliminacion + 1,
      ultimo_intento_eliminacion_en = now()
    from pendientes p
    where d.id = p.id
    returning d.id, d.ruta, d.intentos_eliminacion
  )
  select r.id, r.ruta, r.intentos_eliminacion from reclamados r;
end;
$$;

revoke all on function public.reclamar_limpieza_documentos_identidad(integer) from public, anon, authenticated;
grant execute on function public.reclamar_limpieza_documentos_identidad(integer) to service_role;

comment on function public.reclamar_limpieza_documentos_identidad(integer) is
  'Reclama con SKIP LOCKED versiones reemplazadas pendientes de borrar; sólo service_role.';
