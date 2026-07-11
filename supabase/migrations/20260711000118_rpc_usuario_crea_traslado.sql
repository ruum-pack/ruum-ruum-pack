-- Sprint 1 (auditoría 2026-07-11) — mueve la creación de traslado a una RPC
-- transaccional, cerrando dos huecos encontrados en el flujo de
-- app-usuario/traslados/nuevo:
--
--   1. crearVehiculo() + crearTraslado() eran dos inserts sueltos desde el
--      cliente. Si el segundo fallaba, el vehículo del primero quedaba
--      huérfano (sin traslado y sin forma de limpiarlo desde el cliente).
--   2. Nada validaba que un `vehiculo_id` reutilizado perteneciera al
--      usuario autenticado: la política de INSERT en `traslados` solo
--      revisaba `usuario_id`, no el dueño real del vehículo referenciado.
--      Con el UUID de un vehículo ajeno (filtrado o adivinado), un usuario
--      podía crear un traslado sobre un vehículo que no es suyo.
--
-- Se sigue el mismo patrón de 20260708000050_rpc_transacciones_criticas.sql:
-- función security definer + `for update` donde aplica + registro en
-- registro_auditoria, y se cierra el INSERT directo desde el cliente para
-- que la única vía de creación sea esta RPC (igual que se hizo ahí con
-- `conductor_acepta_viaje_disponible`).

-- Bug lateral encontrado de paso: el checkbox de "eléctrico" en
-- TransmisionVehiculo (app-usuario) nunca pudo guardarse — el CHECK original
-- (20260708000027) solo aceptaba 'manual'/'automatica' y cualquier insert
-- con 'electrica' ya tronaba con el error crudo de la constraint.
alter table public.vehiculos
  drop constraint vehiculos_transmision_check,
  add constraint vehiculos_transmision_check
    check (transmision is null or transmision in ('manual', 'automatica', 'electrica'));

-- Cierra el INSERT directo: de aquí en adelante, tanto vehiculos como
-- traslados solo se crean a través de usuario_crea_traslado(). SELECT (y,
-- para vehiculos, la posibilidad de que el propio dueño administre su fila)
-- se mantienen intactos.
drop policy if exists "usuario_crea_sus_traslados" on public.traslados;
drop policy if exists "usuario_administra_sus_vehiculos" on public.vehiculos;

create policy "usuario_ve_y_administra_sus_vehiculos_existentes"
  on public.vehiculos for update
  using (usuario_id in (select id from public.usuarios where auth_user_id = auth.uid()))
  with check (usuario_id in (select id from public.usuarios where auth_user_id = auth.uid()));

