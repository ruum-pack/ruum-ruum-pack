-- Permite capturar datos fiscales desde la app de usuario.
-- Las cuentas personales guardan su facturación en usuarios; los titulares de
-- empresa también pueden mantener sincronizados los datos de su empresa.

alter table public.usuarios
  add column if not exists rfc text,
  add column if not exists razon_social text,
  add column if not exists regimen_fiscal text,
  add column if not exists codigo_postal_fiscal text,
  add column if not exists uso_cfdi text;

create policy "titular_actualiza_su_empresa"
  on public.empresas for update
  using (
    id in (
      select u.empresa_id from public.usuarios u
      where u.auth_user_id = auth.uid() and u.rol = 'titular_empresa'
    )
  )
  with check (
    id in (
      select u.empresa_id from public.usuarios u
      where u.auth_user_id = auth.uid() and u.rol = 'titular_empresa'
    )
  );
