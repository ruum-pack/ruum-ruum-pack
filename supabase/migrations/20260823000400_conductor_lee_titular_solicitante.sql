-- Permite a los conductores asignados a un traslado leer los datos de contacto y nombre del titular solicitante en la tabla usuarios

create policy "conductor_asignado_ve_usuario_solicitante"
  on public.usuarios for select
  to authenticated
  using (
    id in (
      select t.usuario_id from public.traslados t
      where t.conductor_id in (
        select c.id from public.conductores c where c.auth_user_id = auth.uid()
      )
    )
  );
