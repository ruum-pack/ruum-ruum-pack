-- Complemento de 20260710000052_conductores_unicidad.sql — el trigger
-- on_auth_user_created corre en la misma transacción que auth.signUp().
-- Si el insert en public.conductores choca con alguno de los índices únicos
-- nuevos (curp/telefono/licencia_numero), toda la transacción de signUp
-- revienta y GoTrue le devuelve al cliente un error genérico de Postgres
-- ("duplicate key value violates unique constraint...") que no dice nada
-- útil al conductor ni es fácil de traducir en traducirErrorAuth().
--
-- Se envuelve solo el insert de conductores en un bloque con EXCEPTION
-- WHEN unique_violation para relanzar un mensaje identificable por prefijo
-- ("conductor_duplicado:") que el frontend puede reconocer y traducir a
-- un mensaje específico por campo. El resto del trigger (rama usuario,
-- auditoría) queda igual que en 20260708000049.
create or replace function public.manejar_nuevo_usuario_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo_registro text := new.raw_user_meta_data->>'tipo_registro';
  v_tipo_cuenta text := coalesce(new.raw_user_meta_data->>'tipo_cuenta', 'personal');
  v_actor_id uuid;
  v_actor public.actor_auditoria;
  v_version_terminos integer := nullif(coalesce(
    new.raw_user_meta_data->>'version_terminos_aceptada',
    new.raw_user_meta_data#>>'{legales,version_terminos_aceptada}'
  ), '')::integer;
  v_terminos_aceptados_en timestamptz := nullif(coalesce(
    new.raw_user_meta_data->>'terminos_aceptados_en',
    new.raw_user_meta_data#>>'{legales,terminos_aceptados_en}'
  ), '')::timestamptz;
  v_curp text := nullif(new.raw_user_meta_data->>'curp', '');
  v_licencia_numero text := nullif(coalesce(new.raw_user_meta_data->>'licencia_numero', new.raw_user_meta_data#>>'{licencia,numero}'), '');
begin
  if v_tipo_registro = 'usuario' then
    insert into public.usuarios (
      auth_user_id,
      nombre,
      tipo_cuenta,
      rol,
      estado_verificacion,
      telefono,
      pais,
      estado,
      codigo_postal,
      ciudad,
      colonia,
      calle,
      numero,
      referencias,
      direccion_principal,
      version_terminos_aceptada,
      terminos_aceptados_en
    )
    values (
      new.id,
      new.raw_user_meta_data->>'nombre',
      v_tipo_cuenta,
      (case when v_tipo_cuenta = 'empresa' then 'titular_empresa' else 'personal' end)::rol_usuario,
      'pendiente',
      new.raw_user_meta_data->>'telefono',
      coalesce(new.raw_user_meta_data->>'pais', 'México'),
      new.raw_user_meta_data->>'estado',
      new.raw_user_meta_data->>'codigo_postal',
      new.raw_user_meta_data->>'ciudad',
      new.raw_user_meta_data->>'colonia',
      new.raw_user_meta_data->>'calle',
      new.raw_user_meta_data->>'numero',
      new.raw_user_meta_data->>'referencias',
      new.raw_user_meta_data->>'direccion_principal',
      v_version_terminos,
      v_terminos_aceptados_en
    )
    returning id into v_actor_id;
    v_actor := 'usuario';
  elsif v_tipo_registro = 'conductor' then
    begin
      insert into public.conductores (
        auth_user_id,
        nombre,
        telefono,
        curp,
        codigo_postal,
        estado_residencia,
        ciudad_municipio,
        colonia,
        calle,
        numero,
        referencias,
        licencia_numero,
        licencia_tipo,
        licencia_vigencia,
        autoriza_verificacion_antecedentes,
        declara_sin_suspensiones,
        contacto_emergencia_nombre,
        contacto_emergencia_telefono,
        version_terminos_aceptada,
        terminos_aceptados_en,
        marca_terminos
      )
      values (
        new.id,
        coalesce(new.raw_user_meta_data->>'nombre', ''),
        new.raw_user_meta_data->>'telefono',
        v_curp,
        nullif(coalesce(new.raw_user_meta_data->>'codigo_postal', new.raw_user_meta_data#>>'{domicilio,codigo_postal}'), ''),
        nullif(coalesce(new.raw_user_meta_data->>'estado_residencia', new.raw_user_meta_data#>>'{domicilio,estado}'), ''),
        nullif(coalesce(new.raw_user_meta_data->>'ciudad_municipio', new.raw_user_meta_data#>>'{domicilio,ciudad_municipio}'), ''),
        nullif(coalesce(new.raw_user_meta_data->>'colonia', new.raw_user_meta_data#>>'{domicilio,colonia}'), ''),
        nullif(coalesce(new.raw_user_meta_data->>'calle', new.raw_user_meta_data#>>'{domicilio,calle}'), ''),
        nullif(coalesce(new.raw_user_meta_data->>'numero', new.raw_user_meta_data#>>'{domicilio,numero}'), ''),
        nullif(coalesce(new.raw_user_meta_data->>'referencias', new.raw_user_meta_data#>>'{domicilio,referencias}'), ''),
        v_licencia_numero,
        nullif(coalesce(new.raw_user_meta_data->>'licencia_tipo', new.raw_user_meta_data#>>'{licencia,tipo}'), ''),
        nullif(coalesce(new.raw_user_meta_data->>'licencia_vigencia', new.raw_user_meta_data#>>'{licencia,vigencia}'), '')::date,
        coalesce(nullif(new.raw_user_meta_data->>'autoriza_verificacion_antecedentes', '')::boolean, (new.raw_user_meta_data#>>'{verificacion,autoriza_antecedentes}')::boolean, false),
        coalesce(nullif(new.raw_user_meta_data->>'declara_sin_suspensiones', '')::boolean, (new.raw_user_meta_data#>>'{verificacion,declara_sin_suspensiones}')::boolean, false),
        nullif(coalesce(new.raw_user_meta_data->>'contacto_emergencia_nombre', new.raw_user_meta_data#>>'{contacto_emergencia,nombre}'), ''),
        nullif(coalesce(new.raw_user_meta_data->>'contacto_emergencia_telefono', new.raw_user_meta_data#>>'{contacto_emergencia,telefono}'), ''),
        v_version_terminos,
        v_terminos_aceptados_en,
        nullif(coalesce(new.raw_user_meta_data->>'marca_terminos', new.raw_user_meta_data#>>'{legales,marca}'), '')
      )
      returning id into v_actor_id;
    exception when unique_violation then
      if sqlerrm ilike '%conductores_curp_unico%' then
        raise exception 'conductor_duplicado:curp' using errcode = '23505';
      elsif sqlerrm ilike '%conductores_telefono_unico%' then
        raise exception 'conductor_duplicado:telefono' using errcode = '23505';
      elsif sqlerrm ilike '%conductores_licencia_numero_unico%' then
        raise exception 'conductor_duplicado:licencia' using errcode = '23505';
      else
        raise exception 'conductor_duplicado:desconocido' using errcode = '23505';
      end if;
    end;
    v_actor := 'conductor';
  end if;

  if v_actor_id is not null then
    insert into public.registro_auditoria (evento, actor, actor_id, datos)
    values (
      'creacion_cuenta',
      v_actor,
      v_actor_id,
      jsonb_build_object(
        'auth_user_id', new.id,
        'tipo_registro', v_tipo_registro,
        'tipo_cuenta', v_tipo_cuenta
      )
    );
  end if;

  if v_actor_id is not null and v_version_terminos is not null then
    insert into public.registro_auditoria (evento, actor, actor_id, datos)
    values (
      'aceptacion_terminos',
      v_actor,
      v_actor_id,
      jsonb_build_object(
        'version_terminos_aceptada', v_version_terminos,
        'terminos_aceptados_en', v_terminos_aceptados_en
      )
    );
  end if;

  return new;
end;
$$;
