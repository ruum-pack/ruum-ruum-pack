-- Registro completo de conductor: persiste los datos capturados en el flujo
-- de 5 pasos para que Operacion pueda verificar identidad, domicilio,
-- licencia, antecedentes y contacto de emergencia desde Supabase.

alter table public.conductores
  add column if not exists curp text,
  add column if not exists codigo_postal text,
  add column if not exists estado_residencia text,
  add column if not exists ciudad_municipio text,
  add column if not exists colonia text,
  add column if not exists calle text,
  add column if not exists numero text,
  add column if not exists referencias text,
  add column if not exists licencia_numero text,
  add column if not exists licencia_tipo text,
  add column if not exists licencia_vigencia date,
  add column if not exists autoriza_verificacion_antecedentes boolean not null default false,
  add column if not exists declara_sin_suspensiones boolean not null default false,
  add column if not exists contacto_emergencia_nombre text,
  add column if not exists contacto_emergencia_telefono text,
  add column if not exists version_terminos_aceptada integer,
  add column if not exists terminos_aceptados_en timestamptz,
  add column if not exists marca_terminos text;

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
      nullif(new.raw_user_meta_data->>'curp', ''),
      nullif(coalesce(new.raw_user_meta_data->>'codigo_postal', new.raw_user_meta_data#>>'{domicilio,codigo_postal}'), ''),
      nullif(coalesce(new.raw_user_meta_data->>'estado_residencia', new.raw_user_meta_data#>>'{domicilio,estado}'), ''),
      nullif(coalesce(new.raw_user_meta_data->>'ciudad_municipio', new.raw_user_meta_data#>>'{domicilio,ciudad_municipio}'), ''),
      nullif(coalesce(new.raw_user_meta_data->>'colonia', new.raw_user_meta_data#>>'{domicilio,colonia}'), ''),
      nullif(coalesce(new.raw_user_meta_data->>'calle', new.raw_user_meta_data#>>'{domicilio,calle}'), ''),
      nullif(coalesce(new.raw_user_meta_data->>'numero', new.raw_user_meta_data#>>'{domicilio,numero}'), ''),
      nullif(coalesce(new.raw_user_meta_data->>'referencias', new.raw_user_meta_data#>>'{domicilio,referencias}'), ''),
      nullif(coalesce(new.raw_user_meta_data->>'licencia_numero', new.raw_user_meta_data#>>'{licencia,numero}'), ''),
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
