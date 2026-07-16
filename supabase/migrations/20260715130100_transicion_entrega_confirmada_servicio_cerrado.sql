-- RT-34 -- Permite cierre operativo directo despues de entrega confirmada.

insert into public.estado_transiciones_validas (estado_actual, estado_siguiente)
values ('entrega_confirmada', 'servicio_cerrado')
on conflict do nothing;
