# @ruum/ui

Componentes compartidos para las apps de Ruum. Este paquete define el vocabulario visual y operativo que deben usar frontend, backend visible y operación cuando una pantalla necesita botones, tarjetas, estados, acciones de viaje, avisos, formularios, chat o importes.

La fuente pública del paquete es:

```tsx
import {
  AlertCard,
  Aviso,
  Button,
  Card,
  Chat,
  DesktopStateStepper,
  DriverEarning,
  EstadoBadge,
  EstadoStepper,
  Field,
  FinancialCard,
  MobileProgress,
  NextOperationalAction,
  OperationalCard,
  PassportCard,
  TripCard
} from "@ruum/ui";
import "@ruum/ui/styles/tokens.css";
```

## Principios

- Usa componentes semánticos antes de clases sueltas. Si existe `Button`, `DriverEarning`, `NextOperationalAction`, `Card` o `Aviso`, no recrees el patrón con `div`.
- Cada bloque operativo debe tener un solo CTA primario. Las alternativas van como `secondary` o `quiet`.
- Los importes nunca se inventan en UI. Si no existe monto oficial, usa `DriverEarning` con `amount={null}` y estado `sin_calcular`.
- Los estados visibles deben usar texto humano, no valores internos de base de datos.
- Los controles táctiles deben medir al menos `44 x 44 px`; `Button` ya garantiza `48 x 48 px`.
- No dependas solo del color para acciones críticas. Usa texto, icono, estado y confirmación cuando aplique.
- En móvil, el CTA principal debe ser visible sin scroll cuando sea parte de una acción operativa.
- En offline, informa estado, permite continuar cuando negocio lo permita y evita prometer sincronización completada.

## Tokens

Los componentes usan tokens semánticos definidos en `@ruum/ui/styles/tokens.css`.

Usa estas clases para construir alrededor de los componentes:

```tsx
<section className="border border-border bg-surface text-text-primary">
  <p className="text-text-secondary">Texto secundario</p>
</section>
```

Uso incorrecto:

```tsx
<section className="border-[#d6dae3] bg-[#ffffff] text-white/40" />
```

## Button

Propósito: representar acciones. No debe usarse para navegación textual simple ni para crear varios CTAs principales dentro del mismo bloque.

Variantes:

- `primary`: acción principal unica del bloque.
- `secondary`: accion de apoyo o navegacion.
- `quiet`: accion terciaria, de baja prominencia.
- `danger`: accion destructiva o irreversible.
- `emergency`: accion critica de seguridad; incluye icono por defecto.

Estados:

- `loading`: bloquea el boton, expone `aria-busy` y muestra spinner.
- `disabled`: mantiene tamano y estado visual sin permitir interaccion.
- `icon`: permite `arrow`, `check`, `warning`, `phone`, `send` o `none`.

Uso correcto:

```tsx
<div className="grid gap-2">
  <Button onClick={aceptarViaje}>Aceptar viaje</Button>
  <Button variant="secondary" onClick={verDetalles}>Ver detalles</Button>
</div>
```

```tsx
<Button variant="emergency" onClick={abrirPanelEmergencia}>
  Emergencia
</Button>
```

Uso incorrecto:

```tsx
<div className="grid gap-2">
  <Button>Aceptar</Button>
  <Button>Ver detalles</Button>
</div>
```

```tsx
<button className="h-8 rounded bg-red-600 text-white">911</button>
```

Accesibilidad:

- Usa `type="button"` cuando el boton no envie un formulario.
- El texto visible debe explicar la accion. No uses solo iconos sin `aria-label`.
- Para llamadas o emergencia, el primer toque debe abrir confirmacion o panel; no debe disparar `tel:` directamente.

Ejemplo movil:

```tsx
<div className="sticky bottom-0 border-t border-border bg-surface p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
  <Button className="w-full" loading={guardando}>
    Guardar evidencia
  </Button>
</div>
```

Caso offline:

