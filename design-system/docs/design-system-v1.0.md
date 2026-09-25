# Design System v1.0 — Especificación por superficie

> Resumen operativo del Libro de Marca V2.1. El Libro manda; esto es la entrega a desarrollo.

## 1. Tokens (cap. 26)

Ver `../tokens/tokens.json`. Mapeo Tailwind v4 sugerido:

```css
@theme {
  --color-navy: var(--ruum-navy);
  --color-teal-deep: var(--ruum-teal-deep);
  --color-action: var(--ruum-action);
  --color-surface-brand: var(--ruum-surface-brand);
}
```

## 2. Logotipo — RR entrelazado (cap. 10–12)

- Símbolo: bloque bold inclinado, corte central = carretera, swoosh turquesa `00D1D1` → pin de entrega.
- Versiones: Horizontal (B2B/contratos/web) · Solo símbolo (avatar/app-icon/favicon/sello) · Sello = símbolo solo · Vertical (portadas) · Blanca/monocromática sobre navy o foto con overlay navy 60%.
- Mínimos: símbolo 32px / 15mm · horizontal sin firma 96px / 25mm · con firma 160px / 40mm · sello 72px / 24mm · avatar 48px.
- Área de seguridad = x (altura R) por lado. Firma corta solo ≥160px/40mm.
- Implementación: `SimboloRR` en `@ruum/ui` (SVG, sin texto tipeado, usa tokens). PNG maestro en `../assets/ruum-logo-v2.png`.

## 3. Componentes (cap. 19)

| Componente | Spec |
|---|---|
| ButtonPrimary | h 52 (56 calle), radio 14–16, degradado CTA teal-deep→azul, texto blanco Semibold 16, 1 por pantalla. Estados: default/hover/focus/active/disabled/loading. |
| ButtonSecondary | borde 1.5px + texto azul acción sobre blanco, sin degradado. Filtros y apoyo. |
| ButtonText | azul acción Semibold, chevrón si navega. |
| StatusChip | 12 estados cap. 20, 12px Semibold + ícono 14px + texto, full-rounded. Colores cap. 13. |
| Card | fondo blanco, borde 1px E6F0FF, radio 20, sombra suave, padding 16–20. Variantes: default/elevated/interactive. |
| Input/Select | h 48, borde 1px 7A8DAE, radio 12, etiqueta 13 Semibold. Foco: borde azul + anillo 2px sep 2px. Error: borde+texto C23648 + ícono. |
| Checkbox/Radio/Toggle | 44px hit-area, foco visible, disabled con opacidad + not-allowed. |
| Alert/Toast | success/error/warning/info con ícono+texto. Los que exigen acción no autodismiss. |
| Modal | default/loading/error, foco atrapado, overlay navy 60%. |
| EmptyState | título + 1 línea de qué sigue. Sin CTA duplicado. |
| Skeleton | listas; spinner solo <3s. |
| BottomNav | 4 items (Inicio, Traslados, Ayuda, Cuenta). Activo teal-deep + indicador superior. |
| Tabs | píldoras con conteo. Activa: fondo teal-deep texto blanco. Sin wrap a 2 líneas. |
| Sidebar | por función + contadores pendientes. Activo con fondo sutil. |
| Avatar | circle/rounded, símbolo 50–60% ancho, radio ≈24%. |

## 4. App del usuario

- Paleta/tipografía/botones/chips desde tokens. Una acción principal por pantalla.
- Tablas y formularios: texto 14–16, etiquetas 13 Semibold, cifras tabulares en folios/tarifas/fechas.
- Copy: patrón estado + siguiente paso; tú en producto; sin absolutos (cap. 8).

## 5. App del conductor — modo calle (cap. 23)

- Se activa con traslado activo (`data-street="true"` o clase `.ruum-street`).
- Botones ≥56px, texto ≥17px, contrastes reforzados, una acción por pantalla, progreso visible.
- Botón seguridad persistente rojo emergencia B3261E, siempre ≤1 toque. 8 opciones por prioridad: crítica (rojo sólido), alta (contorno navy), media (neutro). Al enviar: ubicación + folio + persona responde.
- Pago grande tabular con desglose antes de aceptar; sin presión (sin contadores).
- Evidencia 7 pasos con barra; sin avanzar incompleta.

## 6. Panel administrativo (cap. 24)

- Sidebar por función (Traslados, Asignaciones, Conductores, Evidencia, Incidentes, Pagos, Auditoría) con contadores.
- Indicadores: máximo 4, cada uno accionable.
- Tablas: folio primero, estado como chip, evidencia n/N. Filtrables/ordenables/exportables. Filas 44–52px, texto 14px.
- Bitácora asignación lateral; asignación manual exige justificación.
- Permisos por rol; acciones críticas con confirmación. Operable por teclado.

## 7. Documentos (cap. 28)

- Encabezado lockup horizontal; folio arriba derecha. Pie "Ruum Ruum by MoviliaX" + lema en formales.
- Navy títulos, teal-deep etiquetas, sin fondos oscuros grandes. Inter (Calibri/Arial fallback), márgenes 20–25mm.
- Reporte: folio/cliente/servicio/vehículo/ruta/conductor+nivel/tiempos/comparativo/odómetro/combustible/daños/bitácora/firmas/QR/pie.
- Acta: folio/vehículo/estado/objetos/identificación origen-destino/observaciones/hora/firma.
- Estado de pago: folio/base/bonos/reembolsables/fecha estimada/estatus + causa si detenido.
- Fotos con placas/rostros difuminados fuera del cliente.

## 8. WhatsApp (cap. 31)

Ver `../whatsapp/`. Mensajes ≤5 líneas, estado + siguiente paso, folio por traslado.

## 9. Landing (cap. 32)

Encabezado (lockup + Empresas/Conductores/Cómo funciona/Contacto + CTA Solicitar propuesta) · Hero (titular + 3 pilares + CTA principal/secundario + cobertura) · Cómo funciona (3 pasos) · Evidencia (reporte ficticio indicado) · Conductores · Formulario B2B (usted, formal).

## 10. Accesibilidad (cap. 21)

Contraste texto 4.5:1 (3:1 solo ≥24px o 18.66 bold) · UI 3:1 · touch 44/56 · ícono+texto · foco visible · lector · escala 200% · motion 150/250 ease-out + reduced-motion · es-MX · oscuro por validar.
