-- Bug real encontrado al construir el flujo de registro/login real: ninguna
-- de las dos tablas tenía política de INSERT para autoservicio. 0002 y 0003
-- solo cubrían SELECT/UPDATE sobre el propio registro — alguien podía
-- iniciar sesión y ver/editar su fila, pero nunca podía CREARLA en primer
-- lugar bajo RLS real. Mismo patrón de detección que 0018/0019 (Fase 2):
-- nunca se había probado el flujo completo bajo un rol no-superusuario.
--
-- admins NO recibe una política equivalente, a propósito: un admin nunca
-- debe poder auto-registrarse desde un formulario público (PRD §3 — Admin
-- es "equipo operativo interno"). Esa fila se crea manualmente.
create policy "usuario_crea_su_registro"
  on public.usuarios for insert
  with check (auth.uid() = auth_user_id);

create policy "conductor_crea_su_registro"
  on public.conductores for insert
  with check (auth.uid() = auth_user_id);
