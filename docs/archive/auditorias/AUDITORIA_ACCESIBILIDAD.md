# Auditoría Automática de Accesibilidad

## Descripción General

Este proyecto implementa un sistema completo de auditoría automática de accesibilidad utilizando:

- **ESLint** con `eslint-plugin-jsx-a11y` - Análisis estático de código
- **Axe Core** - Motor de pruebas de accesibilidad
- **Lighthouse** - Auditorías de accesibilidad en el navegador
- **Playwright** - Pruebas de accesibilidad automatizadas
- **Storybook Accessibility Addon** - Verificación visual de componentes

## Criterios de Aceptación

- ✅ **Cero errores críticos de Axe** en flujos principales
- ✅ **Lighthouse Accessibility ≥ 95** en pantallas representativas

## Estructura

```
app-conductor/
├── .github/workflows/
│   └── accessibility-audit.yml      # Workflow de CI/CD
├── .storybook/
│   ├── main.js                     # Configuración de Storybook
│   └── preview.js                  # Configuración de accesibilidad
├── eslint.config.mjs               # Reglas ESLint con accesibilidad
├── lighthouserc.js                 # Configuración Lighthouse
├── playwright.config.ts            # Configuración Playwright
├── scripts/
│   └── audit-a11y.mjs              # Script de auditoría local
├── tests/
│   ├── a11y/
│   │   └── accessibility.spec.ts   # Pruebas Playwright
│   └── global-setup.ts
└── package.json                    # Scripts y dependencias
```

## Configuración

### 1. Instalación de Dependencias

```bash
# En el directorio raíz del workspace
pnpm install

# O en el directorio de la app
cd apps/app-conductor
pnpm install
```

### 2. Instalación de navegadores Playwright

```bash
pnpm --filter @ruum/app-conductor exec playwright install chromium firefox webkit
```

### 3. Instalación de Lighthouse CI

```bash
pnpm --filter @ruum/app-conductor add -D @lhci/cli
```

## Ejecución de Auditorías

### Auditoría Completa

```bash
# Ejecutar auditoría completa (ESLint + Axe + Playwright + Lighthouse)
pnpm audit:a11y
```

### Auditorías Individuales

```bash
# ESLint con reglas de accesibilidad
pnpm lint:a11y

# Pruebas de accesibilidad con Playwright
pnpm test:a11y

# Pruebas de accesibilidad con interfaz visual
pnpm test:a11y:ui

# Auditoría Axe Core (requiere servidor en ejecución)
pnpm test:axe

# Auditoría Lighthouse
pnpm test:lighthouse

# Iniciar Storybook con addon de accesibilidad
pnpm storybook
```

### Auditoría por Ruta Específica

```bash
# Auditar rutas específicas
pnpm audit:a11y:route -- --route /login --route /cuenta/perfil
```

## Auditoría por Ruta

### Rutas Principales Auditadas

1. `/` - Página principal
2. `/login` - Página de login
3. `/configuracion` - Configuración
4. `/cuenta` - Perfil de cuenta
5. `/cuenta/perfil` - Perfil
6. `/cuenta/datos-bancarios` - Datos bancarios
7. `/cuenta/documentos` - Documentos
8. `/cuenta/seguridad` - Seguridad
9. `/cuenta/soporte` - Soporte
10. `/cuenta/preferencias` - Preferencias
11. `/ganancias` - Ganancias
12. `/panel` - Panel principal
13. `/legal/privacidad` - Políticas de privacidad
14. `/legal/terminos` - Términos y condiciones

## Integración CI/CD

El workflow de GitHub Actions (`accessibility-audit.yml`) ejecuta automáticamente:

1. **ESLint Accessibility** - Análisis estático
2. **Axe Core** - Pruebas automáticas de accesibilidad
3. **Playwright** - Pruebas de accesibilidad en múltiples navegadores
4. **Lighthouse** - Auditorías de accesibilidad y rendimiento
5. **Storybook** - Verificación de build con addon de accesibilidad

