-- Sprint C5: observabilidad segura, versionado mínimo y feature flags.
create table if not exists public.eventos_operativos_app (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete set null,
  plataforma text not null default 'android' check (plataforma in ('android','ios','web')),
  version_app text not null,
  tipo text not null check (tipo in ('startup_failure','permission_error','tracking_stopped','sync_failure','evidence_stuck','rpc_failure','session_expired','push_not_registered','native_crash')),
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
create index if not exists eventos_operativos_app_version_fecha_idx on public.eventos_operativos_app(version_app, creado_en desc);
create index if not exists eventos_operativos_app_tipo_fecha_idx on public.eventos_operativos_app(tipo, creado_en desc);
alter table public.eventos_operativos_app enable row level security;

drop policy if exists eventos_operativos_app_insert_own on public.eventos_operativos_app;
create policy eventos_operativos_app_insert_own on public.eventos_operativos_app for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists eventos_operativos_app_read_own on public.eventos_operativos_app;
create policy eventos_operativos_app_read_own on public.eventos_operativos_app for select to authenticated using (usuario_id = auth.uid());

create table if not exists public.politicas_version_app (
  plataforma text primary key check (plataforma in ('android','ios','web')),
  version_minima text not null,
  version_recomendada text not null,
  version_vigente text not null,
  mensaje text,
  funcionalidades_incompatibles text[] not null default '{}',
  actualizado_en timestamptz not null default now()
);
insert into public.politicas_version_app(plataforma, version_minima, version_recomendada, version_vigente, mensaje)
values ('android','0.0.1','0.0.1','0.0.1','Actualiza Ruum Ruum Conductor para continuar operando con seguridad.')
on conflict (plataforma) do nothing;
alter table public.politicas_version_app enable row level security;
create policy politicas_version_app_read on public.politicas_version_app for select to authenticated using (true);

create table if not exists public.feature_flags_app (
  clave text primary key,
  descripcion text,
  habilitada boolean not null default false,
  porcentaje_rollout smallint not null default 0 check (porcentaje_rollout between 0 and 100),
  versiones_permitidas text[] not null default '{}',
  actualizado_en timestamptz not null default now()
);
alter table public.feature_flags_app enable row level security;
create policy feature_flags_app_read on public.feature_flags_app for select to authenticated using (true);

create or replace function public.registrar_evento_operativo_app(p_tipo text, p_version_app text, p_detalle jsonb default '{}'::jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_text text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  v_text := lower(coalesce(p_detalle::text,''));
  if v_text ~ '(curp|clabe|numero.?de.?cuenta|tarjeta|access.?token|refresh.?token|signed.?url|fotografia|imagen)' then
    raise exception 'SENSITIVE_TELEMETRY_REJECTED' using errcode='22023';
  end if;
  insert into public.eventos_operativos_app(usuario_id,version_app,tipo,detalle)
  values(auth.uid(), left(coalesce(p_version_app,'desconocida'),40), p_tipo, coalesce(p_detalle,'{}'::jsonb)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.obtener_politica_version_app(p_plataforma text, p_version_actual text)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'current', p_version_actual,
    'minimum', version_minima,
    'recommended', version_recomendada,
    'latest', version_vigente,
    'mandatory', string_to_array(p_version_actual,'.')::int[] < string_to_array(version_minima,'.')::int[],
    'incompatibleFeatures', funcionalidades_incompatibles,
    'message', mensaje
  ) from public.politicas_version_app where plataforma=p_plataforma;
$$;

grant execute on function public.registrar_evento_operativo_app(text,text,jsonb) to authenticated;
grant execute on function public.obtener_politica_version_app(text,text) to authenticated;
