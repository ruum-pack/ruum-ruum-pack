-- Migration to allow conductors to manage expenses for their assigned traslados.

create policy "conductor_administra_gastos_de_sus_traslados"
  on public.gastos_traslado for all
  using (
    traslado_id in (
      select t.id
      from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  )
  with check (
    traslado_id in (
      select t.id
      from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );
