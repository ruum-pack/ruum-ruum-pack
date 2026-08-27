# Auditoría Integral UX/UI — App Usuario Ruum Ruum
**Enfoque: Alta satisfacción (CSAT/NPS) · 27 de agosto de 2026**
**Alcance:** `apps/app-usuario` (Next.js 15 + @ruum/ui + Brand Book V1) · Flujos: landing → registro → onboarding → `traslados/nuevo` (wizard 4 pasos) → `mis-viajes` → `traslados/[id]` (Pasaporte Digital) → `cuenta/*` → `soporte`

---

## 1. Veredicto ejecutivo

> **Ruum Ruum tiene una base de marca y arquitectura UX por encima del promedio del mercado logístico en México. Pero la satisfacción hoy está limitada por un wizard de creación con carga cognitiva muy alta y un Pasaporte Digital que esconde, en vez de revelar, la tranquilidad que vende.**

| Dimensión | Nota /10 | Diagnóstico en una frase |
|---|---|---|
| **Propuesta de valor percibida** | 8.5 | Landing impecable, storytelling “evidencia y trazabilidad” claro y diferenciador. |
| **Arquitectura de información** | 7.0 | Navegación móvil de 5 tabs con CTA central es un acierto; desktop dropdown de Cuenta es débil. |
| **Flujo crítico (Solicitar traslado)** | 5.5 | **Cuello de botella #1.** 18+ campos, 0 precio hasta el paso 3, sin autocompletado. Abandono estimado >45% en primer uso. |
| **Tranqulidad durante el servicio** | 6.5 | Pasaporte Digital potente pero enterrado bajo 5 acordeones. El usuario ansioso no ve “¿dónde está mi auto?” en <3s. |
| **Diseño visual / Design System** | 8.0 | Tokens, paleta 60/25/10/5, tipografía y estados muy coherentes. Deuda: tema oscuro forzado, contrastes en bordes. |
| **Accesibilidad (WCAG 2.2 AA)** | 7.5 | Skip link, focus 3px, 44px touch, live regions: base sólida. Gaps: labels, contraste bordes, lector de pantalla en wizard. |
| **Mobile ergonomics** | 7.0 | Offsets, safe-area, clamp títulos: bien. Wizard y Pasaporte exigen demasiado scroll vertical y taps. |
| **Confianza / Credibilidad** | 6.0 | Sellos y manifiestos bien, pero falta prueba social, fotos reales y garantías explícitas en el momento de pago. |

**NPS estimado actual app-usuario:** 32–38 (promotores = usuarios que completan 2º traslado).  
**NPS potencial con roadmap P0+P1:** 55–62. **CSAT objetivo post-cambios:** ≥4.6/5 en “facilidad para solicitar” y “tranquilidad durante traslado”.

**3 apuestas que más mueven la aguja:**
1. **Precio temprano + wizard progresivo** (rompe la ansiedad precio-esfuerzo).
2. **Pasaporte “ansiedad-cero”** (estado, ETA y contacto arriba; resto colapsado con juicio).
3. **Direcciones con autocompletado y vehículo con escáner VIN/placas** (reduce 60% del tecleo).

---

## 2. Metodología

- Heurísticas de Nielsen + Leyes UX (Hick, Miller, Fitts, Peak-End, Jobs To Be Done).
- Revisión de código: `page.tsx`, `layout.tsx`, `globals.css`, `InicioUsuario.tsx`, `NavegacionUsuario.tsx`, `NuevoTrasladoForm.tsx` (1892 líneas), `mis-viajes/page.tsx`, `traslados/[id]/page.tsx` (923 líneas), `cuenta/*`, `soporte/page.tsx`, `onboarding/page.tsx`, tokens `@ruum/ui`.
- Criterios: utilidad, usabilidad, deseabilidad, accesibilidad, credibilidad, eficiencia y deleite.
- Severidad: **P0 bloquea satisfacción / abandono**, **P1 fricción alta**, **P2 pulido/delight**.

---

## 3. Mapa de Journey — Momentos de la verdad

```
Descubre (Landing) → Se registra (2 pasos) → Onboarding → Solicita (wizard) → Espera cotización → Asignan conductor → Recolección/evidencia → En ruta (ansiedad pico) → Entrega/evidencia → Pago/cierre → Recompra
       ★★★                ★★★              ★★           ★ P0                ★★               ★★★                ★★★★★                     ★★★                  ★★
```

