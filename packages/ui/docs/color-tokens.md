# Tokens semánticos de color

Los productos Ruum deben consumir tokens semánticos, no HEX directos ni opacidades arbitrarias para texto crítico.

| Token Tailwind | Variable | Uso | Contraste esperado |
| --- | --- | --- | --- |
| `text-primary` | `--ruum-text-primary` | Texto principal, títulos y datos críticos. | AA sobre `surface` y `canvas`. |
| `text-secondary` | `--ruum-text-secondary` | Texto auxiliar normal, descripciones y metadatos útiles. | AA para texto normal sobre `surface`. |
| `text-tertiary` | `--ruum-text-tertiary` | Etiquetas, hints cortos y texto no crítico. | AA para texto grande o semibold; no usar para contenido crítico. |
| `text-disabled` | `--ruum-text-disabled` | Controles deshabilitados. | No aplica a información accionable. |
| `bg-surface` | `--ruum-surface` | Superficie base de tarjetas y formularios. | Debe aceptar texto primary/secondary. |
| `bg-surface-elevated` | `--ruum-surface-elevated` | Superficies sobre tarjetas, menús y popovers. | Debe aceptar texto primary/secondary. |
| `border-border` | `--ruum-border` | Separadores y contornos de baja jerarquía. | Visible contra surface/canvas. |
| `border-border-strong` | `--ruum-border-strong` | Contornos interactivos o agrupadores. | Visible contra surface/canvas. |
| `bg-action-primary` | `--ruum-action-primary` | CTA principal. | Texto primary definido por el componente. |
| `text-route-action` / `bg-route-action` | `--ruum-route` | Navegación, ruta y seguimiento operativo. | AA con sus pares definidos. |
| `text-success` | `--ruum-success` | Confirmaciones y estados aprobados. | AA sobre surface y fondos soft. |
| `text-warning` | `--ruum-warning` | Atención no destructiva. | AA sobre surface y fondos soft. |
| `text-danger-action` / `bg-danger-action` | `--ruum-danger` | Error, rechazo o acción destructiva. | AA sobre surface y texto claro en botón. |

Contraste medido para texto normal:

| Par | Ratio |
| --- | --- |
| `text-primary` sobre `surface` claro | 16.41:1 |
| `text-secondary` sobre `surface` claro | 7.38:1 |
| `text-tertiary` sobre `surface` claro | 4.83:1 |
| `text-primary` sobre `surface` oscuro de conductor | 14.82:1 |
| `text-secondary` sobre `surface` oscuro de conductor | 9.68:1 |
| `text-tertiary` sobre `surface` oscuro de conductor | 5.96:1 |

Notas:

- No usar `text-white/40`, `text-ink/45` o equivalentes para texto que explique una acción, un estado económico, un rechazo o una instrucción operativa.
- Los alias `text-text-primary`, `text-text-secondary`, `text-text-tertiary` y `text-text-disabled` existen solo para compatibilidad durante la migración.
- Si una app reasigna el tema, debe reasignar también `--ruum-text-primary`, `--ruum-text-secondary`, `--ruum-text-tertiary`, `--ruum-text-disabled`, `--ruum-surface-elevated` y los tokens de acción.
- Los tokens `text-tertiary` y `text-disabled` nunca sustituyen mensajes de error, estados bloqueantes ni CTA.
