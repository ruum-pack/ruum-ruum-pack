-- RT-33 -- Notas libres del conductor durante la captura de evidencia.

alter table public.evidencia_inspecciones
  add column if not exists notas text;