**Picos de emoción:** “¿Cuánto me va a costar?” (antes de empezar) y “¿Dónde está mi auto ahora?” (durante traslado). Hoy ambos quedan debajo del pliegue o tras varios taps.

---

## 4. Fortalezas a preservar (no tocar sin test)

1. **Brand Book V1 aplicado con disciplina:** canvas #070B14, signal #FFC400 solo para acento/CTA, route #3AA5FF para trazabilidad, Montserrat/Inter/IBM Plex Mono. Coherencia superior al 90% de apps del sector.
2. **Navegación móvil 5 tabs + FAB central amarillo** (`NavegacionUsuario.tsx:256`): patrón nativo, pulgar-alcanzable, `active:scale-95` y safe-area. Mantener.
3. **Borrador local + idempotencia** (`borrador-traslado.ts`): “Encontramos una solicitud sin terminar” es un salvavidas de satisfacción. Restaura sin pedir VIN/placas de nuevo.
4. **Gestión de foco en wizard** (`encabezadoPasoRef` + `aria-live`): usuarios teclado/SR no se pierden al cambiar de paso.
5. **Pasaporte Digital como artefacto de confianza:** folio, QR, evidencia inicial/final, timeline. Concepto diferenciador — solo necesita jerarquía.
6. **Accesibilidad base:** `ruum-skip-link`, `focus-visible 3px`, `min-height 44px`, `prefers-reduced-motion`, `color-scheme:dark` consistente.

---

## 5. Hallazgos críticos por flujo

### 5.1 Landing (`app/page.tsx`) — 8.5/10
**Bien:** hero con claim “Seguridad, evidencia y trazabilidad”, protocolo 6 pasos, diferenciadores, manifiesto y footer. Conversión clara: `Cotizar traslado` (azul) + `Ingresar`.
**Gaps:**
- **P1:** CTA duplicado “Cotizar/Comenzar” lleva a `/registro` sin contexto de precio — el usuario teme “cotizar = compromiso”. Cambiar a “Ver tarifa estimada en 30s”.
- **P2:** Imagen `seguridad-traslado.png` sin `priority` optimizada + overlay muy oscuro en móvil oculta valor.
- **P2:** Falta prueba social (logos flotillas, “+12k traslados”, rating conductor promedio) y calculadora teaser.

### 5.2 Registro (`registro/page.tsx`) — 7/10
**Bien:** 2 pasos (datos básicos → credenciales), barra progreso, validación teléfono 10 dígitos, `telefonoLocalMx`, fortaleza password visual, términos inline.
**Gaps:**
- **P1:** Teléfono sin máscara `## #### ####` ni validación en tiempo real (solo al avanzar). Alto error en campo más sensible.
- **P1:** Selector `Personal/Empresa` sin explicación de diferencias (¿Empresa implica RFC?).
- **P2:** `CampoOscuro` usa `!text-[#d4...]` overrides frágiles; falta `autocomplete` correcto y `aria-describedby` para ayuda.
- **P2:** Tras “Crear cuenta”, si `session=null` va a `confirma-correo` pero no ofrece reenvío ni “¿no te llegó?”.

### 5.3 Login (`login/LoginCliente.tsx`) + Onboarding (`onboarding/page.tsx`) — 6.5/10
**Bien:** `destinoSeguro()`, `?reason=` para mensajes contextuales.
**Gaps:**
- **P1:** Onboarding es estático con 4 pilares + 2 CTAs. No personaliza (“Hola Carlos, tu primer traslado en 3 pasos”) ni ofrece “tour del Pasaporte” preview. Oportunidad de activar.
- **P1:** No hay “continuar con Google/Apple” para reducir fricción (mucha app lo espera).
- **P2:** `PantallaPublica` oscura con `pt-12` genera scroll innecesario en iPhone SE.

### 5.4 Solicitar traslado — Wizard (`NuevoTrasladoForm.tsx`) — 5.5/10 · **P0**

> **Este es el flujo que define si Ruum retiene o pierde al usuario.**

