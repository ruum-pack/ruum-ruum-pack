-- FASE 1 — Dominio Operation: de traslados sueltos a operaciones logísticas.
-- Decisión: tabla `operaciones` (español, consistente con traslados/empresas).
-- Organization del plan = empresas (reutiliza empresas.id, no se crea tabla nueva).
-- Compatibilidad: traslados.operation_id NULLABLE; históricos siguen funcionando igual.

create type public.tipo_operacion as enum (
  'corporativa',
  'flota',
  'evento',
  'masiva',
  'interna'
);

create type public.estado_operacion as enum (
  'borrador',
  'planificada',
  'en_curso',
  'pausada',
  'cerrada',
  'cancelada'
);

create table public.operaciones (
  id                          uuid primary key default gen_random_uuid(),
  folio                       text not null unique,
  empresa_id                  uuid references public.empresas(id) on delete set null,
  nombre                      text not null,
  descripcion                 text,
  tipo                        public.tipo_operacion not null default 'corporativa',
  estado                      public.estado_operacion not null default 'borrador',
  prioridad                   text not null default 'media'
    constraint operaciones_prioridad_check
    check (prioridad in ('baja', 'media', 'alta', 'critica')),
  planned_start_at            timestamptz,
  planned_end_at              timestamptz,
  responsable_interno_admin_id uuid references public.admins(id) on delete set null,
  cliente_contacto_nombre     text,
  cliente_contacto_telefono   text,
  sla_horas                   integer constraint operaciones_sla_horas_check check (sla_horas is null or sla_horas > 0),
  metadata                    jsonb not null default '{}'::jsonb,
  creado_en                   timestamptz not null default now(),
  actualizado_en              timestamptz not null default now(),
  constraint operaciones_fechas_check
    check (planned_start_at is null or planned_end_at is null or planned_start_at <= planned_end_at)
);

create or replace function public.generar_folio_operacion()
returns trigger
language plpgsql
as $$
begin
  if new.folio is null or btrim(new.folio) = '' then
    new.folio := 'OP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  end if;
  return new;
end;
$$;

create trigger operaciones_generar_folio
  before insert on public.operaciones
  for each row execute function public.generar_folio_operacion();

create trigger operaciones_actualizado_en
  before update on public.operaciones
  for each row execute function public.set_actualizado_en();

create index operaciones_empresa_id_idx on public.operaciones (empresa_id);
create index operaciones_estado_idx on public.operaciones (estado);
create index operaciones_tipo_idx on public.operaciones (tipo);
create index operaciones_planned_start_idx on public.operaciones (planned_start_at);

-- 1.13 — vínculo nullable con traslados (compat: históricos con NULL funcionan igual)
alter table public.traslados
  add column operation_id uuid references public.operaciones(id) on delete set null;

create index traslados_operation_id_idx on public.traslados (operation_id);

alter table public.operaciones enable row level security;

-- Torre de Control: acceso total
create policy "admin_acceso_total_operaciones"
  on public.operaciones for all
  using (public.es_admin());

-- Titular/usuario de empresa: lectura de sus operaciones + operaciones internas sin empresa
create policy "empresa_ve_sus_operaciones"
  on public.operaciones for select
  using (
    empresa_id is null
    or empresa_id in (
      select u.empresa_id from public.usuarios u
      where u.auth_user_id = auth.uid() and u.empresa_id is not null
    )
  );

-- Conductor: lectura de operaciones que tengan traslados asignados a él
-- (vía traslados.operation_id; sin join directo para no acoplar RLS)
create policy "conductor_ve_operaciones_asignadas"
  on public.operaciones for select
  using (
    exists (
      select 1 from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where t.operation_id = operaciones.id
        and c.auth_user_id = auth.uid()
    )
  );

-- Privilegios mínimos para que RLS aplique sobre rol authenticated
-- (sin GRANT, toda lectura/escritura falla con permission denied).
grant select, insert, update, delete on public.operaciones to authenticated;
grant select on public.operaciones to anon;
grant all on public.operaciones to service_role;