### Desencadenamiento

- **Push** a ramas: `main`, `staging`, `develop`
- **Pull Request** a ramas: `main`, `staging`

### Artefactos Generados

- Reportes Playwright
- Reportes Lighthouse
- Reportes consolidados de accesibilidad

## Reglas de Accesibilidad Configuradas

### ESLint (jsx-a11y)

- `alt-text` - Imágenes deben tener texto alternativo
- `anchor-is-valid` - Links deben ser válidos
- `click-events-have-key-events` - Eventos de click deben tener eventos de teclado
- `label-has-associated-control` - Labels deben estar asociados a controles
- `no-noninteractive-element-interactions` - Elementos no interactivos no deben tener interacciones
- `no-static-element-interactions` - Elementos estáticos no deben tener interacciones
- `role-has-required-aria-props` - Roles deben tener props ARIA requeridos
- Y más...

### Axe Core

- `color-contrast` - Contraste de color adecuado
- `image-alt` - Texto alternativo en imágenes
- `label` - Etiquetas en formularios
- `button-name` - Nombres en botones
- `bypass` - Enlace para saltar contenido
- `html-has-lang` - Atributo lang en HTML

### Lighthouse

- Score mínimo de accesibilidad: **95/100**
- Verificación de estructura semántica
- Contraste de color
- Navegación por teclado
- ARIA correcto

## Corrección de Errores Críticos

### Errores Comunes y Soluciones

#### 1. Imágenes sin texto alternativo

**Problema:** `<img src="logo.png" />`

**Solución:**
```tsx
<img src="logo.png" alt="Logo de la empresa" />
// O para imágenes decorativas
<img src="decorative.png" alt="" role="presentation" />
```

#### 2. Formularios sin etiquetas

**Problema:** `<input type="text" name="email" />`

**Solución:**
```tsx
<label htmlFor="email">Correo Electrónico</label>
<input type="text" id="email" name="email" />

// O con aria-label
<input type="text" name="email" aria-label="Correo Electrónico" />
```

#### 3. Botones sin texto

**Problema:** `<button><Icon /></button>`

**Solución:**
```tsx
<button aria-label="Buscar">
  <Icon />
</button>

// O con texto oculto
<button>
  <span className="sr-only">Buscar</span>
  <Icon />
</button>
```

#### 4. Contraste de color insuficiente

**Problema:** Texto gris claro sobre fondo blanco

**Solución:** Usar colores con contraste mínimo de 4.5:1

```tsx
// Usar clases de Tailwind con contraste adecuado
text-gray-900 bg-white  // ✅ Bueno
text-gray-400 bg-white  // ❌ Malo
```

#### 5. Navegación por teclado

**Problema:** Elementos no son focuseables

**Solución:**
```tsx
// Asegurar que todos los elementos interactivos sean focuseables
<button tabIndex={0}>Botón</button>

// Usar elementos semánticos
<button>Botón</button>  // ✅ Bueno
div onClick={...}       // ❌ Evitar
```

#### 6. Jerarquía de encabezados

**Problema:** `<h3>` sin `<h1>` o `<h2>`

**Solución:**
```tsx
<h1>Título Principal</h1>
<h2>Sección</h2>
<h3>Subsección</h3>
```

#### 7. Lenguaje de la página

**Problema:** `<html>` sin atributo lang

**Solución:**
```tsx
<html lang="es">
  {/* contenido */}
</html>
```

## Evitar Regresiones

### 1. Pruebas Automáticas en CI

Todas las pruebas de accesibilidad se ejecutan automáticamente en CI:
- No se puede hacer merge si hay errores críticos
- Lighthouse debe tener score ≥ 95
- Axe Core no debe reportar violaciones

### 2. Revisión Manual

Antes de hacer commit:

```bash
# Ejecutar auditoría local
pnpm audit:a11y

# Verificar cambios en el código
pnpm lint:a11y
```