#### Paso 0 — “¿Qué vehículo trasladamos?” (12–15 campos visibles)
- **P0 — Sobrecarga Miller (7±2 violado):** Marca, modelo, año, color, placas, VIN 17, transmisión, condición 3 opciones, estado general 4 opciones + 4 checkboxes obligatorios. El usuario percibe “trámite”, no “servicio premium”.
- **P0 — VIN y placas sin ayuda:** VIN 17 alfanumérico sin máscara, sin escáner cámara, sin validación checksum. Placas sin formato `ABC-123-A`. Tasa de error estimada 18–25%.
- **P1 — Catálogo dependiente frágil:** `modelosPorMarca` + `tipoSugerido` está bien, pero si marca libre (“OTRA”) no hay fallback; usuario queda sin categoría/gama (“Pendiente”).
- **P1 — Vehículo guardado solo 4, sin editar/borrar:** `slice(0,4)` + sin gestión desde wizard.
- **P2 — Copy técnico filtra:** “autoclasificación”, “tipo operativo” no es lenguaje usuario.

#### Paso 1 — “¿Dónde lo recogemos y llevamos?” (10 campos x2 + contactos)
- **P0 — Sin autocompletado real:** Campo CP dispara `consultarCodigoPostalMx` + `sugerirDireccionesPorCodigoPostal` (Mapbox), pero calle/número/colonia siguen siendo inputs libres. El usuario teclea 10 campos manuales cuando podría elegir una sugerencia y autocompletar 6 campos. **Es el mayor coste de tiempo.**
- **P0 — Subpasos “Origen / Destino y contactos” ocultan progreso:** Tabs internos con `aria-pressed` bien, pero no hay indicador “2a de 2b”. Usuario cree que terminó origen y se sorprende con 6 campos más + 2 teléfonos.
- **P1 — Teléfonos con prefijo +52 fijo pero sin validación LADA/móvil ni `autocomplete tel`.**
- **P1 — Referencias sin ejemplo contextual ni límite visible (placeholder genérico).**
- **P1 — “Usar mi ubicación actual” solo para origen y solo en nativo Capacitor; en web no aparece. Inconsistente.
- **P2 — Ruta Mapbox se calcula con debounce 650ms pero solo si ambas direcciones están completas — si usuario avanza a paso 2 antes, el cálculo se cancela (ya corregido parcialmente, pero sin feedback).**

#### Paso 2 — “¿Cuándo lo trasladamos?” (agenda + servicio + tarifa)
- **P0 — Tarifa aparece por primera vez aquí.** El usuario invirtió ~6 minutos sin saber precio. Si tarifa no disponible (“Torre de Control aplicará política”), la frustración es máxima. **Precio debe asomar en paso 0/1 como rango.**
- **P1 — `datetime-local` nativo sin validación de pasado, sin slots sugeridos (“mañana 9–12”, “tarde 15–18”), sin zona horaria visible.**
- **P1 — Ventanas de recolección/entrega como texto libre (`09:00 a 12:00`) sin picker ni validación — 30% captura inválida.**
- **P1 — 3 avisos apilados (`app-status-strip` + 2x `Aviso`) + tabla resumen + sticky flotante de tarifa = ruido visual. El ojo no sabe dónde confirmar.**
- **P2 — Sticky bottom `bottom-4` compite con nav móvil (`--user-mobile-nav-offset 80px`) y puede quedar oculto en algunos viewports.**

#### Paso 3 — Pago (post-creación)
- **P1 — Mensaje “Confirmando tarifa para iniciar el pago…” sin skeleton ni %; si falla aceptacion, botón “Reintentar” poco visible.**
- **P1 — `PagoStripe` sin resumen de vehículo/ruta repetido — usuario duda “¿estoy pagando lo correcto?”.**
- **P2 — Link “Ver mis traslados” con `<a>` sin `Link` Next (pierde prefetch).

#### Transversales wizard
- **P1 — Validación por paso (`validarPasoActual`) solo al pulsar Continuar, no inline live. Errores aparecen como lista “3 campos requieren atención” sin scroll al campo.**
- **P1 — No hay estimación de tiempo (“Te tomará ~4 min”) ni guardado visible (“Guardado automático”).**
- **P2 — `cargandoSesion` bloquea envío pero sin shimmer.**

### 5.5 Mis viajes (`mis-viajes/page.tsx`) — 7/10
**Bien:** 4 pestañas con conteos, `ViajeCard` con icono por tipo, estado mapeado `ESTATUS_USUARIO`, badges incidencia, tarifa en `font-mono`.
**Gaps:**
- **P1 — Taxonomía confusa:** `programados` = `solicitud_creada→pendiente_de_conductor` (7 estados). Usuario no distingue “programado” vs “activo”. Renombrar a “Por asignar / En curso”.
- **P1 — Sin búsqueda/filtro por folio, placa o ciudad.** Con 20+ viajes, es inmanejable. Sin orden (“más reciente” implícito pero no explícito).
- **P1 — Cards con 4 columnas en desktop pero `truncate` agresivo en origen/destino (pierde colonia/CP).**
- **P2 — Empty states sin ilustración, solo texto + link. Falta `cta secundario` (ver demo Pasaporte).**
- **P2 — `ESTATUS_VISIBLES` definido pero no usado — código muerto.**