```tsx
<Button loading={sincronizando} disabled={!hayCambios}>
  {sincronizando ? "Sincronizando" : "Guardar localmente"}
</Button>
```

## Cards

Propósito: agrupar informacion sin mezclar jerarquias visuales.

Componentes:

- `Card`: contenedor neutral.
- `OperationalCard`: accion o instruccion operativa.
- `TripCard`: traslado, oportunidad o viaje.
- `FinancialCard`: importes, pagos o ganancias.
- `AlertCard`: aviso destacado o bloqueo.
- `PassportCard`: solo identidad, expediente, documentacion o pasaporte digital.

Props comunes:

- `padding`: `none`, `sm`, `md`, `lg`.
- `className`: ajuste local.
- `Card` acepta `elevated`.
- `TripCard` acepta `folio`.
- `PassportCard` acepta `folio`, `acento`, `clip`.

Uso correcto:

```tsx
<OperationalCard>
  <h2 className="font-display text-xl font-semibold">Dirigete al origen</h2>
  <p className="text-text-secondary">Abre navegacion y confirma tu llegada.</p>
</OperationalCard>
```

```tsx
<FinancialCard>
  <p className="text-sm font-semibold text-text-tertiary">Ganancia</p>
  <DriverEarning amount={620} status="estimado" currency="MXN" />
</FinancialCard>
```

Uso incorrecto:

```tsx
<PassportCard>
  <h2>Ganancias esta semana</h2>
</PassportCard>
```

```tsx
<Card>
  <Card>
    <p>Tarjeta dentro de tarjeta para crear profundidad visual.</p>
  </Card>
</Card>
```

Accesibilidad:

- Usa encabezados reales dentro de cada tarjeta cuando presente una seccion.
- No uses tarjetas solo para decorar; si es una lista, cada item repetido puede ser `TripCard`.

Ejemplo movil:

```tsx
<TripCard folio="A1B2C3D4" className="grid gap-3">
  <h2 className="font-display text-lg font-semibold">Honda Civic</h2>
  <p className="text-base text-text-secondary">Av. Universidad 1234</p>
  <Button className="w-full">Aceptar</Button>
</TripCard>
```

Caso offline:

```tsx
<AlertCard>
  <Aviso tono="atencion">Sin conexion. Guardamos los cambios en este dispositivo.</Aviso>
</AlertCard>
```

## NextOperationalAction

Propósito: mostrar la siguiente accion humana del viaje activo. Debe ser el primer bloque del detalle o portada cuando hay viaje activo.

Props principales:

- `title`
- `instruction`
- `context`
- `eta`
- `primaryCta`
- `secondaryCta`
- `loading`
- `error`
- `nextStep`
- `stageLabel`

Uso correcto:

```tsx
<NextOperationalAction
  stageLabel="Paso 1 de 7"
  title="Dirigete al punto de recoleccion"
  instruction="Revisa la direccion de recoleccion y abre tu app de navegacion."
  context="Av. Universidad 1234, San Angel, CDMX"
  eta="A 18 minutos"
  primaryCta={{ label: "Abrir navegacion", href: mapsUrl, external: true }}
  secondaryCta={{ label: "Contactar soporte", href: "#contacto", variant: "secondary" }}
  nextStep="Confirma que encontraste al contacto."
/>
```

Uso incorrecto:

```tsx
<NextOperationalAction
  title="Viaje"
  instruction="Hay varias cosas por revisar."
  primaryCta={{ label: "Ver informacion" }}
  secondaryCta={{ label: "Aceptar viaje", variant: "primary" }}
/>
```

Accesibilidad:

- Mantiene un solo CTA primario.
- `error` se presenta dentro de `Aviso tono="danger"`.
- En 320 px, `context`, `eta` y CTA deben romper linea sin ocultarse.

Caso offline:

