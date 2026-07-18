# F5 - Validacion de arranque sin red

Estado: riesgo documentado para piloto. No existe offline completo de arranque.

## Alcance tecnico actual

La App Conductor en Capacitor carga la app real desde el servidor configurado en `capacitor.config.ts`. Una vez que la WebView ya cargo la aplicacion y el conductor esta dentro del flujo, existen capacidades parciales sin red:

- La pantalla ya renderizada puede permanecer visible.
- El ultimo viaje activo conocido se conserva si falla el refresco remoto durante la sesion viva.
- La evidencia capturada puede quedar en cola local (`ruum_cola_evidencia`) y sincronizarse al volver la red.
- Camara y ubicacion son plugins nativos y pueden seguir respondiendo si la pantalla que los usa ya esta cargada.

Lo que no existe todavia:

- Shell local operativo para arrancar la aplicacion sin contactar al servidor.
- Cache persistente y suficiente del viaje activo para reconstruir toda la pantalla despues de cerrar la app.
- Pantalla offline local de emergencia/evidencia independiente del servidor remoto.
- Garantia de acceso a detalle del viaje si la app se abre desde cero sin red.

## Escenarios de validacion

| Escenario | Preparacion | Pasos | Resultado esperado | Estado actual esperado |
| --- | --- | --- | --- | --- |
| App ya abierta y luego pierde red | Iniciar sesion, abrir `/panel` o detalle de viaje, dejar la app visible | Desactivar Wi-Fi/datos durante el traslado | La pantalla actual no debe borrarse. La barra de viaje activo debe conservar el ultimo dato conocido y mostrar informacion sin actualizar cuando falle el refresco | Parcialmente cubierto: `useActiveTripSubscription` no borra el viaje en catch y marca `viajeActivoSinActualizar`; las acciones que requieran Supabase fallaran hasta volver la red |
| App en segundo plano y pierde red | Iniciar sesion, abrir viaje activo, mandar la app a segundo plano | Desactivar red, volver a primer plano | La app debe volver a la pantalla anterior si la WebView sigue viva. Debe registrar/mostrar que no pudo actualizar | Parcial: al volver a primer plano se intenta refrescar; si falla, conserva ultimo viaje conocido en memoria, pero no hay garantia si Android destruyo el proceso |
| App cerrada y se intenta abrir sin red | Forzar cierre de la app | Desactivar red y abrir App Conductor | Debe mostrarse una explicacion operativa clara, no una pantalla que sugiera operacion normal | No cubierto tecnicamente: al depender de servidor remoto, la WebView puede no cargar la app. Se requiere protocolo de piloto o shell local para produccion |
| App cerrada con viaje activo y evidencia pendiente | Capturar evidencia, dejar items en cola, cerrar app | Desactivar red y abrir de nuevo | La evidencia pendiente no debe perderse. La app deberia permitir ver el contexto minimo del viaje y continuar operacion segura | Parcial: la cola en Preferences deberia persistir porque el backup no la exporta pero no se borra localmente; no hay pantalla offline local para recuperar el viaje activo sin servidor |

## Decision requerida

### Mitigacion elegida para piloto

La App Conductor debe permanecer abierta durante el traslado. Esta es una restriccion operativa explicita del piloto, no una capacidad tecnica silenciosa.

Instruccion operativa para conductores durante piloto:

1. Abrir el viaje antes de iniciar traslado.
2. No cerrar ni forzar cierre de la App Conductor durante el traslado.
3. Si se pierde red, mantener la app abierta y continuar con evidencia local si la pantalla ya esta cargada.
4. Si la app se cierra sin red, contactar soporte operativo por telefono y seguir protocolo de Torre de Control.
5. Al recuperar red, volver a abrir el viaje y sincronizar evidencia pendiente.

Protocolo de soporte si se cierra sin red:

- Torre de Control confirma identidad del conductor y folio.
- Torre de Control valida el ultimo estado remoto del traslado.
- El conductor conserva evidencia local/fotos si fueron capturadas antes del cierre.
- Si no puede reabrir la app, Torre de Control decide continuidad, espera o recuperacion manual.

### Iniciativa requerida para produccion

Abrir una iniciativa tecnica separada para offline de arranque:

- Shell local operativo en Capacitor.
- Cache persistente del viaje activo con expiracion y version de contrato.
- Pantalla offline local con folio, etapa, contacto operativo minimo, emergencia y evidencia pendiente.
- Acceso a captura de evidencia y emergencia sin servidor remoto.
- Sincronizacion posterior con resolucion de conflictos.
- Auditoria de eventos offline al reconectar.

## Criterio de aceptacion operativo

Antes de piloto, Producto, Operacion y Tecnologia deben aceptar explicitamente:

- El modo offline actual es parcial.
- Si la app ya esta abierta, algunas tareas pueden continuar sin red.
- Si la app se cierra y no hay red, el arranque offline no esta garantizado.
- La mitigacion de piloto es operativa, no tecnica.
- Produccion requiere una iniciativa especifica de offline de arranque.

## Evidencia de aprobacion

| Area | Responsable | Decision | Fecha | Vigencia / condicion |
| --- | --- | --- | --- | --- |
| Producto | Pendiente | Pendiente | Pendiente | Requerido antes de piloto |
| Operacion | Pendiente | Pendiente | Pendiente | Requerido antes de piloto |
| Tecnologia | Pendiente | Pendiente | Pendiente | Requerido antes de piloto |

