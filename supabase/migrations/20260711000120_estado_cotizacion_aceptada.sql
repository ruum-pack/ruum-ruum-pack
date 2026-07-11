-- ALTER TYPE ... ADD VALUE debe confirmarse antes de utilizar el valor en
-- inserts, comparaciones o funciones. Por eso vive en una migración propia.
-- También cubre ambientes donde la migración 119 ya había sido aplicada
-- antes de que el flujo de cotización incorporara este estado.
alter type public.estado_traslado
  add value if not exists 'cotizacion_aceptada' after 'cotizacion_generada';
