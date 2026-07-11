-- RT-23 / RT-24 — El guard y el historial necesitan resolver al admin actual
-- y mostrar quién tomó cada decisión. RLS sigue impidiendo acceso no-admin.

grant select on public.admins to authenticated;

drop policy if exists "admins_ven_equipo_torre_control" on public.admins;
create policy "admins_ven_equipo_torre_control"
  on public.admins for select
  using (public.es_admin());

comment on policy "admins_ven_equipo_torre_control" on public.admins is
  'Permite a un administrador autenticado identificar a los revisores de decisiones auditadas.';
