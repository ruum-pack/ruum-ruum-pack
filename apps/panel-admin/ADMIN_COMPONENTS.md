# Componentes administrativos compartidos

Usar `src/app/admin-components.tsx` para nuevos controles del panel. Las pantallas no deben crear variantes locales de botones, inputs, selects, textareas, diálogos, drawers, tabs, badges o estados vacíos/carga/error.

## Componentes

- `AdminButton`: variantes `primary`, `secondary`, `quiet`, `danger`; soporta `loading`, `disabled` y foco visible.
- `AdminIconButton`: para botones sólo con icono. Requiere `aria-label`; el icono se marca como decorativo.
- `AdminInput`, `AdminSelect`, `AdminTextarea`: requieren `label`; aceptan `description` y `error`, conectados con `aria-describedby` y `aria-invalid`.
- `AdminDialog`: usa `role="dialog"`, `aria-modal`, foco inicial, ciclo de tabulación, cierre con `Escape` y retorno de foco.
- `AdminDrawer`: igual que `AdminDialog`, en panel lateral.
- `AdminTabs`: usa `tablist/tab`, `aria-selected`, roving tab index y flechas izquierda/derecha.
- `AdminBadge`: tonos `neutral`, `info`, `success`, `warning`, `danger`.
- `AdminTooltip`: visible con hover y foco; expone `role="tooltip"`.
- `AdminEmptyState`, `AdminErrorState`, `AdminLoadingState`: estados estándar para listas, errores y cargas.
- `AdminLastUpdated`: usa `<time>` con `dateTime` y formato `es-MX`.

## Reglas

- Objetivo táctil mínimo: 40 x 40 px.
- Texto operativo mínimo: 14 px; datos secundarios mínimo 12 px.
- Botones iconográficos siempre requieren nombre accesible.
- Iconos puramente visuales deben llevar `aria-hidden="true"`.
- Al cerrar `AdminDialog` o `AdminDrawer`, el foco debe volver al control que abrió la capa.