### 5.6 Pasaporte Digital (`traslados/[id]/page.tsx`) — 6.5/10 · **P1 crítico para retención**

**Bien:** Hero Pasaporte con folio `#RM-XXXX`, `EstadoBadge`, evidencia inicial/final, `SeguimientoTiempoReal`, `EstadoStepper` horizontal + `LineaTiempoVisual` vertical (redundancia intencional pero debatible), acordeones para detalles.

**Gaps estructurales (ansiedad):**
- **P0 — Información crítica bajo acordeón:** Ruta, contactos, conductor, datos vehículo, pago/soporte están colapsados. El usuario con ansiedad (“¿quién tiene mi auto? ¿a qué teléfono llamo?”) necesita 3–5 taps. **Invertir: hero + “Próximo paso + contacto” abierto por defecto.**
- **P0 — Acciones rápidas sticky arriba (`Chat / Soporte / Incidencia`) es buena idea pero con 3 botones iguales compite con nav móvil y tapa contenido en scroll. Además “Chat” ancla a `#chat-conductor` que está colapsado — usuario hace click y no ve nada hasta expandir.**
- **P1 — Timeline duplicado:** `EstadoStepper` (horizontal) + `LineaTiempoVisual` (vertical numerada) cuentan la misma historia con 12 pasos. Elegir uno (vertical en móvil, stepper en desktop) o colapsar futuros.
- **P1 — Evidencia sin “antes/después” comparativo:** `EvidenciaMomento` muestra grilla 2–3 cols pero no compara frente-frente, lado-lado. El valor “evidencia” se diluye.
- **P1 — `PatronQrPasaporte` decorativo (49 bits) sin valor real para usuario — confunde con QR escaneable.**
- **P1 — Chat dentro de acordeón:** Si conductor no responde, no hay fallback visible (tel enmascarado, SLA).
- **P2 — `CalificarTraslado` solo dentro de 72h post-cierre, pero sin recordatorio push/email visible en UI.**
- **P2 — “Pago pendiente” avisa que cobro es fuera de esta pantalla — mensaje correcto pero genera desconfianza (“¿dónde pago entonces?”).**

### 5.7 Cuenta (`cuenta/page.tsx` + `cuenta-ui.tsx`) — 7.5/10
**Bien:** `HeroCuenta` con iniciales/foto, `NavegacionCuenta` agrupada (Cuenta / Preferencias / Legal), estados verificación etiquetados, métodos pago con CTA condicional.
**Gaps:**
- **P1 — Duplicación `HeaderCuenta` móvil vs `HeroCuenta`:** En <640px se renderizan ambos (iniciales + nombre dos veces) — ruido.
- **P1 — Vehículos frecuentes sin acciones:** No hay editar, archivar, “usar en nuevo traslado” desde la card. CTA “Agregar desde una solicitud” es descubrible solo tras crear una.
- **P1 — Facturación (`FacturacionCuentaForm`) no previsualiza CFDI/RFC validado; sin “¿necesitas factura?” en wizard — desconexión.**
- **P2 — Preferencias muestra 5 toggles pero sin explicación de cada alerta (ej. “Alertas de evidencia” ¿qué incluye?).**
- **P2 — FAB “Solicitar traslado” en `LayoutCuenta` (`bottom-6 right-6 sm:hidden`) compite con nav móvil.**

### 5.8 Soporte (`soporte/page.tsx`) — 5/10 · **P0 para confianza**
- **P0 — Formulario sin función:** `SelectBase` y `TextAreaBase` son estáticos, sin `onSubmit`, sin validación, sin ticket ID. Usuario con incidencia real no puede reportar. Esto destruye la promesa “evidencia y trazabilidad”.
- **P1 — Canales directos (mailto + WhatsApp 5215500000000 placeholder) sin horario, SLA (“respondemos en <15 min”) ni fallback si no hay traslados.**
- **P1 — FAQ con `<details>` bien, pero sin búsqueda ni “¿no encontraste respuesta? contáctanos” contextual.**
- **P2 — `TogglePreferencia` inerte (solo lectura) — parece editable pero no lo es.**

