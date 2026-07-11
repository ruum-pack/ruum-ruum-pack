-- RT-07 — Clasifica sin borrar metadata histórica ni alterar conductores.

-- Solicitudes creadas por el modelo anterior conservan sus datos y versión 1.
update public.solicitudes_conductor
set version_registro=1,origen_modelo='legacy_metadata'
where creado_en < now() and origen_modelo='legacy_metadata';

create index solicitudes_conductor_version_estado_idx
  on public.solicitudes_conductor(version_registro,estado,actualizado_en desc);

create or replace function public.clasificar_registro_conductor(p_auth_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists(select 1 from public.conductores where auth_user_id=p_auth_user_id and estado<>'pendiente_verificacion') then 'conductor_aprobado'
    when exists(select 1 from public.conductores where auth_user_id=p_auth_user_id) then 'conductor_legacy_pendiente'
    when exists(select 1 from public.solicitudes_conductor where auth_user_id=p_auth_user_id and version_registro=2 and estado in ('borrador','correo_pendiente','datos_incompletos')) then 'solicitud_v2_incompleta'
    when exists(select 1 from public.solicitudes_conductor where auth_user_id=p_auth_user_id and version_registro=2) then 'solicitud_v2'
    when exists(select 1 from public.solicitudes_conductor where auth_user_id=p_auth_user_id) then 'solicitud_legacy'
    else 'sin_registro'
  end;
$$;
revoke all on function public.clasificar_registro_conductor(uuid) from public,anon,authenticated;

comment on function public.clasificar_registro_conductor(uuid) is
  'RT-07: inventario de compatibilidad para migración; no borra raw_user_meta_data.';
