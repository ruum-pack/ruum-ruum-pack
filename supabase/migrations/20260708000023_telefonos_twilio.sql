-- Decisión de producto (Twilio, sesión de arquitectura 2026-06-27) — bug
-- real encontrado al construir la integración: ni usuarios ni conductores
-- tenían columna de teléfono. Sin el número real de cada parte, Twilio
-- Proxy no tiene a quién relacionar con el número virtual de la sesión —
-- el chat (PRD §4.12) nunca necesitó esto porque es texto dentro de la app,
-- pero la llamada enmascarada sí necesita un teléfono real de cada lado.
alter table public.usuarios add column telefono text;
alter table public.conductores add column telefono text;

comment on column public.usuarios.telefono is
  'Formato E.164 (+52...). Nulo hasta que /registro lo capture. Requerido por Twilio Proxy para llamadas enmascaradas (PRD §4.12) — sin esto, crear-llamada-enmascarada rechaza la solicitud con un mensaje claro en vez de fallar contra la API de Twilio.';
comment on column public.conductores.telefono is
  'Formato E.164 (+52...). Mismo criterio que usuarios.telefono.';

-- Una sesión de Twilio Proxy por traslado (se reutiliza en llamadas
-- repetidas durante el mismo traslado, no se crea una nueva cada vez).
create table public.sesiones_proxy_traslado (
  id                          uuid primary key default gen_random_uuid(),
  traslado_id                 uuid not null unique references public.traslados(id) on delete cascade,
  twilio_session_sid          text not null unique,
  numero_virtual              text not null,
  participante_usuario_sid    text not null,
  participante_conductor_sid  text not null,
  creada_en                   timestamptz not null default now(),
  cerrada_en                  timestamptz
);

alter table public.sesiones_proxy_traslado enable row level security;

create policy "usuario_ve_su_sesion_proxy"
  on public.sesiones_proxy_traslado for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "conductor_ve_su_sesion_proxy"
  on public.sesiones_proxy_traslado for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_sesiones_proxy"
  on public.sesiones_proxy_traslado for all
  using (public.es_admin());

-- Identificador de la sesión en llamadas_enmascaradas, para relacionar cada
-- llamada individual con la sesión de Proxy que la originó.
alter table public.llamadas_enmascaradas
  add column sesion_proxy_id uuid references public.sesiones_proxy_traslado(id);

-- Espejo en SQL de packages/shared/src/rules/chat-disponible.ts — necesario
-- porque las Edge Functions (Deno, fuera del monorepo de TS) no pueden
-- importar ese paquete directamente. Si se actualiza una, hay que
-- actualizar la otra; quedó documentado en ambos archivos.
create or replace function public.chat_disponible(p_estado public.estado_traslado)
returns boolean
language sql
immutable
as $$
  select p_estado in (
    'conductor_asignado', 'conductor_en_camino_al_origen', 'conductor_en_punto_de_recoleccion',
    'verificacion_vehiculo_en_proceso', 'evidencia_inicial_en_proceso', 'evidencia_inicial_completada',
    'vehiculo_recibido', 'traslado_en_curso', 'incidencia_reportada', 'llegada_a_destino',
    'evidencia_final_en_proceso', 'evidencia_final_completada', 'entrega_confirmada',
    'pago_pendiente', 'pago_completado'
  );
$$;