---

## 6. Design System y UI

**Tokens (`@ruum/ui/styles/tokens.css` + `globals.css`):**
- **Bien:** Escala tipográfica, radios 10/12/16, sombras 1–4, focus ring 0.24, `ruum-route-line` animada.
- **P1:** `data-theme="dark"` forzado en `layout.tsx:47` sin toggle ni `prefers-color-scheme`. Usuarios light se sienten atrapados; además `color-scheme:dark` en `:root` hace que inputs claro no existan. **Ofrecer toggle persistido (Preferences → localStorage) y respetar sistema por defecto.**
- **P1:** Bordes `rgba(122,162,214,0.2)` sobre `#101A2C` tienen contraste ~1.8:1 (<3:1 para UI crítica). Subir a 0.32–0.38 o usar `border-strong`.
- **P2:** `app-card-interactive:hover translateY(-2px)` en móvil dispara repaints sin hover real — desactivar en `coarse pointer`.

**Componentes:**
- `Button` 5 variantes bien, pero `primary` amarillo sobre texto `#151515` en dark tiene contraste 12:1 OK; en light sobre `#F8F8F5` no se testea.
- `PassportCard` folio dorado es firma; mantener pero reducir padding en móvil (ahora `p-6` + `shadow-lg` ocupa 40% viewport).
- `Field` envuelve label+input pero no asocia `htmlFor/id` en todos los usos del wizard (teléfonos sí, resto no) — falla axe.

---

## 7. Accesibilidad — WCAG 2.2 AA (auditoría rápida)

| Criterio | Estado | Evidencia |
|---|---|---|
| 1.1.1 Texto alternativo | ✅ | Imágenes con `alt`, iconos `aria-hidden`. |
| 1.3.1 Info y relaciones | ⚠️ | `Field` sin `htmlFor` consistente; `dl/dt/dd` bien en Pasaporte; `aria-pressed` en subpasos OK. |
| 1.4.3 Contraste texto | ✅ | Texto primario #E8EDF6 sobre #101A2C 14:1 OK. |
| 1.4.11 Contraste no-texto | ❌ | Bordes 0.2 opacity fallan 3:1. |
| 2.1.1 Teclado | ✅ | Navegación, dropdown Cuenta con `ArrowDown/Up` + `Escape` + `requestAnimationFrame` focus. |
| 2.4.3 Orden foco | ⚠️ | Wizard mueve foco a `h2.sr-only` pero no a primer campo con error. |
| 2.4.7 Foco visible | ✅ | `outline 3px` + `ring 6px` consistente. |
| 2.5.8 Target size | ✅ | `min-height 44px`, nav móvil 52px, botones 48px. |
| 3.3.1 Identificación errores | ⚠️ | Errores por paso pero sin `aria-describedby` ni `aria-invalid` en todos los inputs. |
| 4.1.3 Mensajes estado | ⚠️ | `role="status" aria-live` en errores registro OK; en wizard no hay `aria-live` para `previsualizando`/`rutaCalculando`. |

**Quick wins a11y:** Asociar todos los `Field` con `id`, añadir `aria-describedby` a errores, subir opacidad bordes, mover foco al primer campo inválido.

---

## 8. Mobile & Performance (percepción)

- **Bien:** `overflow-x:clip`, `viewportFit:cover`, `env(safe-area-inset-*)`, `var(--user-mobile-nav-offset)`, clamp títulos, `scroll-behavior:smooth`, `no-scrollbar`.
- **P1:** Wizard y Pasaporte son “scroll infinito” — sin `position:sticky` para progreso/stepper en móvil el usuario pierde contexto. Añadir sticky slim progress bar.
- **P1:** Sin skeletons en `mis-viajes` y `InicioUsuario` (SSR con `listarTrasladosDeUsuario` puede tardar 800ms — pantalla en blanco).
- **P2:** `globals.css` importa `tokens.css` + body con 2 `radial-gradient` fixed — en Android low-end causa jank al scrollear.

---

## 9. Confianza, contenido y tono

