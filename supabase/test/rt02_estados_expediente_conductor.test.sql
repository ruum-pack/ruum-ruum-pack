begin;

do $$
declare
  v_conductor_id uuid;
  v_documento_id uuid;
  v_error text;
begin
  if (select count(*) from public.expediente_conductor_transiciones) <> 15 then
    raise exception 'RT-02: se esperaban 15 transiciones de expediente.';
  end if;
  if (select count(*) from public.documento_conductor_transiciones) <> 7 then
    raise exception 'RT-02: se esperaban 7 transiciones de documento.';
  end if;

  insert into public.conductores (
    nombre, telefono, curp, codigo_postal, estado_residencia, ciudad_municipio,
    colonia, calle, numero, licencia_numero, licencia_tipo, licencia_vigencia,
    autoriza_verificacion_antecedentes, declara_sin_suspensiones,
    contacto_emergencia_nombre, contacto_emergencia_telefono,
    version_terminos_aceptada, terminos_aceptados_en
  ) values (
    'RT-02 prueba', '+525500000099', 'TEST000000HDFABC09', '01000', 'Ciudad de México',
    'Álvaro Obregón', 'San Ángel', 'Prueba', '1', 'LIC-RT02', 'Tipo A', current_date + 365,
    true, true, 'Contacto Prueba', '5500000098', 1, now()
  ) returning id into v_conductor_id;
  if (select estado_expediente from public.conductores where id = v_conductor_id) <> 'borrador' then
    raise exception 'RT-02: un conductor sin Auth debe iniciar como borrador.';
  end if;

  -- La función interna puede recorrer una arista válida.
  perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'correo_pendiente');

  -- Ni siquiera una escritura SQL privilegiada puede saltarse el flujo.
  begin
    update public.conductores set estado_expediente = 'datos_incompletos' where id = v_conductor_id;
    raise exception 'RT-02: la escritura directa de estado fue aceptada.';
  exception when others then
    v_error := sqlerrm;
    if v_error not ilike '%flujo autorizado%' then raise; end if;
  end;

  perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'documentos_pendientes');

  -- Una transición inexistente también falla dentro del mecanismo autorizado.
  begin
    perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'aprobado');
    raise exception 'RT-02: se aceptó documentos_pendientes -> aprobado.';
  exception when others then
    v_error := sqlerrm;
    if v_error not ilike '%Transición de expediente no permitida%' then raise; end if;
  end;

  insert into public.documentos_conductor (
    conductor_id, tipo, nombre_archivo, url, estado
  ) values (
    v_conductor_id, 'licencia_frente', 'prueba.pdf', 'rt02/prueba.pdf', 'en_revision'
  ) returning id into v_documento_id;

  begin
    update public.documentos_conductor set estado = 'aprobado' where id = v_documento_id;
    raise exception 'RT-02: la escritura directa del documento fue aceptada.';
  exception when others then
    v_error := sqlerrm;
    if v_error not ilike '%flujo autorizado%' then raise; end if;
  end;

  insert into public.documentos_conductor (conductor_id, tipo, nombre_archivo, url, estado) values
    (v_conductor_id, 'licencia_reverso', 'reverso.pdf', 'rt02/reverso.pdf', 'en_revision'),
    (v_conductor_id, 'identificacion_oficial', 'identificacion.pdf', 'rt02/identificacion.pdf', 'en_revision');

  if (select estado_expediente from public.conductores where id = v_conductor_id) <> 'en_revision' then
    raise exception 'RT-02: el expediente completo no avanzó hasta en_revision.';
  end if;

  raise notice 'RT-02 OK: transiciones inventariadas y escrituras administrativas directas bloqueadas.';
end $$;

rollback;
