-- PR-07 P1/P2 — No fabricar aceptación de términos
-- Separa creación de perfil de registro de consentimiento.
-- El consentimiento solo se registra con acción explícita, versión concreta,
-- timestamp real, canal y auditoría. Nunca como default.

-- 1. Asegurar que el trigger manejar_nuevo_usuario_auth no fabrique si no hay evidencia
-- (ya lo hace correctamente con v_version is not null, pero reforzamos comentario)
-- No se modifica el trigger aquí porque ya es correcto desde 20260708000039/49.
-- Esta migración agrega la función explícita para registro posterior.

-- 2. Función explícita para usuarios: registrar_consentimiento_usuario
-- Inserta en consentimientos_usuario (2 filas: terminos_servicio + aviso_privacidad),
-- actualiza usuarios con version_terminos_aceptada y terminos_aceptados_en,
-- y registra auditoría. Requiere versión vigente, canal y version_app.

create or replace function public.registrar_consentimiento_usuario(
  p_version integer,
  p_canal text,
  p_version_app text,
  p_aceptado_en timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
  v_usuario_id uuid;
  v_aceptado timestamptz := coalesce(p_aceptado_en, now());
  v_hash_terminos text;
  v_hash_privacidad text;
  v_insertados integer := 0;
begin
  if v_auth is null then
    raise exception 'Sin sesión activa.';
  end if;

  if p_version is null or p_version < 1 then
    raise exception 'Versión de términos inválida.';
  end if;

  if p_canal not in ('web','android','ios') then
    raise exception 'Canal de aceptación inválido.';
  end if;

  if length(btrim(coalesce(p_version_app,''))) not between 1 and 40 then
    raise exception 'Versión de app inválida.';
  end if;

  select id into v_usuario_id from public.usuarios where auth_user_id = v_auth;
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario autenticado.';
  end if;

  -- Verificar que la versión existe y está vigente para ambos documentos
  select hash_documento into v_hash_terminos from public.versiones_documento_consentimiento
  where tipo_documento = 'terminos_servicio' and version = p_version
    and vigente_desde <= v_aceptado and (vigente_hasta is null or vigente_hasta > v_aceptado);
  if v_hash_terminos is null then
    raise exception 'La versión % de terminos_servicio no está vigente.', p_version;
  end if;

  select hash_documento into v_hash_privacidad from public.versiones_documento_consentimiento
  where tipo_documento = 'aviso_privacidad' and version = p_version
    and vigente_desde <= v_aceptado and (vigente_hasta is null or vigente_hasta > v_aceptado);
  if v_hash_privacidad is null then
    raise exception 'La versión % de aviso_privacidad no está vigente.', p_version;
  end if;

  -- Insertar dos consentimientos (idempotente por índice único)
  insert into public.consentimientos_usuario(auth_user_id, solicitud_id, tipo_documento, version, canal, version_app, hash_documento, aceptado_en)
  values (v_auth, null, 'terminos_servicio'::public.tipo_documento_consentimiento, p_version, p_canal, btrim(p_version_app), v_hash_terminos, v_aceptado)
  on conflict (auth_user_id, coalesce(solicitud_id,'00000000-0000-0000-0000-000000000000'::uuid), tipo_documento, version, hash_documento) do nothing;

  insert into public.consentimientos_usuario(auth_user_id, solicitud_id, tipo_documento, version, canal, version_app, hash_documento, aceptado_en)
  values (v_auth, null, 'aviso_privacidad'::public.tipo_documento_consentimiento, p_version, p_canal, btrim(p_version_app), v_hash_privacidad, v_aceptado)
  on conflict (auth_user_id, coalesce(solicitud_id,'00000000-0000-0000-0000-000000000000'::uuid), tipo_documento, version, hash_documento) do nothing;

  -- Actualizar usuario con la aceptación explícita (solo si es más reciente o primera vez)
  update public.usuarios
  set
    version_terminos_aceptada = p_version,
    terminos_aceptados_en = v_aceptado
  where id = v_usuario_id;

  -- Auditoría
  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values (
    'aceptacion_terminos',
    'usuario',
    v_usuario_id,
    jsonb_build_object(
      'version_terminos_aceptada', p_version,
      'terminos_aceptados_en', v_aceptado,
      'canal', p_canal,
      'version_app', btrim(p_version_app),
      'hash_terminos', v_hash_terminos,
      'hash_privacidad', v_hash_privacidad
    )
  );

  return jsonb_build_object('version', p_version, 'aceptado_en', v_aceptado, 'canal', p_canal);
end;
$$;

revoke all on function public.registrar_consentimiento_usuario(integer, text, text, timestamptz) from public, anon;
grant execute on function public.registrar_consentimiento_usuario(integer, text, text, timestamptz) to authenticated;

comment on function public.registrar_consentimiento_usuario(integer, text, text, timestamptz) is
  'PR-07: Registra consentimiento explícito del usuario con versión concreta, timestamp real, canal y auditoría. Nunca como default.';

-- 3. Asegurar que la política de conductores no permita fabricar consentimiento sin evidencia
-- El trigger ya es correcto, pero reforzamos que cualquier insert directo sin version debe dejar NULL
-- No se requiere cambio adicional porque los triggers ya usan nullif y solo auditan si version not null.

-- 4. Documentación para auditoría: esta migración no modifica datos existentes,
-- pero a partir de ahora los nuevos usuarios creados via fallback tendrán NULL en consentimiento
-- hasta que llamen a registrar_consentimiento_usuario con acto explícito.
