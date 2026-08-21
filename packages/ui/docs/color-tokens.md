# Tokens semánticos de color — Brand Book Ruum Ruum V1

Los productos Ruum deben consumir tokens semánticos basados en la identidad visual oficial (**by MoviliaX**).

## Paleta de Colores Oficial

| Color | Hex | Uso principal | Significado de marca | Proporción |
| --- | --- | --- | --- | --- |
| **Negro asfalto** | `#151515` | Fondos oscuros, textos principales, presencia institucional | Seriedad, control, operación, carretera | ~25% |
| **Amarillo ruta** | `#FFC400` | Ruta, check, botones, llamadas a la acción, acentos | Movimiento, visibilidad, seguridad, alerta positiva | ~10% (acento) |
| **Blanco evidencia** | `#F8F8F5` | Fondos limpios, documentos, formularios, espacios de lectura | Claridad, transparencia, documentación | ~60% |
| **Gris acero** | `#5F6368` | Textos secundarios, líneas, datos técnicos, detalles | Estructura, operación, neutralidad | ~5% |
| **Azul trazabilidad** | `#1E88E5` | Mapas, estados de seguimiento, ubicación, datos digitales | Rastreo, tecnología, información | ~5% |

> [!IMPORTANT]
> **Regla del Amarillo:** El amarillo `#FFC400` debe usarse como acento intencional, no como fondo dominante permanente, para evitar que la marca parezca taxi.

## Tokens Semánticos Tailwind

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
| `bg-action-primary` | `--ruum-action-primary` | CTA principal (`#FFC400`). | Texto `#151515` de alta legibilidad. |
| `text-route-action` / `bg-route-action` | `--ruum-route` | Navegación, ruta y seguimiento operativo (`#1E88E5`). | AA con sus pares definidos. |
| `text-success` | `--ruum-success` | Confirmaciones y estados aprobados (`#08734F`). | AA sobre surface y fondos soft. |
| `text-warning` | `--ruum-warning` | Atención no destructiva (`#76500E`). | AA sobre surface y fondos soft. |
| `text-danger-action` / `bg-danger-action` | `--ruum-danger` | Error, rechazo o acción destructiva (`#B32626`). | AA sobre surface y texto claro en botón. |

