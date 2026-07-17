-- El bucket `evidencia` es privado. `evidencia_fotos.url` debe guardar el path
-- del objeto dentro del bucket, no una URL publica historica de Storage.
update public.evidencia_fotos
set url = regexp_replace(url, '^https?://[^/]+/storage/v1/object/public/evidencia/', '')
where url ~ '^https?://[^/]+/storage/v1/object/public/evidencia/';
