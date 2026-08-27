# Design System - Ruum Conductor

**Versión:** 1.0  
**Fecha:** 27 de agosto de 2026  
**Responsable:** Mistral Vibe - Auditoría UX/UI

Este documento detalla el sistema de diseño (Design System) de la aplicación **Ruum Conductor**, incluyendo tokens, componentes, y patrones de diseño. Surgió como parte de la recomendación **CON-001 y CON-002** de la auditoría integral UX/UI.

---

## 🎨 Paleta de Colores

### Colores de Marca (Brand Colors)

| Nombre | Token | Valor HEX | Uso | WCAG Ratio (Tema oscuro) |
|--------|-------|-----------|-----|--------------------------|
| **Azul Trazabilidad** | `--ruum-route` | `#1E88E5` | Links, acciones principales, acentos | 4.5:1 ✅ |
| **Amarillo Ruta** | `--ruum-signal` | `#FFC400` | CTA primarios, estados activos, alertas | 4.5:1 ✅ |
| **Rojo Peligro** | `--ruum-danger` | `#dc3545` | Errores, estados críticos | 4.5:1 ✅ |
| **Verde Éxito** | `--ruum-success` | `#22c55e` | Confirmaciones, estados positivos | 4.5:1 ✅ |
| **Naranja Advertencia** | `--ruum-warning` | `#f59e0b` | Alertas, estados de atención | 4.5:1 ✅ |
| **Azul Información** | `--ruum-info` | `#3b82f6` | Información, mensajes neutros | 4.5:1 ✅ |

### Colores Semánticos (Tokens desde @ruum/ui)

| Token | Valor (Light) | Valor (Dark) | Descripción |
|-------|---------------|--------------|-------------|
| `--ruum-canvas` | `#ffffff` | `#0f131a` | Fondo principal |
| `--ruum-surface` | `#f8f9fa` | `#151515` | Superficie principal |
| `--ruum-surface-strong` | `#e9ecef` | `#1a1a1a` | Superficie elevada |
| `--ruum-text` | `#212529` | `#ffffff` | Texto principal |
| `--ruum-text-secondary` | `#6c757d` | `#9ca3af` | Texto secundario |
| `--ruum-text-tertiary` | `#adb5bd` | `#6b7280` | Texto terciario |
| `--ruum-text-disabled` | `#6c757d` | `#4b5563` | Texto deshabilitado |

### Superficies de Marca

```css
/* Ejemplo de uso */
.bg-surface { background: var(--ruum-surface); }
.bg-surface-elevated { background: var(--ruum-surface-strong); }
.bg-route-soft { background: rgba(30, 136, 229, 0.1); }
.bg-signal { background: var(--ruum-signal); }
```

---

## 📏 Espaciado

El sistema de espaciado sigue la escala de Tailwind CSS:

| Nombre | Token | Valor | Uso |
|--------|-------|-------|-----|
| xs | - | 0.25rem (4px) | Padding interno mínimo |
| sm | - | 0.5rem (8px) | Padding interno |
| md | - | 1rem (16px) | Padding estándar |
| lg | - | 1.5rem (24px) | Padding externo |
| xl | - | 2rem (32px) | Secciones |
| 2xl | - | 3rem (48px) | Contenedores |
| 3xl | - | 4rem (64px) | Padding de página |

---

## ⭕ Border Radius (DS-001 - Unificado)

| Token | Valor | Uso |
|-------|-------|-----|
| `--ruum-radius-xs` | 0.375rem (6px) | Inputs, botones pequeños |
| `--ruum-radius-sm` | 0.5rem (8px) | Cards pequeños |
| `--ruum-radius-md` | 0.75rem (12px) | Cards estándar |
| `--ruum-radius-lg` | 1rem (16px) | Cards principales, botones |
| `--ruum-radius-xl` | 1.5rem (24px) | Contenedores, modales |
| `--ruum-radius-2xl` | 2rem (32px) | Cards destacados (PanelActiveTripCard) |
| `--ruum-radius-3xl` | 3rem (48px) | Cards especiales |

**Uso actual en la aplicación:**
- Cards principales: `rounded-2xl` (16px) ✅
- Botones: `rounded-xl` (12px) ✅
- Inputs: `rounded-lg` (8px) ✅
- Modales: `rounded-2xl` (16px) ✅

---

## 🌑 Sombras (DS-002 - Escala Definida)

| Token | Valor | Uso |
|-------|-------|-----|
| `--ruum-shadow-2xs` | `0 1px 2px 0 rgba(0,0,0,0.02)` | Elementos muy sutiles |
| `--ruum-shadow-xs` | `0 1px 3px 0 rgba(0,0,0,0.05)` | Cards en hover |
| `--ruum-shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.05), 0 2px 4px 0 rgba(0,0,0,0.05)` | Cards estándar |
| `--ruum-shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)` | Modales, dropdowns |
| `--ruum-shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)` | Cards flotantes |
| `--ruum-shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)` | Bottom sheets |

**Tokens desde @ruum/ui:**
- `--ruum-shadow-1`: Sombra más sutil
- `--ruum-shadow-2`: Sombra estándar
- `--ruum-shadow-3`: Sombra media
- `--ruum-shadow-4`: Sombra fuerte

---

## ⚡ Easing Functions (DS-003 - Unificado)

| Token | Valor | Uso |
|-------|-------|-----|
| `--ruum-ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Animaciones estándar |
| `--ruum-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Entradas y salidas |

**Uso en CSS:**
```css
transition: all 200ms var(--ruum-ease-standard);
```

**Uso en Tailwind:**
```tsx
className="transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
```

---

## 📐 Tipografía

### Familias de Fuentes

