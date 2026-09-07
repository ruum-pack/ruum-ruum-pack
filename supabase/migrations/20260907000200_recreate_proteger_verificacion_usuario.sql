-- Restablece trigger proteger_verificacion_usuario en usuarios
-- Asegura que ningún usuario pueda autoasignarse estado_verificacion o alterar URLs documentales directamente.

drop trigger if exists proteger_verificacion_usuario on public.usuarios;
create trigger proteger_verificacion_usuario
  before update on public.usuarios
  for each row execute function public.proteger_verificacion_usuario();
