-- Auditoría H-2 — Escalada de privilegios del conductor sobre sus documentos.
--
-- La policy "conductor_administra_sus_documentos" (0043) era
--   for all using (conductor_id in (mis conductores))
--   with check (conductor_id in (mis conductores))
-- Como RLS filtra filas y no columnas, el FOR ALL deja al conductor con
-- UPDATE/DELETE sobre SUS propias filas de documentos_conductor, incluidas
-- las columnas administrativas `estado` y `notas_admin`. Es decir, desde el
-- cliente Supabase un conductor podía:
--   update documentos_conductor set estado='aprobado', notas_admin=null
--     where id = <suyo>;
-- y auto-aprobar su expediente, saltándose por completo a la Torre de Control.
--
-- Es el mismo tipo de agujero que 0045 cerró en `conductores`. Aquí aplicamos
-- la misma filosofía a `documentos_conductor`:
--   1) partir el FOR ALL del conductor en SELECT + INSERT acotado (sin UPDATE
--      ni DELETE): el conductor solo puede leer sus documentos y crear filas
--      nuevas en estado 'en_revision' y sin notas de admin;
--   2) reemplazar un documento es INSERT de una fila nueva (el flujo ya lo hace
--      así en services/conductores.ts::subirDocumentoConductor), no UPDATE;
--   3) trigger espejo de 0045 como defensa en profundidad: aunque no exista
--      policy de UPDATE para el conductor, si en el futuro se reintroduce una,
--      el trigger sigue impidiendo que un no-admin toque estado/notas_admin.
--
-- Nota sobre GRANTs (auditoría H-4): NO revocamos UPDATE/DELETE a nivel de
-- tabla para el rol `authenticated`, porque el Admin (Torre de Control) también
-- es un usuario `authenticated`; su acceso elevado viene de la policy es_admin(),
-- no de un rol de base de datos distinto. Revocar a nivel de tabla rompería
-- revisarDocumentoConductorAdmin(). La separación se hace por RLS + trigger.

-- 1) Restricción fuerte de `tipo` a nivel de base (auditoría H-8) --------------
-- Antes `tipo text not null` aceptaba cualquier cadena desde la base, aunque
-- TypeScript solo permitiera los cuatro valores. Replicamos esa regla como
-- CHECK para que la base sea la fuente de verdad.
alter table public.documentos_conductor
  drop constraint if exists documentos_conductor_tipo_check;

alter table public.documentos_conductor
  add constraint documentos_conductor_tipo_check
  check (tipo in ('licencia_frente', 'licencia_reverso', 'identificacion_oficial', 'documento_operativo'));

-- 2) Partir la policy FOR ALL del conductor ------------------------------------
drop policy if exists "conductor_administra_sus_documentos" on public.documentos_conductor;

create policy "conductor_lee_sus_documentos"
  on public.documentos_conductor
  for select
  using (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

create policy "conductor_registra_sus_documentos"
  on public.documentos_conductor
  for insert
  with check (
    conductor_id in (select id from public.conductores where auth_user_id = auth.uid())
    and estado = 'en_revision'
    and notas_admin is null
  );

-- El conductor NO recibe policy de UPDATE ni DELETE: no puede alterar filas
-- existentes ni borrarlas. La policy de admin (FOR ALL con es_admin()) sigue
-- intacta y cubre la revisión documental.

-- 3) Blindaje de columnas administrativas (defensa en profundidad) -------------
create or replace function public.proteger_campos_documento_conductor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El Admin (Torre de Control) puede mover estado y notas_admin: es su trabajo.
  if public.es_admin() then
    return new;
  end if;

  -- Cambios que no provienen de un usuario autenticado (RPC security definer,
  -- procesos de sistema) no se filtran aquí.
  if auth.uid() is null then
    return new;
  end if;

  -- Cualquier otro actor (el propio conductor) no puede tocar estas columnas.
  if new.estado is distinct from old.estado
    or new.notas_admin is distinct from old.notas_admin
    or new.conductor_id is distinct from old.conductor_id
    or new.tipo is distinct from old.tipo
    or new.url is distinct from old.url
    or new.creado_en is distinct from old.creado_en then
    raise exception 'No puedes modificar el estado ni las notas de revisión de tus documentos.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_campos_documento_conductor on public.documentos_conductor;
create trigger proteger_campos_documento_conductor
  before update on public.documentos_conductor
  for each row execute function public.proteger_campos_documento_conductor();