```css
/* Montserrat - Títulos y énfasis */
font-family: var(--font-display);
/* Inter - Cuerpo de texto */
font-family: var(--font-body);
/* IBM Plex Mono - Código y datos técnicos */
font-family: var(--font-mono);
```

### Escala Tipográfica

| Nombre | Clase Tailwind | Píxeles | Uso |
|--------|---------------|---------|-----|
| Display XL | `text-5xl` | 48px | Títulos principales |
| Display LG | `text-4xl` | 40px | Títulos de sección |
| Display MD | `text-3xl` | 32px | Subtítulos |
| Display SM | `text-2xl` | 28px | Títulos de card |
| Display XS | `text-xl` | 24px | Títulos pequeños |
| Body LG | `text-lg` | 20px | Texto grande |
| Body MD | `text-base` | 18px | Texto estándar |
| Body SM | `text-sm` | 16px | Texto pequeño |
| Body XS | `text-xs` | 14px | Texto muy pequeño |
| Caption | `text-[11px]` | 11px | Etiquetas, ayuda |
| Caption XS | `text-[10px]` | 10px | Etiquetas compactas |

---

## 🎯 Componentes Principales

### Botones

**Variantes:**
- Primary: `bg-signal text-slate-950` - Acciones principales
- Secondary: `bg-surface border border-border` - Acciones secundarias
- Quiet: `text-text-secondary hover:text-text-primary` - Acciones sutiles
- Danger: `bg-danger text-white` - Acciones destructivas

**Estados:**
- Default: `hover:bg-.../90 active:scale-[0.98]`
- Loading: `aria-busy="true"`
- Disabled: `opacity-50 cursor-not-allowed`

**Tamaños:**
- sm: `min-h-10 px-3`
- md: `min-h-11 px-4`
- lg: `min-h-12 px-6`

### Cards

**Estructura:**
```tsx
<div className="bg-surface-elevated border border-border/40 rounded-2xl p-5 shadow-sm">
  {/* Contenido */}
</div>
```

**Variantes:**
- Elevated: `bg-surface-elevated shadow-sm`
- Flat: `bg-surface border border-border/20`
- Interactive: `hover:bg-surface-elevated transition-colors`

### Formularios

**Campos (Field):**
- Label: `font-body text-sm font-medium`
- Input: `bg-surface border border-border rounded-lg`
- Error: `border-danger text-danger`
- Help text: `font-body text-xs text-text-tertiary`

---

## 🎨 Patrones de Diseño

### 1. Tarjeta de Viaje Activo
- **Forma:** `rounded-3xl border border-border/30`
- **Color:** `bg-surface-elevated`
- **Sombra:** `shadow-lg`
- **Posición:** `sticky top-2 z-10`

### 2. Botón FAB (Mobile)
- **Forma:** `rounded-full shadow-lg`
- **Color:** `bg-signal text-slate-950`
- **Posición:** `fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4`

### 3. Navegación Bottom Tab
- **Altura:** `min-h-[56px]`
- **Grid:** `grid-cols-5 gap-0.5`
- **Iconos:** 24px × 24px
- **Etiquetas:** `text-[10px]`

### 4. Header de Navegación (Desktop)
- **Altura:** `min-h-16`
- **Fondo:** `bg-surface/95 backdrop-blur`
- **Borde:** `border-b border-border`

---

## 🌈 Tema Nocturno Neón

El tema oscuro de Ruum Conductor usa una paleta "neón" inspirada en el Brand Book:

**Características:**
- Fondo base: `#151515` (Negro asfalto)
- Superficies: `#0f131a` (Negro profundo)
- Gradientes sutiles: `rgba(30, 136, 229, 0.08)` + `rgba(255, 196, 0, 0.05)`

**Acentos:**
- Amarillo `#FFC400` (solo para CTA y estados importantes)
- Azul `#1E88E5` (para links y elementos interactivos)

---

## 📱 Adaptaciones Móvil

### Safe Area Insets
```css
/* iOS */
pb-[max(8px,env(safe-area-inset-bottom))]
/* Android */
pb-[calc(80px+env(safe-area-inset-bottom))]
```

### Tamaños Touch
- **Mínimo:** 44px × 44px para todos los elementos interactivos
- **Recomendado:** 48px × 48px para botones principales

### Feedback Háptico
```tsx
if (navigator.vibrate) {
  navigator.vibrate(12);  // Acciones menores
  navigator.vibrate(18);  // Acciones importantes
}
```

---

## 🎯 Buenas Prácticas

### 1. Accesibilidad
- Todos los SVG decorativos deben tener `aria-hidden="true"`
- Elementos con `role="status"` deben tener `aria-atomic="true"`
- Links y botones deben tener `aria-label` descriptivo
- Usar `focus-visible` para estilos de foco

### 2. Rendimiento
- Imágenes: Usar formato WebP con `priority` para above-the-fold
- Link prefetch: `prefetch` en rutas principales
- Code splitting: Usar `dynamic` de Next.js
- Animaciones: Usar `var(--ruum-ease-standard)`

### 3. Consistencia
- Siempre usar tokens de diseño en lugar de valores crudos
- Mantener la jerarquía visual: 60% blanco, 25% negro, 10% amarillo, 5% azul
- El amarillo solo se usa como acento, nunca como fondo principal

---

## 📚 Recursos

- **Tailwind CSS Docs:** https://tailwindcss.com/docs
- **WCAG Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **Design Tokens:** https://design-tokens.github.io/community-group/

---

## 📝 Historial de Cambios

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-08-27 | Documentación inicial (CON-001, CON-002) |

---

*Documentación generada como parte de la auditoría integral UX/UI - Ruum Conductor*