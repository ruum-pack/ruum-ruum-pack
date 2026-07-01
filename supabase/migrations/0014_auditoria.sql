-- PRD §16 — Eventos auditables. Cada evento registra timestamp, actor,
-- acción, datos relevantes e IP/dispositivo si aplica.
create type public.evento_auditable as enum (
  'creacion_cuenta',
  'verificacion_cuenta',
  'carga_documentos',
  'validacion_documentos',
  'creacion_solicitud_traslado',
  'generacion_cotizacion',
  'confirmacion_servicio',
  'asignacion_conductor',
  'aceptacion_traslado_conductor',
  'llegada_conductor_origen',
  'captura_evidencia_inicial',
  'confirmacion_vehiculo_recibido',
  'inicio_traslado',
  'reporte_incidencia',
  'llegada_destino',
  'captura_evidencia_final',
  'confirmacion_entrega',
  'registro_pago',
  'cierre_traslado',
  'cancelacion_traslado',
  'apertura_disputa',
  'resolucion_disputa',
  'apertura_reclamo_seguro',
  'resolucion_reclamo_seguro',
  'suspension_conductor',
  'modificacion_traslado_activo',
  'activacion_soporte_emergencia',
  'comunicacion_usuario_conductor',
  'calificacion_conductor',
  'exportacion_pasaporte_pdf',
  'asignacion_modo_prueba_supervisada',
  'resultado_modo_prueba_supervisada'
);

create type public.actor_auditoria as enum ('usuario', 'conductor', 'admin', 'sistema');

create table public.registro_auditoria (
  id            uuid primary key default gen_random_uuid(),
  traslado_id   uuid references public.traslados(id) on delete set null,
  evento        public.evento_auditable not null,
  actor         public.actor_auditoria not null,
  actor_id      uuid not null,
  datos         jsonb not null default '{}'::jsonb,
  ip            inet,
  dispositivo   text,
  timestamp     timestamptz not null default now()
);

create index registro_auditoria_traslado_idx on public.registro_auditoria (traslado_id);
create index registro_auditoria_evento_idx on public.registro_auditoria (evento, timestamp desc);

alter table public.registro_auditoria enable row level security;

-- PRD §16 — la bitácora es de uso interno (Torre de Control); ningún rol de
-- usuario/conductor tiene política de SELECT directa sobre esta tabla. El
-- detalle relevante para usuario/conductor se expone a través de los datos
-- propios de cada traslado (estado, evidencia, pagos), no de la auditoría cruda.
create policy "admin_acceso_total_auditoria"
  on public.registro_auditoria for all
  using (public.es_admin());

-- Inserción de eventos: en producción normalmente la hace una función de
-- backend con service_role (que ignora RLS), no el cliente directamente.
-- Esta política permite que cualquier usuario autenticado registre SU
-- PROPIO evento (actor_id = su propio id en usuarios o conductores) para
-- los flujos donde la app cliente registra auditoría directamente.
create policy "actor_registra_su_propio_evento"
  on public.registro_auditoria for insert
  with check (
    actor_id in (select id from public.usuarios where auth_user_id = auth.uid())
    or actor_id in (select id from public.conductores where auth_user_id = auth.uid())
    or public.es_admin()
  );
