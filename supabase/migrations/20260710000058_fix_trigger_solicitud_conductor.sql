-- RT-03 — Corrige el tipo del CASE que determina el estado inicial desde Auth.
-- Se agrega como migración nueva porque 57 ya fue aplicada localmente.

create or replace function public.manejar_nuevo_usuario_auth()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo_registro text := new.raw_user_meta_data->>'tipo_registro';
  v_tipo_cuenta text := coalesce(new.raw_user_meta_data->>'tipo_cuenta', 'personal');
  v_actor_id uuid; v_actor public.actor_auditoria;
  v_version integer := nullif(coalesce(new.raw_user_meta_data->>'version_terminos_aceptada', new.raw_user_meta_data#>>'{legales,version_terminos_aceptada}'), '')::integer;
  v_aceptados timestamptz := nullif(coalesce(new.raw_user_meta_data->>'terminos_aceptados_en', new.raw_user_meta_data#>>'{legales,terminos_aceptados_en}'), '')::timestamptz;
begin
  if v_tipo_registro = 'usuario' then
    insert into public.usuarios (auth_user_id, nombre, tipo_cuenta, rol, estado_verificacion, telefono, pais, estado, codigo_postal, ciudad, colonia, calle, numero, referencias, direccion_principal, version_terminos_aceptada, terminos_aceptados_en)
    values (new.id, new.raw_user_meta_data->>'nombre', v_tipo_cuenta, (case when v_tipo_cuenta='empresa' then 'titular_empresa' else 'personal' end)::rol_usuario, 'pendiente', new.raw_user_meta_data->>'telefono', coalesce(new.raw_user_meta_data->>'pais','México'), new.raw_user_meta_data->>'estado', new.raw_user_meta_data->>'codigo_postal', new.raw_user_meta_data->>'ciudad', new.raw_user_meta_data->>'colonia', new.raw_user_meta_data->>'calle', new.raw_user_meta_data->>'numero', new.raw_user_meta_data->>'referencias', new.raw_user_meta_data->>'direccion_principal', v_version, v_aceptados)
    returning id into v_actor_id;
    v_actor := 'usuario';
  elsif v_tipo_registro = 'conductor' then
    begin
      insert into public.solicitudes_conductor (auth_user_id, estado, paso_actual, datos_personales, domicilio, licencia, contacto_emergencia)
      values (
        new.id,
        (case when new.email_confirmed_at is null then 'correo_pendiente' else 'documentos_pendientes' end)::public.estado_expediente_conductor,
        5,
        jsonb_build_object('nombre', coalesce(new.raw_user_meta_data->>'nombre',''), 'telefono', new.raw_user_meta_data->>'telefono', 'curp', upper(new.raw_user_meta_data->>'curp'), 'autoriza_verificacion_antecedentes', coalesce((new.raw_user_meta_data->>'autoriza_verificacion_antecedentes')::boolean,false), 'declara_sin_suspensiones', coalesce((new.raw_user_meta_data->>'declara_sin_suspensiones')::boolean,false), 'version_terminos_aceptada', v_version, 'terminos_aceptados_en', v_aceptados, 'marca_terminos', new.raw_user_meta_data#>>'{legales,marca}'),
        coalesce(new.raw_user_meta_data->'domicilio', '{}'::jsonb),
        coalesce(new.raw_user_meta_data->'licencia', '{}'::jsonb),
        coalesce(new.raw_user_meta_data->'contacto_emergencia', '{}'::jsonb)
      ) returning id into v_actor_id;
    exception when unique_violation then
      if sqlerrm ilike '%curp%' then raise exception 'conductor_duplicado:curp' using errcode='23505';
      elsif sqlerrm ilike '%telefono%' then raise exception 'conductor_duplicado:telefono' using errcode='23505';
      elsif sqlerrm ilike '%licencia%' then raise exception 'conductor_duplicado:licencia' using errcode='23505';
      elsif sqlerrm ilike '%auth_activa%' then raise exception 'solicitud_duplicada:activa' using errcode='23505';
      else raise; end if;
    end;
    v_actor := 'conductor';
  end if;
  if v_actor_id is not null then
    insert into public.registro_auditoria(evento, actor, actor_id, datos)
    values ('creacion_cuenta', v_actor, v_actor_id, jsonb_build_object('auth_user_id',new.id,'tipo_registro',v_tipo_registro,'tipo_cuenta',v_tipo_cuenta));
  end if;
  if v_actor_id is not null and v_version is not null then
    insert into public.registro_auditoria(evento, actor, actor_id, datos)
    values ('aceptacion_terminos', v_actor, v_actor_id, jsonb_build_object('version_terminos_aceptada',v_version,'terminos_aceptados_en',v_aceptados));
  end if;
  return new;
end;
$$;