```tsx
<NextOperationalAction
  title="Registra el estado inicial"
  instruction="Puedes capturar fotos sin conexion. Se sincronizaran al volver la red."
  primaryCta={{ label: "Abrir camara", onClick: abrirCamara }}
  error={offline ? "Sin conexion. La evidencia quedara pendiente de sincronizacion." : undefined}
/>
```

## DriverEarning

Propósito: mostrar importes del conductor con estado economico explicito. Es obligatorio para ganancias, depositos, retenciones y estimaciones.

Estados aceptados:

- `sin_calcular`
- `estimado` o `estimated`
- `pending_confirmation`
- `en_validacion`
- `confirmado`
- `programado`
- `pagado`
- `retenido`
- `rechazado`

Uso correcto:

```tsx
<DriverEarning amount={620} status="estimado" currency="MXN" />
```

```tsx
<DriverEarning amount={null} status="sin_calcular" currency="MXN" />
```

Uso incorrecto:

```tsx
<p>$620 pagado</p>
```

```tsx
<DriverEarning amount={precioFinal * 0.18} status="pagado" />
```

Reglas:

- `amount={null}` muestra "Ganancia por confirmar".
- Un monto estimado nunca debe usar `pagado` ni "ganancia confirmada".
- El monto debe venir de RPC, query o tabla autorizada.
- No calcules porcentajes del precio en frontend.

Accesibilidad:

- El estado se muestra como texto, no solo color.
- El auxiliar explica si es estimado, programado, retenido o rechazado.

Ejemplo movil:

```tsx
<FinancialCard>
  <p className="text-sm font-semibold text-text-tertiary">Ganancia estimada</p>
  <DriverEarning
    amount={620}
    status="estimado"
    currency="MXN"
    amountClassName="text-2xl"
  />
</FinancialCard>
```

Caso offline:

```tsx
<DriverEarning
  amount={null}
  status="sin_calcular"
  auxiliaryText="Sin conexion. Consultaremos el importe oficial al recuperar la red."
/>
```

## Aviso

Propósito: comunicar informacion, atencion o errores accionables.

Tonos:

- `info`
- `atencion`
- `danger`

Uso correcto:

```tsx
<Aviso tono="atencion">
  Documento vencido. Actualizalo antes de aceptar nuevos viajes.
</Aviso>
```

```tsx
<Aviso tono="danger">
  No pudimos guardar los cambios. Intenta nuevamente.
</Aviso>
```

Uso incorrecto:

```tsx
<p className="text-red-500">Error</p>
```

Accesibilidad:

- `danger` usa `role="alert"`.
- `info` y `atencion` usan `role="status"`.
- No lo uses para texto permanente de ayuda; usa texto normal bajo el campo.

Caso offline:

```tsx
<Aviso tono="atencion">
  Sin conexion. Puedes continuar capturando evidencia; quedara pendiente de sincronizacion.
</Aviso>
```

## Field

Propósito: campo de formulario con etiqueta visible, ayuda, error y toggle accesible para contraseña.

Uso correcto:

```tsx
<Field
  etiqueta="Correo electronico"
  name="email"
  type="email"
  autoComplete="email"
  ayuda="Usaremos este correo para avisarte sobre tu solicitud."
  required
/>
```

```tsx
<Field
  etiqueta="Contraseña"
  name="password"
  type="password"
  autoComplete="new-password"
  error={errorPassword}
  required
/>
```

Uso incorrecto:

```tsx
<input placeholder="Correo" />
```

```tsx
<Field etiqueta="CURP" value={curpCompleta} readOnly />
```

Reglas:

- Toda entrada debe tener etiqueta visible.
- En movil, los campos usan texto base para evitar zoom no deseado.
- Datos sensibles en vistas posteriores deben ir enmascarados.
- Antes de editar datos bancarios o documentos sensibles, reautentica en la app que lo consume.

Accesibilidad:

- `ayuda` y `error` se conectan con `aria-describedby`.
- `error` usa `role="alert"`.
- El toggle de contraseña tiene `aria-label` dinamico.

