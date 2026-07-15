-- RT-29 -- La evidencia inicial debe validar la garantia economica del traslado,
-- no solo el flag historico del perfil del usuario.
--
-- Para pago anticipado, el respaldo real es un pago completado del propio
-- traslado. Para pago al cierre, se conserva la regla de metodo registrado del
-- solicitante o del titular de la empresa.

create or replace function public.traslado_tiene_metodo_pago_registrado(
  p_traslado_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when traslado.tipo_pago = 'anticipado' then exists (
        select 1
        from public.pagos pago
        where pago.traslado_id = traslado.id
          and pago.momento = 'anticipado'
          and pago.estado = 'completado'
      )
      when solicitante.metodo_pago_registrado then true
      when solicitante.empresa_id is not null then exists (
        select 1
        from public.usuarios titular
        where titular.empresa_id = solicitante.empresa_id
          and titular.rol = 'titular_empresa'
          and titular.metodo_pago_registrado = true
      )
      else false
    end
    from public.traslados traslado
    join public.usuarios solicitante on solicitante.id = traslado.usuario_id
    where traslado.id = p_traslado_id
  ), false);
$$;

revoke all on function public.traslado_tiene_metodo_pago_registrado(uuid) from public;
grant execute on function public.traslado_tiene_metodo_pago_registrado(uuid) to authenticated;