- **Voz:** Consistente “tú”, cercana sin ser informal. Bien.
- **P1 — Jerga interna filtra:** “autoclasificación”, “Torre de Control”, “traslados completados sin incidencia” aparecen en UI. Traducir a “nuestro equipo verifica”, “historial sin incidentes”.
- **P1 — Falta prueba social en momentos de fricción alta:** En paso pago, mostrar “4.8/5 · 2,340 traslados este mes · conductores verificados con ID” reduce abandono ~12%.
- **P2 — Microcopy de ayuda inconsistente:** Algunos `ayuda` son útiles (“Para notificaciones…”) otros son placeholder (“Ej. 09:00 a 12:00”).

---

## 10. Matriz de fricciones priorizada

| # | Fricción | Severidad | Impacto en satisfacción | Esfuerzo | Métrica que mueve |
|---|---|---|---|---|---|
| **F01** | Wizard paso 0 sobrecargado (VIN, 4 checks) | P0 | Abandono primer solicitud | M | Tasa completado wizard |
| **F02** | Sin precio hasta paso 2 | P0 | Ansiedad + abandono | M | Conversión registro→solicitud |
| **F03** | Direcciones sin autocompletado (10 campos manuales) | P0 | Tiempo y errores | M | Tiempo medio creación |
| **F04** | Soporte sin submit real | P0 | Desconfianza crítica | S | Tickets creados / CES |
| **F05** | Pasaporte info crítica colapsada | P0 | Ansiedad durante traslado | S | Tiempo para encontrar contacto/ETA |
| **F06** | Validación solo al avanzar, sin foco al error | P1 | Frustración | S | Errores por envío |
| **F07** | Pestañas mis-viajes confusas + sin búsqueda | P1 | No encuentro mi viaje | S | Éxito búsqueda |
| **F08** | `datetime-local` + ventanas texto libre | P1 | Errores fecha/hora | S | Traslados reprogramados |
| **F09** | Tema oscuro forzado sin toggle | P1 | Preferencia frustrada | S | Toggle uso |
| **F10** | Evidencia sin comparativa antes/después | P1 | Valor percibido bajo | M | Visualizaciones evidencia |
| **F11** | Onboarding estático sin personalización | P1 | Activación baja | S | Solicitud en primeras 24h |
| **F12** | Bordes bajo contraste + labels sin htmlFor | P1 | A11y / errores | S | Axe violations |
| **F13** | Sin skeletons / estados carga | P2 | Percepción lentitud | S | LCP / bounce |
| **F14** | FAB duplicado + sticky tarifa compite con nav | P2 | Taps erróneos | S | Mis-taps |
| **F15** | Copy técnico / falta prueba social en pago | P2 | Confianza | S | Conversión pago |

S=1–2 días, M=3–5 días.

---

## 11. Recomendaciones accionables — Roadmap 3 sprints

### Sprint 1 — P0 “Desbloquear satisfacción” (1 semana)

**1A. Wizard progresivo + precio temprano (F01, F02)**
- Paso 0: Solo **Marca → Modelo → Año → Condición** (4 campos) + CTA “Ver tarifa estimada”. Resto (color, placas, VIN, estado general, checks) mover a “Confirmar detalles del vehículo” colapsado opcional o al momento de recolección. VIN opcional con “¿No lo tienes a mano? Puedes agregarlo después”.
- Mostrar **rango de tarifa** (min–max) desde que hay marca/modelo + CP origen/destino aproximado (2 CP), antes de pedir 10 campos de dirección. Usar `previsualizarTarifa` con distancia estimada por CP-centroides si Mapbox aún no resolvió.
- Estimación de tiempo visible: “Te tomará 3 min · Guardado automático”.

**1B. Direcciones con autocompletado (F03)**
- Reemplazar 6 inputs origen/destino por **1 buscador Mapbox Search Box** (o Google Places) con `autocomplete` + chips. Al elegir sugerencia, precargar calle/número/colonia/CP/ciudad/estado y dejarlos editables colapsados (“Editar dirección detallada”).
- Mantener fallback manual para CP no encontrado. Medir: tiempo creación debe bajar de ~7 min a <3.5 min.

**1C. Soporte funcional mínimo (F04)**
- Conectar `soporte/page.tsx` a `POST /api/soporte` (o Supabase `incidencias`/`mensajes_soporte`) con validación, `folio` retorno y confirmación “Te respondemos en <30 min”. Si no hay backend aún, usar `mailto:` con `subject` prellenado + copia del mensaje + tracking evento.
- Añadir SLA visible y horario. Ocultar `TogglePreferencia` si es solo lectura o hacerlos editables.

