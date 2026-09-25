# Ruum Ruum — Design System v1.0

Fuente única de identidad visual (Libro de Marca V2.1, Parte II + III).
Proporción: **60% Navy `0A2342` / 30% Blanco/Gris `FFFFFF`/`E8EEF4` / 8% Teal `00D1D1`/`008B8B` / 2% Estados**.

## Contenido

| Ruta | Qué es |
|---|---|
| `tokens/tokens.json` | Fuente canónica (color, gradient, font, space, radius, elevation, size, motion) |
| `tokens/tokens.css` | Variables CSS `:root` + `[data-theme]` para Web (React/Vue) → copiar a `/src/tokens/` |
| `tokens/tokens.ts` | Constantes TypeScript / React Native → `/src/theme/tokens.ts` |
| `tokens/Tokens.swift` | Struct + extensión Color iOS → `/DesignSystem/Tokens.swift` |
| `tokens/Tokens.kt` | Object + Color Android → `/designsystem/Tokens.kt` |
| `assets/ruum-logo-v2.png` | Logotipo maestro (símbolo RR entrelazado + swoosh + pin) |
| `docs/design-system-v1.0.md` | Especificación de componentes y patrones por superficie |
| `docs/verificacion-accesibilidad.md` | Checklist de contraste, teclado, lector, escala 200%, modo calle |
| `whatsapp/` | Perfil, saludo, respuestas rápidas, catálogo (Fase 0) |
| `../packages/ui/src/` | Implementación React de referencia (Button, StatusChip, Card, Input, …) |

## Reglas (cap. 13 / 19 / 21)

1. Nunca hardcodear. Todo color/tamaño/espaciado viene de un token.
2. Nunca usar color como única señal. Estados llevan ícono + texto.
3. Contraste mínimo 4.5:1 texto; 3:1 elementos UI.
4. Áreas táctiles ≥44px; ≥56px en modo calle.
5. Respetar `prefers-reduced-motion`.
6. Modo calle: `size.touch-street`, `size.button-height-street`, `font.size.body` ≥17px cuando el conductor está en traslado activo.
7. Teal brillante solo gráfico. Blanco solo sobre navy/teal-deep/azul. CTA = único degradado con texto.

## Uso Web

```css
@import "./tokens/tokens.css";
.cta { background: var(--ruum-gradient-cta); color: var(--ruum-white); min-height: var(--ruum-button-height); border-radius: var(--ruum-radius-button); }
```

```tsx
import { ButtonPrimary, StatusChip } from "@ruum/ui";
<ButtonPrimary>Solicitar propuesta</ButtonPrimary>
<StatusChip estado="en-ruta" />
```

## Versionado

Nomenclatura: `AAAA-MM-DD_pieza_versión` (ej. `2026-09-25_button-primary_v1.0`).
Ramas: `main` (producción), `develop` (integración), `feature/` (trabajo).
Cambios en `CHANGELOG.md` con fecha, autor y motivo.
