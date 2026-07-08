-- PRD §4.1 — Usuarios: cuentas personales y empresa, historial de pago.
create table public.usuarios (
  id                                    uuid primary key default gen_random_uuid(),
  auth_user_id                          uuid unique references auth.users(id) on delete cascade,
  tipo_cuenta                           text not null check (tipo_cuenta in ('personal', 'empresa')),
  rol                                   public.rol_usuario not null default 'personal',
  empresa_id                            uuid,
  estado_verificacion                   public.estado_verificacion not null default 'pendiente',
  -- PRD §4.6 — historial positivo habilita pago al cierre (umbral ajustable por Admin)
  traslados_completados_sin_incidencia  int not null default 0,
  metodo_pago_registrado                boolean not null default false,
  creado_en                             timestamptz not null default now(),
  actualizado_en                        timestamptz not null default now()
);

create trigger usuarios_actualizado_en
  before update on public.usuarios
  for each row execute function public.set_actualizado_en();

alter table public.usuarios enable row level security;

-- El usuario solo ve y edita su propio registro.
create policy "usuario_ve_su_registro"
  on public.usuarios for select
  using (auth.uid() = auth_user_id);

create policy "usuario_actualiza_su_registro"
  on public.usuarios for update
  using (auth.uid() = auth_user_id);

-- PRD §3 — Admin / Torre de Control: acceso total para verificar y supervisar.
create policy "admin_acceso_total_usuarios"
  on public.usuarios for all
  using (public.es_admin());

-- PRD §3 — "Titular empresa": puede ver el historial de su empresa, lo que
-- incluye al usuario autorizado de la misma empresa.
create policy "titular_ve_usuarios_de_su_empresa"
  on public.usuarios for select
  using (
    empresa_id is not null
    and empresa_id in (
      select u.empresa_id from public.usuarios u
      where u.auth_user_id = auth.uid() and u.rol = 'titular_empresa'
    )
  );