Caso offline:

```tsx
<Field
  etiqueta="Referencia del daño"
  name="damageNote"
  ayuda="Se guardara localmente hasta recuperar conexion."
/>
```

## EstadoBadge

Propósito: mostrar el estado humano de un traslado sin exponer nombres internos de base de datos.

Uso correcto:

```tsx
<EstadoBadge estado="traslado_en_curso" />
```

```tsx
<EstadoBadge estado="servicio_cerrado" conTexto={false} />
```

Uso incorrecto:

```tsx
<span>{estado.replaceAll("_", " ")}</span>
```

Accesibilidad:

- Con `conTexto=true`, el usuario recibe la etiqueta completa.
- Si usas `conTexto={false}`, acompana el badge con texto cercano o `aria-label` en el contenedor.

## EstadoStepper, MobileProgress y DesktopStateStepper

Propósito: mostrar avance del traslado sin comprimir etiquetas en movil.

Uso correcto:

```tsx
<EstadoStepper estado="evidencia_inicial_en_proceso" currentLabel="Registra la evidencia inicial" />
```

Uso incorrecto:

```tsx
<div className="grid grid-cols-7 text-[9px]">
  {etapas.map((etapa) => <span>{etapa}</span>)}
</div>
```

Accesibilidad:

- `MobileProgress` usa `role="progressbar"` y `aria-valuetext`.
- `DesktopStateStepper` expone cada paso con `role="listitem"`.
- En 320 px se muestra progreso compacto y boton "Ver etapas".

Ejemplo movil:

```tsx
<MobileProgress
  estado="evidencia_final_en_proceso"
  currentLabel="Registra el estado final del vehiculo"
/>
```

Caso offline:

```tsx
<div className="grid gap-3">
  <MobileProgress estado="evidencia_inicial_en_proceso" />
  <Aviso tono="atencion">Sin conexion. El avance se guardo en este dispositivo.</Aviso>
</div>
```

## Chat

Propósito: chat presentacional dentro de la app. No expone telefonos reales y no maneja suscripciones ni persistencia; eso vive fuera del componente.

Uso correcto:

```tsx
<Chat
  propio="conductor"
  mensajes={mensajes}
  onEnviar={(contenido) => enviarMensaje(cliente, trasladoId, contenido)}
/>
```

Uso incorrecto:

```tsx
<Chat
  propio="conductor"
  mensajes={mensajes}
  onEnviar={(contenido) => window.location.href = `sms:${telefonoReal}?body=${contenido}`}
/>
```

Accesibilidad:

- El input mantiene tamano tactil y fuente movil segura.
- Cuando esta deshabilitado, el placeholder explica por que no se puede escribir.
- No uses chat como primer paso si existen mensajes rapidos mas eficientes.

Ejemplo movil:

```tsx
<div className="grid gap-2">
  <div className="grid grid-cols-2 gap-2">
    <Button variant="secondary" icon="send">Ya llegue</Button>
    <Button variant="secondary" icon="send">Estoy a 5 minutos</Button>
  </div>
  <Chat propio="conductor" mensajes={mensajes} onEnviar={onEnviar} />
</div>
```

Caso offline:

```tsx
<Chat
  propio="conductor"
  mensajes={mensajesPendientes}
  onEnviar={guardarMensajeLocal}
  deshabilitado={offline}
  mensajeDeshabilitado="Sin conexion. Usa mensajes rapidos cuando vuelva la red."
/>
```

## PassportCard

Propósito: tarjeta exclusiva para identidad, expediente, documentacion y pasaporte digital.

Uso correcto:

```tsx
<PassportCard folio="DOC-123" acento>
  <h2 className="font-display text-xl font-semibold">Licencia</h2>
  <p className="text-text-secondary">En revision</p>
</PassportCard>
```

Uso incorrecto:

```tsx
<PassportCard>
  <h2>Oportunidades cercanas</h2>
</PassportCard>
```

