-- RT-34 -- Estado del traslado en tiempo real.
-- La app-usuario ya escucha ubicaciones_traslado; tambien debe recibir los
-- cambios de estado sin recargar para sostener la promesa de trazabilidad.

do $$
begin
  alter publication supabase_realtime add table public.traslados;
exception
  when duplicate_object then null;
end $$;

grant select (id, estado, actualizado_en) on public.traslados to authenticated;
