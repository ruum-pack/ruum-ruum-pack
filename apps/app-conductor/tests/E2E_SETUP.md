# 🧪 Guía de Tests E2E (Playwright) - App Conductor

Tests end-to-end que validan los flujos críticos de la aplicación conductor:
- ✅ Flujo de oportunidades (viajes disponibles)
- ✅ Aceptar un viaje
- ✅ Lista de traslados asignados
- ✅ Ciclo de vida completo del traslado
- ✅ Recuperación de contraseña
- ✅ Seguridad y controles de UI

---

## 📋 Requisitos Previos

1. **Node.js & pnpm**: Instalados
2. **Variables de entorno**: Configuradas en `.env.local`
3. **Servidor de desarrollo**: Corriendo en `http://localhost:3001`
4. **Base de datos Supabase**: Acceso de lectura/escritura con `service_role`

---

## 🔧 Configuración Inicial

### Opción 1: Script de Setup (Recomendado)

Ejecutar el script interactivo:

```bash
cd apps/app-conductor
node scripts/setup-e2e.mjs
```

El script te guiará a través de:
1. Email del conductor E2E (prueba)
2. Contraseña del conductor E2E
3. URL de Supabase
4. Service Role Key de Supabase

### Opción 2: Configuración Manual

Copiar variables a `.env.local`:

```bash
cd apps/app-conductor
cp .env.example .env.local
```

Editar `.env.local` y agregar:

```bash
# Credenciales del conductor E2E
PLAYWRIGHT_E2E_CONDUCTOR_EMAIL=conductor-e2e@ruumruum.test
PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD=your-e2e-password-here

# Acceso a Supabase
PLAYWRIGHT_SUPABASE_URL=https://tu-proyecto.supabase.co
PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
```

---

## ▶️ Ejecutar Tests E2E

### Todos los tests

```bash
cd apps/app-conductor
pnpm exec playwright test tests/e2e/
```

### Test específico

```bash
# Flujo de oportunidades
pnpm exec playwright test tests/e2e/sprint-c5-critical-flows.spec.ts -g "Flujo de Oportunidades"

# Aceptar viaje
pnpm exec playwright test tests/e2e/sprint-c5-critical-flows.spec.ts -g "Aceptar Viaje"

# Lista de traslados
pnpm exec playwright test tests/e2e/sprint-c5-critical-flows.spec.ts -g "Lista de Traslados"

# Ciclo de vida completo
pnpm exec playwright test tests/e2e/sprint-c5-critical-flows.spec.ts -g "Ciclo de Vida"
```

### Modo watch (desarrollo)

```bash
pnpm exec playwright test --watch
```

### Modo UI (debug interactivo)

```bash
pnpm exec playwright test --ui
```

### Un navegador específico

```bash
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=firefox
pnpm exec playwright test --project=webkit
```

---

## 📊 Ver Resultados

### Reporte HTML

```bash
pnpm exec playwright show-report
```

Se abrirá un navegador con el reporte completo incluyendo:
- Screenshots de fallos
- Videos de ejecución
- Trazas detalladas

### Último reporte generado

```bash
open playwright-report/index.html  # macOS
xdg-open playwright-report/index.html  # Linux
start playwright-report/index.html  # Windows
```

---

## 🔍 Debugging

### Ver logs detallados

```bash
DEBUG=pw:api pnpm exec playwright test
```

### Modo headed (ver navegador)

```bash
pnpm exec playwright test --headed
```

### Pausar en un punto

Agregar `await page.pause()` en el test para pausar ejecución.

### Capturar screenshots

```bash
pnpm exec playwright test --screenshot=only-on-failure
```

---

## ✅ Casos Cubiertos

### 1. Flujo de Oportunidades
- [x] Navegar a `/viajes?vista=disponibles`
- [x] Listar traslados disponibles
- [x] Expandir detalles de traslado
- [x] Filtrar por día del calendario
- [x] Mostrar mensaje si no hay oportunidades

### 2. Aceptar Un Viaje
- [x] Ir a detalles del traslado disponible
- [x] Verificar información (ganancia, origen, destino)
- [x] Click en "Aceptar traslado"
- [x] Validar transición de estado
- [x] Traslado desaparece de disponibles

### 3. Lista de Traslados Asignados
- [x] Navegar a `/viajes` (mis traslados)
- [x] Listar traslados agrupados por estado
- [x] Ver badge de estado (EN CURSO, PRÓXIMO, POR CERRAR)
- [x] Abrir detalles de un traslado
- [x] Acceder a contacto y opciones de ayuda

### 4. Ciclo de Vida Completo
- [x] Validar progresión de estados
- [x] Mostrar etapa actual del traslado
- [x] Visualizar acciones disponibles según estado
- [x] Ver pagos en ganancias después de cierre
- [x] Traslado cerrado aparece en historial

### 5. Seguridad y UX
- [x] Recuperación de contraseña
- [x] Validación de requisitos de contraseña
- [x] Diálogo bancario con foco y Escape
- [x] Bloqueo por versión obligatoria
- [x] Sin violaciones de accesibilidad

---

## 🐛 Solución de Problemas

### Error: "Falta configurar una variable de entorno para E2E"

```bash
# Solución:
node apps/app-conductor/scripts/setup-e2e.mjs
```

### Error: "No se pudo conectar a Supabase"

Verificar:
1. URL de Supabase es correcta
2. Service Role Key es válida (no está expirada)
3. Red está disponible

```bash
# Probar manualmente:
curl https://tu-proyecto.supabase.co/rest/v1/ \
  -H "Authorization: Bearer tu-service-role-key"
```

### Tests fallan en CI/CD

Asegúrate que:
1. Variables de entorno están configuradas en GitHub Secrets
2. Server web está corriendo antes de los tests
3. Supabase staging/testing tiene datos correctos

### Timeout de tests (>30s)

Aumentar timeout en `playwright.config.ts`:

```typescript
timeout: 180_000, // 3 minutos
```

---

## 🚀 Integración en CI/CD

Agregar a `.github/workflows/ci.yml`:

```yaml
- name: Run E2E tests
  env:
    PLAYWRIGHT_E2E_CONDUCTOR_EMAIL: ${{ secrets.E2E_CONDUCTOR_EMAIL }}
    PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD: ${{ secrets.E2E_CONDUCTOR_PASSWORD }}
    PLAYWRIGHT_SUPABASE_URL: ${{ secrets.PLAYWRIGHT_SUPABASE_URL }}
    PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY }}
  run: |
    pnpm --filter @ruum/app-conductor exec playwright test tests/e2e/

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: apps/app-conductor/playwright-report/
    retention-days: 30
```

---

## 📚 Recursos Adicionales

- [Documentación de Playwright](https://playwright.dev/)
- [Playwright Config](../playwright.config.ts)
- [Global Setup](../tests/global-setup.ts) - Prepara fixtures E2E
- [Errores Identificados](../../REPORTE_ERRORES_E2E.md)

---

## 👥 Contacto

**Responsable:** QA / Automation  
**Sprint:** C5 - Endurecimiento UX y salida a producción  
**Estado:** ✅ Implementado

---

**Última actualización:** 2026-08-16