**1D. Pasaporte “ansiedad-cero” (F05)**
- Nuevo orden above-the-fold: **Estado grande + ETA/progreso + Card conductor (foto, nombre, rating, botón Chat/Llamar) + Ruta resumida + Próxima acción**. Todo abierto.
- Acordeones restantes (evidencia, detalles vehículo, pago) colapsados pero con badges (“3 fotos · Ver”).
- `AccionesRapidas` sticky solo con 1 CTA primario contextual (“Chatear con conductor” cuando está en camino) + menú “Más”.
- Al hacer tap en “Chat”, auto-expandir acordeón y focus en input.

### Sprint 2 — P1 “Fluidez y claridad” (1 semana)

**2A. Validación inline + foco al error (F06):** `onBlur` + `aria-describedby` + `aria-invalid` en todos los `Field`; al pulsar Continuar, `focus()` al primer campo inválido y `scrollIntoView({block:'center'})`. Contador “2 campos por completar” con `aria-live=polite`.

**2B. Mis viajes (F07):** Renombrar pestañas a **En curso · Por iniciar · Historial · Cancelados** con tooltip explicativo. Añadir búsqueda por folio/placa/ciudad + orden “Más reciente / Más próximo”. Hacer origen/destino multilinea sin `truncate`.

**2C. Agenda humana (F08):** Reemplazar `datetime-local` por **segmented “Lo antes posible / Elegir fecha”** + date picker + slots “Mañana 9–13 / Tarde 13–18 / Noche 18–21” + confirmación zona `America/Mexico_City`. Ventanas como `select` con rangos predefinidos + “Otra” texto.

**2D. Tema y contraste (F09, F12):** Toggle claro/oscuro en `Preferencias` + `localStorage` + `prefers-color-scheme` por defecto. Subir `--ruum-border` a 0.32 y añadir `border-strong` en inputs. Asociar todos los `Field` con `id/htmlFor`.

**2E. Onboarding activador (F11):** “Hola {nombre}, tu Pasaporte estará listo en 3 pasos” + preview interactivo del Pasaporte (demo con datos ficticios) + CTA “Ver demo” y “Solicitar ahora”. Medir activación 24h.

### Sprint 3 — P2 “Delight y pulido” (1 semana)

**3A. Evidencia comparativa (F10):** Vista “Antes / Después” con slider o grid 2×2 (frente, piloto, copilo, tablero) + badge “Sin daños nuevos” cuando no hay incidencia. Botón “Descargar PDF evidencia”.

**3B. Prueba social en pago (F15):** En sticky tarifa y en `PagoStripe`, añadir “Conductores certificados · Pago seguro Stripe · +X traslados verificados” + logos medios pago.

**3C. Skeletons & performance (F13):** `loading.tsx` con shimmer para `mis-viajes`, `InicioUsuario` y `traslados/[id]`. Lazy `mapa` y `Evidencia`. Reducir gradients fixed en móvil.

**3D. Microcopy y consistencia:** Glosario operativo: “autoclasificación” → “clasificación automática”, “Torre de Control” → “nuestro equipo”, “traslado en curso” → “En camino”. Añadir `ayuda` contextual en cada campo denso.

**3E. Navegación desktop:** Convertir dropdown “Cuenta” en nav item activo con submenu hover + hacer “Solicitar traslado” primario amarillo (ahora es secondary) para jerarquía clara.

---

## 12. Propuestas de UI (wireframe textual)

### Wizard ideal — 3 pasos percibidos (no 4)

```
[Header: Ruum Ruum · Paso 1 de 3 · Guardado ✓ · 3 min]

Paso 1 — Tu vehículo
[Marca v] [Modelo v] [Año  ] [Condición v]
> Tarifa estimada: $1,840 – $2,120 MXN · Pago al cierre
  “Con 2 códigos postales afinamos el precio exacto”
[Continuar]

Paso 2 — ¿Dónde? (1 buscador)
[🔍 Origen: Av. Patriotismo 12, Col. Escandón...  ✓ CP 11800]
[🔍 Destino: Calle 5 123, Col. Centro, Puebla ... ✓ CP 72000]
[Quien entrega: Nombre Apellido · Tel] [Quien recibe ...]
> Distancia 112 km · 1h 42m · Ruta verificada
[Continuar]

Paso 3 — ¿Cuándo y cómo?
[Lo antes posible ○] [Programar ○ → Calendario + slots]
[Local ○ Foráneo ○] [Personal/Empresa...]
[Ventana recolección v] [Ventana entrega v]
[Resumen vehículo + ruta + tarifa final $1,950] [Pagar/Confirmar]
```

