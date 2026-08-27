# @ruum/panel-admin

PRD §14 — instrucción operativa: **"El Panel Admin debe enfocarse en
supervisión, intervención humana y auditoría."**

PRD §17.18 — idea central: la Torre de Control debe responder con rapidez
**¿qué viajes están activos? ¿qué viajes necesitan conductor? ¿qué conductor
está disponible?**

## Pantallas construidas (Fase 2, cierre del mapa de pantallas)

Layout de consola (PRD §17.1: "plataforma web responsive... pantalla amplia"), con barra lateral fija que
refleja la navegación completa del PRD §17.2 — las secciones sin pantalla todavía se muestran marcadas
"Próximamente" en vez de ocultarse, para no confundir "no construido aún" con "no existe en el plan".

- `/` — Dashboard: métricas operativas y alertas reales (PRD §17.3).
- `/viajes` — Lista de viajes con pestañas de estatus (PRD §17.4).
- `/viajes/[id]` — Detalle administrativo con 6 de los 7 bloques del PRD §17.4 (resumen, vehículo, evidencia,
  pagos, acciones, notas internas) y acciones reales: asignar/cambiar conductor, cambiar estatus (validado contra
  `TRANSICIONES`, igual que el resto del sistema), agregar nota interna.
- `/login` — inicio de sesión real con Supabase Auth. A propósito **no hay pantalla de registro público**: un
  admin nunca debe poder autoregistrarse desde un formulario expuesto (PRD §3 — Admin es "equipo operativo
  interno"). Ver "Cómo crear un admin" abajo.
- `/conductores` — Lista de conductores CONCER, con suspender/reactivar (PRD §17.6).
- `/usuarios` — Lista de usuarios con estatus de verificación (PRD §17.5).
- `/incidencias` — Lista de incidencias, enlazadas a su viaje (PRD §17.8).

Validado con un `next build` real: las 7 rutas compilan y generan páginas correctamente, incluyendo el
middleware de sesión. A diferencia de app-usuario y app-conductor, **todas** las pantallas de datos de este app
cargan vía `useEffect` en el cliente (ninguna es un componente de servidor), así que no se pudo confirmar
contenido post-hidratación con un navegador real en este entorno de desarrollo — mismo límite documentado en
`apps/app-conductor/README.md`. Su lógica sigue exactamente el mismo patrón ya usado en las otras dos apps
(`useState` + `useEffect` + `@ruum/api/services`), revisado a mano, pero queda como verificación pendiente en un
entorno real (`pnpm --filter @ruum/panel-admin dev` + navegador).

## Cómo crear un admin

No hay flujo de auto-registro. Para dar acceso a alguien:

1. Crear el usuario en Supabase Auth (panel de Supabase → Authentication → Add user, o que la persona use
   "¿Olvidé mi contraseña?" sobre un correo que tú agregaste).
2. Insertar su fila en `admins` apuntando a ese `auth_user_id`:

```sql
insert into public.admins (auth_user_id, nombre)
values ('<uuid del usuario de Supabase Auth>', 'Nombre de la persona');
```

Sin esa fila, la persona puede iniciar sesión pero no va a poder ver nada del panel (toda política de Admin
depende de `es_admin()`, que consulta esta tabla).

## Gap real encontrado al construir esto

PRD §17.4, bloque 7 ("Notas internas") no tenía ninguna tabla en el esquema. Se agregó
`notas_internas_traslado` en `0020_notas_internas_traslado.sql` — solo accesible para Admin
(`es_admin()`), probado con una inserción real bajo un rol no-superusuario.

## Modo demo vs. datos reales

Igual criterio que las otras dos apps: sin `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, todo el
panel es navegable con datos de ejemplo, siempre marcados como tales.

## Componentes administrativos

Los controles nuevos del panel deben usar `src/app/admin-components.tsx`: `AdminButton`, `AdminIconButton`,
`AdminInput`, `AdminSelect`, `AdminTextarea`, `AdminDialog`, `AdminDrawer`, `AdminTabs`, `AdminBadge`,
`AdminTooltip`, `AdminEmptyState`, `AdminErrorState`, `AdminLoadingState` y `AdminLastUpdated`.

La guía mínima de variantes, estados y requisitos ARIA está en `ADMIN_COMPONENTS.md`.

## Pendiente (siguientes cortes)

- Roles internos (PRD §17.15: Super admin, Operador de Torre, Supervisor, Validador documental, Finanzas,
  Coordinador CONCER, Comercial) — hoy todo admin tiene acceso total vía `es_admin()`, sin diferenciación de rol
  interno.
- Bloque 6 del detalle de viaje ("Línea de tiempo"): falta un visor dedicado sobre `registro_auditoria` (0014).
- Métricas de dashboard que el PRD pide pero el esquema actual no puede calcular sin inventar datos:
  "programados para hoy" (no existe una fecha de traslado programada distinta de `creado_en`) y "conductores
  disponibles" (la disponibilidad en tiempo real no tiene columna propia — mismo gap que el botón del Panel en
  app-conductor).
- Evidencia (comparador inicial/final), Pagos, Documentos, Tarifas, Empresas, Reportes, Auditoría, Configuración
  — PRD §17.7, §17.9–§17.14, marcadas "Próximamente" en la barra lateral.
- Mapa operativo y versión responsive móvil del Admin (PRD §17.16).

```
pnpm --filter @ruum/panel-admin dev
```
