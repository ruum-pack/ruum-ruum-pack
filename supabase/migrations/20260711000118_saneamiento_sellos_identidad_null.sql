-- Corrige el saneamiento defensivo de 20260711000116: aquel DELETE filtraba
-- `tamano_bytes = 0`, pero como `tamano_bytes` se agregó sin default en esa
-- misma migración, cualquier fila insertada entre el despliegue de 115 y el
-- de 116 pudo quedar con `tamano_bytes IS NULL` — y `NULL = 0` nunca es
-- verdadero en SQL, así que esas filas no se habrían borrado antes del
-- `ALTER COLUMN tamano_bytes SET NOT NULL` que sigue en la misma migración
-- (lo que habría hecho fallar esa sentencia si hubieran existido).
--
-- En este entorno 116 ya corrió con éxito (no había filas NULL en ese
-- momento), así que este DELETE es un no-op defensivo aquí: la columna ya
-- es NOT NULL y ya tiene el check `between 1 and 10485760`, por lo que no
-- puede haber filas que coincidan hoy. Se deja como migración nueva —en vez
-- de editar 116, que ya está aplicada— para que cualquier entorno que
-- reproduzca el historial desde cero (CI, ambiente nuevo, disaster
-- recovery) quede protegido igual, sin reescribir una migración congelada.
delete from public.documentos_identidad_storage_validados
where tamano_bytes is null
  or tamano_bytes <= 0;
