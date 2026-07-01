-- PRD §4.3 + §4.13 — Conductores certificados (CONCER).
create table public.conductores (
  id                          uuid primary key default gen_random_uuid(),
  auth_user_id                uuid unique references auth.users(id) on delete cascade,
  nombre                      text not null,
  nivel_por_experiencia       public.nivel_concer not null default 'basico',
  nivel_por_calificacion      public.nivel_concer not null default 'basico',
  estado                      public.estado_conductor not null default 'pendiente_verificacion',
  -- PRD §4.13 — promedio móvil 6 meses / máx 100 traslados, calculado en
  -- aplicación (ver packages/shared rules/calificacion-nivel.ts) y persistido aquí.
  calificacion_promedio       numeric(3,2) not null default 0,
  traslados_completados       int not null default 0,
  suspensiones_activas        int not null default 0,
  no_presentaciones_6m        int not null default 0,
  documentos_vigentes         boolean not null default false,
  incidencias_graves_6m       int not null default 0,
  incidencias_graves_12m      int not null default 0,
  creado_en                   timestamptz not null default now(),
  actualizado_en              timestamptz not null default now()
);

-- PRD §4.3 + §4.13 — "el nivel operativo vigente de un conductor es el menor
-- entre el nivel alcanzado por experiencia/certificación y el nivel permitido
-- por su calificación actual; ambos criterios deben cumplirse de forma
-- simultánea." Columna generada para poder filtrar/ordenar por SQL sin
-- duplicar la lógica de packages/shared/src/rules/elegibilidad-conductor.ts
-- (esa función sigue siendo la fuente de verdad para certificaciones e
-- incidencias graves, que esta columna no contempla por ser solo numérica).
alter table public.conductores
  add column nivel_operativo_vigente public.nivel_concer
  generated always as (
    case least(
      case nivel_por_experiencia
        when 'basico'    then 0
        when 'ejecutivo' then 1
        when 'luxury'    then 2
        when 'coleccion' then 3
      end,
      case nivel_por_calificacion
        when 'basico'    then 0
        when 'ejecutivo' then 1
        when 'luxury'    then 2
        when 'coleccion' then 3
      end
    )
      when 0 then 'basico'::public.nivel_concer
      when 1 then 'ejecutivo'::public.nivel_concer
      when 2 then 'luxury'::public.nivel_concer
      else 'coleccion'::public.nivel_concer
    end
  ) stored;

create trigger conductores_actualizado_en
  before update on public.conductores
  for each row execute function public.set_actualizado_en();

alter table public.conductores enable row level security;

create policy "conductor_ve_su_registro"
  on public.conductores for select
  using (auth.uid() = auth_user_id);

create policy "conductor_actualiza_su_registro"
  on public.conductores for update
  using (auth.uid() = auth_user_id);

-- PRD §3 — Admin puede suspender, revisar o bloquear conductores.
create policy "admin_acceso_total_conductores"
  on public.conductores for all
  using (public.es_admin());

-- PRD §4.3 — "El cliente puede ver certificaciones, estatus y rendimiento
-- del conductor." Se expone un subconjunto público de columnas vía esta
-- política; las apps deben seleccionar explícitamente solo esas columnas
-- (estado, nivel_operativo_vigente, calificacion_promedio) y no datos
-- personales, ya que RLS no oculta columnas, solo filas.
create policy "usuarios_ven_conductores_activos"
  on public.conductores for select
  using (estado in ('activo', 'modo_prueba_supervisada'));
