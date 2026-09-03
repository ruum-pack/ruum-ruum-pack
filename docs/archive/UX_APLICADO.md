# Ajustes UX/UI aplicados — Ruum Ruum Conductor

## Enfoque
La pantalla de traslado activo prioriza la acción operativa inmediata y deja la información secundaria bajo demanda.

## Cambios
- Se agregó un bloque de **Estado actual**: `EN CAMINO AL DESTINO`.
- Se agregó una jerarquía explícita de **Tu próxima acción**: `Dirígete al destino`.
- Se mantuvieron destino, dirección y métricas esenciales (distancia, tiempo y llegada) en el bloque principal.
- El mapa queda como apoyo visual inmediato, sin competir con la acción.
- Se convirtió la información secundaria en un panel colapsable **Ver detalles del traslado**.
- Contacto, descripción e incidencias pasan a la sección secundaria.
- Se mantiene la barra de acción inferior con **NAVEGAR** y **HE LLEGADO**.
- Se conserva el folio del traslado como referencia operativa.

## Validación
No se pudo ejecutar `pnpm install`/typecheck en este entorno porque el contenedor no tiene acceso a `registry.npmjs.org`. La modificación se realizó directamente sobre el código existente y se recomienda ejecutar `pnpm typecheck` y `pnpm lint` en el entorno de desarrollo del proyecto antes de desplegar.
