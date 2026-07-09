-- Auditoría H-8 — `registro_auditoria` debe ser una bitácora inmutable
-- (append-only). Hoy la policy "admin_acceso_total_auditoria" (0014) es FOR ALL,
-- así que una sesión de Admin comprometida podría UPDATE/DELETE eventos y
-- alterar la traza forense. Para una bitácora con valor legal (PRD §16), lo
-- correcto es: cualquiera con permiso puede INSERTAR, nadie puede modificar ni
-- borrar — ni siquiera Admin desde la app.
--
-- Se sustituye la policy FOR ALL de Admin por una FOR SELECT (Admin sigue
-- leyendo toda la bitácora en la Torre de Control) y se añade un trigger que
-- bloquea UPDATE y DELETE a nivel de tabla, independientemente del rol o de
-- que alguien agregue una policy permisiva por error en el futuro. El trigger
-- NO es security definer a propósito: debe aplicar a todos por igual. Los
-- procesos legítimos (service_role de los webhooks) solo hacen INSERT, así que
-- no se ven afectados.

-- 1) Admin: de acceso total a solo-lectura sobre la bitácora.
drop policy if exists "admin_acceso_total_auditoria" on public.registro_auditoria;

create policy "admin_lee_auditoria"
  on public.registro_auditoria for select
  using (public.es_admin());

-- La policy de INSERT "actor_registra_su_propio_evento" (0014) se conserva
-- intacta: permite que usuario/conductor/admin registren SU propio evento.

-- 2) Inmutabilidad dura a nivel de tabla: sin UPDATE ni DELETE para nadie.
--    service_role IGNORA RLS, pero NO ignora triggers BEFORE, así que este
--    guard protege incluso frente a un service_role mal usado.
create or replace function public.bloquear_mutacion_auditoria()
returns trigger
language plpgsql
as $$
begin
  raise exception 'registro_auditoria es una bitácora append-only: no se permite % .', tg_op;
end;
$$;

drop trigger if exists auditoria_no_update on public.registro_auditoria;
create trigger auditoria_no_update
  before update on public.registro_auditoria
  for each row execute function public.bloquear_mutacion_auditoria();

drop trigger if exists auditoria_no_delete on public.registro_auditoria;
create trigger auditoria_no_delete
  before delete on public.registro_auditoria
  for each row execute function public.bloquear_mutacion_auditoria();