Accesibilidad:

- No pongas overlays interactivos sin revisar foco y orden de teclado.
- Si `folio` es informacion necesaria, repitelo como texto dentro del contenido; el sello visual es decorativo.

Caso offline:

```tsx
<PassportCard acento>
  <Aviso tono="atencion">Documento guardado localmente. Falta sincronizar.</Aviso>
</PassportCard>
```

## BannerDemo

Propósito: indicar ambientes demo o pruebas. No debe aparecer en produccion.

Uso correcto:

```tsx
<BannerDemo hrefLogin="/login" />
```

Uso incorrecto:

```tsx
<BannerDemo hrefLogin="/login" />
// Renderizado sin condicion de ambiente en produccion.
```

Accesibilidad:

- Mantiene texto visible y enlace de acceso.
- No debe tapar navegacion, modales ni CTAs sticky.

## LogoMarca

Propósito: mostrar la marca con tamano y color controlado.

Uso correcto:

```tsx
<LogoMarca tamano={30} color="signal" />
```

Uso incorrecto:

```tsx
<img src="/logo.svg" className="w-[31px]" />
```

Accesibilidad:

- Si el logo es enlace al inicio, el enlace debe tener `aria-label`.
- Si es decorativo, mantenlo fuera del nombre accesible o acompanalo con texto visible.

## Patrones compuestos

### Viaje activo

```tsx
<OperationalCard>
  <NextOperationalAction
    stageLabel="Paso 1 de 7"
    title="Dirigete al punto de recoleccion"
    instruction="Abre navegacion y confirma tu llegada al punto."
    context="Av. Universidad 1234"
    eta="A 18 minutos"
    primaryCta={{ label: "Abrir navegacion", href: mapsUrl, external: true }}
    secondaryCta={{ label: "Contactar soporte", href: "#contacto" }}
    nextStep="Confirma que encontraste al contacto."
  />
</OperationalCard>
```

### Oportunidad de viaje

```tsx
<TripCard folio="A1B2C3D4">
  <h2 className="font-display text-lg font-semibold">Honda Civic</h2>
  <p className="text-base text-text-primary">Origen: San Angel, CDMX</p>
  <p className="text-base text-text-primary">Destino: Roma Norte, CDMX</p>
  <DriverEarning amount={620} status="estimado" currency="MXN" />
  <div className="grid grid-cols-2 gap-2">
    <Button variant="secondary">Ver detalles</Button>
    <Button>Aceptar</Button>
  </div>
</TripCard>
```

### Checklist documental

```tsx
<PassportCard folio="LIC">
  <h2 className="font-display text-xl font-semibold">Licencia</h2>
  <EstadoBadge estado="documentacion_en_revision" />
  <Aviso tono="atencion">Falta revisar el frente del documento.</Aviso>
  <Button variant="secondary">Reemplazar documento</Button>
</PassportCard>
```

### Estado offline de evidencia

```tsx
<AlertCard>
  <Aviso tono="atencion">
    Sin conexion. Captura la evidencia y revisa el estado de sincronizacion antes de cerrar el viaje.
  </Aviso>
  <Button variant="secondary" icon="check">
    Ver pendientes
  </Button>
</AlertCard>
```

## Checklist para nuevas pantallas

- La pantalla tiene un solo objetivo principal.
- Cada bloque tiene maximo un `Button` `primary`.
- Acciones destructivas usan `danger`; emergencia usa `emergency`.
- Los importes usan `DriverEarning`.
- Los estados tecnicos usan `EstadoBadge`, `EstadoStepper` o una capa de presentacion humana.
- Los mensajes usan `Aviso`; errores criticos usan `tono="danger"`.
- En movil no hay controles bajo `44 x 44 px`.
- Las acciones sticky respetan `env(safe-area-inset-bottom)`.
- El modo offline muestra estado real y no promete confirmacion remota.
- Los datos sensibles se enmascaran fuera del formulario de captura.