create or replace function public.usuario_crea_traslado(
  p_vehiculo_id uuid,
  p_vehiculo jsonb,
  p_traslado jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_vehiculo_id uuid;
  v_traslado_id uuid;
  v_anio int;
  v_anio_maximo int := extract(year from now())::int + 1;
  v_precio numeric;
begin
  select id into v_usuario_id from public.usuarios where auth_user_id = auth.uid();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario autenticado.';
  end if;

  v_precio := (p_traslado->>'precio_cotizado')::numeric;
  if v_precio is null or v_precio <= 0 then
    raise exception 'El precio cotizado debe ser mayor a cero.';
  end if;

  if p_vehiculo_id is not null then
    -- Reutiliza un vehículo guardado: candado de propiedad. Antes de esta
    -- migración esto NO se validaba en ningún lado (ni RLS ni servicio TS).
    select id into v_vehiculo_id
    from public.vehiculos
    where id = p_vehiculo_id
      and usuario_id = v_usuario_id;

    if v_vehiculo_id is null then
      raise exception 'El vehículo indicado no existe o no pertenece al usuario.';
    end if;
  else
    if p_vehiculo is null then
      raise exception 'Debes indicar un vehículo guardado (p_vehiculo_id) o los datos de un vehículo nuevo (p_vehiculo).';
    end if;

    v_anio := (p_vehiculo->>'anio')::int;
    if v_anio is null or v_anio < 1980 or v_anio > v_anio_maximo then
      raise exception 'El año del vehículo debe ser un número entre 1980 y %.', v_anio_maximo;
    end if;

    insert into public.vehiculos (
      usuario_id, tipo, transmision, marca, modelo, anio, color, placas, vin,
      estado_general_declarado, tiene_tarjeta_circulacion, tiene_verificacion,
      tiene_placas, puede_circular_rodando
    ) values (
      v_usuario_id,
      (p_vehiculo->>'tipo')::public.tipo_vehiculo,
      p_vehiculo->>'transmision',
      p_vehiculo->>'marca',
      p_vehiculo->>'modelo',
      v_anio,
      p_vehiculo->>'color',
      p_vehiculo->>'placas',
      p_vehiculo->>'vin',
      p_vehiculo->>'estado_general_declarado',
      coalesce((p_vehiculo->>'tiene_tarjeta_circulacion')::boolean, false),
      coalesce((p_vehiculo->>'tiene_verificacion')::boolean, false),
      coalesce((p_vehiculo->>'tiene_placas')::boolean, false),
      coalesce((p_vehiculo->>'puede_circular_rodando')::boolean, false)
    )
    returning id into v_vehiculo_id;
  end if;

  insert into public.traslados (
    usuario_id, vehiculo_id, estado,
    contacto_entrega_nombre, contacto_entrega_telefono,
    contacto_recepcion_nombre, contacto_recepcion_telefono,
    origen_lat, origen_lng, origen_direccion, origen_ciudad, origen_referencias,
    destino_lat, destino_lng, destino_direccion, destino_ciudad, destino_referencias,
    instrucciones_especiales, modalidad_programacion, fecha_hora_programada,
    tipo_ruta, ventana_recoleccion, ventana_entrega, tipo_servicio, motivo_servicio,
    precio_cotizado, tipo_pago
  ) values (
    v_usuario_id, v_vehiculo_id, 'solicitud_creada',
    p_traslado->>'contacto_entrega_nombre',
    p_traslado->>'contacto_entrega_telefono',
    p_traslado->>'contacto_recepcion_nombre',
    p_traslado->>'contacto_recepcion_telefono',
    coalesce((p_traslado->>'origen_lat')::numeric, 0),
    coalesce((p_traslado->>'origen_lng')::numeric, 0),
    p_traslado->>'origen_direccion',
    p_traslado->>'origen_ciudad',
    p_traslado->>'origen_referencias',
    coalesce((p_traslado->>'destino_lat')::numeric, 0),
    coalesce((p_traslado->>'destino_lng')::numeric, 0),
    p_traslado->>'destino_direccion',
    p_traslado->>'destino_ciudad',
    p_traslado->>'destino_referencias',
    p_traslado->>'instrucciones_especiales',
    p_traslado->>'modalidad_programacion',
    nullif(p_traslado->>'fecha_hora_programada', '')::timestamptz,
    p_traslado->>'tipo_ruta',
    p_traslado->>'ventana_recoleccion',
    p_traslado->>'ventana_entrega',
    p_traslado->>'tipo_servicio',
    p_traslado->>'motivo_servicio',
    v_precio,
    (p_traslado->>'tipo_pago')::public.tipo_pago
  )
  returning id into v_traslado_id;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    v_traslado_id,
    'creacion_solicitud_traslado',
    'usuario',
    v_usuario_id,
    jsonb_build_object(
      'vehiculo_id', v_vehiculo_id,
      'vehiculo_reutilizado', p_vehiculo_id is not null,
      'tipo_pago', p_traslado->>'tipo_pago'
    )
  );

  return v_traslado_id;
end;
$$;

revoke all on function public.usuario_crea_traslado(uuid, jsonb, jsonb) from public;
grant execute on function public.usuario_crea_traslado(uuid, jsonb, jsonb) to authenticated;
