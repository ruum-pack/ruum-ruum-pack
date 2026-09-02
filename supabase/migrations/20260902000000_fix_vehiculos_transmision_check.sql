-- Corrección de restricción vehiculos_transmision_check para soportar 'electrica'
alter table public.vehiculos 
  drop constraint if exists vehiculos_transmision_check;

alter table public.vehiculos 
  add constraint vehiculos_transmision_check 
  check (transmision is null or transmision in ('manual', 'automatica', 'electrica'));
