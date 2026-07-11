-- RT-10 — El envío explícito aplica a solicitudes v2. Los expedientes legacy
-- ligados directamente a conductores conservan su automatización previa.

create or replace function public.preparar_expediente_por_documento()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_estado public.estado_expediente_conductor;
begin
  perform set_config('ruum.cambio_documento_autorizado','si',true);
  update public.documentos_conductor set estado='reemplazado',actualizado_en=now()
    where id<>new.id and tipo=new.tipo
      and ((new.solicitud_id is not null and solicitud_id=new.solicitud_id) or (new.conductor_id is not null and conductor_id=new.conductor_id))
      and estado in ('en_revision','aprobado','rechazado','vencido');
  perform set_config('ruum.cambio_documento_autorizado','',true);
  if new.solicitud_id is not null then
    select estado into v_estado from public.solicitudes_conductor where id=new.solicitud_id;
    if v_estado='requiere_correccion' then
      perform public.cambiar_estado_solicitud_conductor(new.solicitud_id,'documentos_pendientes');
    end if;
  elsif new.conductor_id is not null then
    select estado_expediente into v_estado from public.conductores where id=new.conductor_id;
    if v_estado='requiere_correccion' then
      perform public.cambiar_estado_expediente_conductor(new.conductor_id,'documentos_pendientes');
      v_estado:='documentos_pendientes';
    end if;
    if v_estado='documentos_pendientes'
      and public.expediente_conductor_tiene_datos(new.conductor_id)
      and not exists(
        select 1 from (values('licencia_frente'),('licencia_reverso'),('identificacion_oficial')) r(tipo)
        where not exists(select 1 from public.documentos_conductor d
          where d.conductor_id=new.conductor_id and d.tipo=r.tipo and d.estado='en_revision')
      ) then
      perform public.cambiar_estado_expediente_conductor(new.conductor_id,'listo_para_enviar');
      perform public.cambiar_estado_expediente_conductor(new.conductor_id,'en_revision');
    end if;
  end if;
  return new;
end;
$$;