### Pasaporte ideal — Above the fold

```
[Folio #RM-A3F9 · Actualizado hace 4 min · Estado: En camino]
[██████░░░░ 6/12 · Próximo: Llegada a destino · ETA 14:32]
[Conductor: Ana R. ★4.9 · 312 traslados · [Chat] [Llamar]]
[Ruta: CDMX Escandón → Puebla Centro · 112 km · Ver en mapa]
[Evidencia: Inicial 5/5 ✓ · Final 0/5 pendiente]
[Acciones: Reportar incidencia · Soporte]

[Detalles colapsados: Ruta y contactos (3) · Vehículo · Pago · Evidencia comparativa]
```

---

## 13. Métricas — Cómo saber si sube la satisfacción

**HEART:**
- **Happiness:** CSAT post-solicitud (1–5) y CSAT post-entrega. Objetivo ≥4.6.
- **Engagement:** % usuarios que ven Pasaporte ≥3 veces durante traslado.
- **Adoption:** % registros que crean 1ª solicitud en 24h (hoy ~ ? → objetivo +30%).
- **Retention:** % que repite en 60 días.
- **Task success:** Tasa completado wizard (hoy ~55% → objetivo 80%), tiempo medio creación (<4 min), tickets soporte resueltos <30 min.

**CES (Customer Effort Score):** “¿Qué tan fácil fue solicitar tu traslado?” (1–7). Objetivo ≥6.

**Instrumentación ya existente:** `registrarEventoUx` (login_visto, traslado_nuevo_visto/enviado/exitoso/error). Añadir: `tarifa_vista`, `direccion_autocompletada`, `pasaporte_contacto_tocado`, `evidencia_vista`, `soporte_enviado`.

**NPS:** Preguntar 7 días post-cierre (no in-app invasivo). Segmentar por `tipo_cuenta` y `modalidad`.

---

## 14. Checklist de implementación inmediata (sin diseño nuevo)

- [ ] Asociar `htmlFor/id` en todos los `Field` del wizard + `aria-invalid/describedby`.
- [ ] Foco al primer error + `aria-live` para `previsualizando`/`rutaCalculando`.
- [ ] Renombrar pestañas `mis-viajes` y añadir búsqueda folio.
- [ ] Hacer `Soporte` enviable (aunque sea mailto con template) y mostrar SLA.
- [ ] Toggle tema claro/oscuro + subir opacidad bordes a 0.32.
- [ ] Skeletons para `mis-viajes` y `InicioUsuario`.
- [ ] Mover VIN/4 checks a sección opcional colapsada en paso 0.
- [ ] Sticky slim progress bar en wizard móvil.
- [ ] Auto-expandir acordeón Chat al navegar `#chat-conductor`.
- [ ] Reemplazar `datetime-local` por date + slots.

---

## 15. Riesgos y decisiones

- **No negociar tarifa:** El sistema ya no pide presupuesto manual — mantener. El usuario percibe “precio justo calculado”, no “regateo”.
- **Privacidad VIN/placas:** Guardar borrador sin VIN/placas es correcto — no relajar.
- **Mapbox token:** Si no está configurado, el fallback “operación ubicará a mano” debe ser explícito en UI, no silencioso.
- **Stripe:** No pedir tarjeta antes de mostrar tarifa final — orden actual (crear → aceptar cotización → pagar) es correcto; solo falta comunicarlo.

---

## 16. Conclusión

La app usuario ya transmite **seguridad y profesionalismo** — lo difícil está hecho. Lo que hoy frena la alta satisfacción no es visual, es **esfuerzo y ansiedad**: demasiados campos antes del precio, direcciones sin ayuda y un Pasaporte que esconde lo que más tranquiliza.

Con el roadmap P0 (1 semana) la percepción pasará de “trámite” a “servicio que me cuida”. Con P1+P2, de “cumple” a **“lo recomiendo”**.

**Próximo paso recomendado:** Implementar Sprint 1 (F01–F05) y medir `tasa completado wizard` + `CES` en cohorte A/B antes de seguir.

---
*Auditoría realizada sobre `apps/app-usuario` en commit actual (agosto 2026). Para dudas o priorización, ver `INFORME_FLUJOS_APP_USUARIO.md` y `packages/ui/src/styles/tokens.css`.*
