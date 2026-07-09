-- Amplia la solicitud de traslado para capturar el detalle operativo del wizard.
alter table public.vehiculos
  add column transmision text,
  add column color text,
  add column placas text,
  add column vin text,
  add column estado_general_declarado text,
  add constraint vehiculos_transmision_check
    check (transmision is null or transmision in ('manual', 'automatica'));

alter table public.traslados
  add column origen_referencias text,
  add column destino_referencias text,
  add column instrucciones_especiales text,
  add column modalidad_programacion text,
  add column fecha_hora_programada timestamptz,
  add column tipo_ruta text,
  add column ventana_recoleccion text,
  add column ventana_entrega text,
  add column tipo_servicio text,
  add column motivo_servicio text,
  add constraint traslados_modalidad_programacion_check
    check (modalidad_programacion is null or modalidad_programacion in ('lo_antes_posible', 'programado')),
  add constraint traslados_tipo_ruta_check
    check (tipo_ruta is null or tipo_ruta in ('local', 'foraneo')),
  add constraint traslados_tipo_servicio_check
    check (tipo_servicio is null or tipo_servicio in ('personal', 'empresarial', 'agencia', 'lote', 'flotilla')),
  add constraint traslados_motivo_servicio_check
    check (motivo_servicio is null or motivo_servicio in ('entrega_cliente', 'recuperacion', 'traslado_especial'));
