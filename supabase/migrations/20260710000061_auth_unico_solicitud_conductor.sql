-- RT-04 — La identidad Auth tampoco puede coexistir en una solicitud nueva y
-- un conductor operativo, salvo durante la transferencia atómica de aprobación.

create or replace function public.validar_auth_solicitud_sin_conductor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('auth_conductor:' || new.auth_user_id::text));
  if exists (select 1 from public.conductores where auth_user_id=new.auth_user_id) then
    raise exception 'conductor_duplicado:auth' using errcode='23505';
  end if;
  return new;
end;
$$;
create trigger validar_auth_solicitud_sin_conductor
  before insert or update of auth_user_id on public.solicitudes_conductor
  for each row execute function public.validar_auth_solicitud_sin_conductor();

create or replace function public.validar_auth_conductor_sin_solicitud()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.auth_user_id is null or coalesce(current_setting('ruum.aprobando_solicitud',true),'')='si' then return new; end if;
  perform pg_advisory_xact_lock(hashtext('auth_conductor:' || new.auth_user_id::text));
  if exists (select 1 from public.solicitudes_conductor where auth_user_id=new.auth_user_id) then
    raise exception 'conductor_duplicado:auth' using errcode='23505';
  end if;
  return new;
end;
$$;
create trigger validar_auth_conductor_sin_solicitud
  before insert or update of auth_user_id on public.conductores
  for each row execute function public.validar_auth_conductor_sin_solicitud();