### 3. Monitoreo Continuo

- Configurar alertas en CI para fallos de accesibilidad
- Revisar reportes de Lighthouse periódicamente
- Mantener el score de accesibilidad por encima de 95

## Estructura de los Reportes

### Reportes Generados

```
results/
├── axe-report-YYYY-MM-DD.json         # Reporte diario de Axe
├── axe-{ruta}.json                   # Reportes por ruta
├── axe-consolidated-report.json     # Reporte consolidado
└── accessibility-audit-report.json   # Resumen final
```

### Contenido del Reporte Consolidado

```json
{
  "timestamp": "2026-07-17T18:00:00.000Z",
  "esLint": {
    "status": "passed",
    "errors": []
  },
  "axe": {
    "status": "passed",
    "violations": []
  },
  "playwright": {
    "status": "passed",
    "errors": []
  },
  "lighthouse": {
    "status": "passed",
    "scores": {
      "accessibility": 98
    }
  }
}
```

## Buenas Prácticas

### 1. Componentes Accesibles

```tsx
// ✅ Buen ejemplo
export function AccessibleButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
      aria-label={children}
    >
      {children}
    </button>
  );
}

// ❌ Mal ejemplo
export function BadButton({ onClick }) {
  return (
    <div onClick={onClick}>
      Haz click
    </div>
  );
}
```

### 2. Formularios Accesibles

```tsx
// ✅ Buen ejemplo
export function AccessibleForm() {
  return (
    <form>
      <div>
        <label htmlFor="email">Correo Electrónico</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          aria-required="true"
        />
      </div>
      <button type="submit">Enviar</button>
    </form>
  );
}
```

### 3. Navegación Accesible

```tsx
// ✅ Buen ejemplo
export function AccessibleNavigation() {
  return (
    <nav aria-label="Navegación principal">
      <ul>
        <li>
          <a href="/" aria-current={location.pathname === '/' ? 'page' : undefined}>
            Inicio
          </a>
        </li>
        <li>
          <a href="/cuenta">Cuenta</a>
        </li>
      </ul>
    </nav>
  );
}

// Skip link para navegar directamente al contenido
export function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Saltar al contenido principal
    </a>
  );
}
```

### 4. Contenido Accesible

```tsx
// ✅ Buen ejemplo
export function AccessibleContent() {
  return (
    <article>
      <h1>Título del Artículo</h1>
      <p>
        Este es un párrafo de texto. <a href="/more">Leer más sobre el tema</a>.
      </p>
      <figure>
        <img src="image.jpg" alt="Descripción de la imagen" />
        <figcaption>Descripción detallada de la imagen</figcaption>
      </figure>
    </article>
  );
}
```

## Solución de Problemas

### Error: "No browser found"

```bash
# Instalar navegadores Playwright
pnpm --filter @ruum/app-conductor exec playwright install
```

### Error: "Server not running"

```bash
# Iniciar servidor de desarrollo
pnpm dev

# En otra terminal, ejecutar auditorías
pnpm audit:a11y
```

### Error: "Lighthouse score below 95"

1. Revisar el reporte de Lighthouse
2. Corregir los problemas de accesibilidad
3. Optimizar contraste de colores
4. Asegurar estructura semántica

### Error: "Axe violations found"

1. Leer el reporte de violaciones
2. Corregir cada violación según el tipo
3. Verificar con `pnpm test:axe`

## Recursos Adicionales

- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/WCAG22/quickref/)
- [Axe Core Documentation](https://dequeuniversity.com/devtools/axe-core)
- [Lighthouse Accessibility](https://developer.chrome.com/docs/lighthouse/accessibility/)
- [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [Storybook Accessibility Addon](https://storybook.js.org/addons/@storybook/addon-a11y)
- [ESLint jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)

## Contacto

Para preguntas sobre accesibilidad, contactar al equipo de QA.
