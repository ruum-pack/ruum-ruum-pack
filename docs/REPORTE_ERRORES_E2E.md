# 📋 REPORTE: Errores que Impiden Declarar E2E para Flujo de Oportunidades y Traslados

**Fecha:** 2026-08-16  
**Aplicación:** app-conductor (Next.js)  
**Componentes:** Flujo de oportunidades (`/viajes?vista=disponibles`), lista de traslados (`/viajes`), ciclo de vida del traslado

---

## 🔴 Resumen Ejecutivo

Existen **5 errores críticos** que impiden ejecutar y declarar como exitosos los tests E2E:

| # | Severidad | Tipo | Descripción | Estado |
|---|-----------|------|-------------|--------|
| 1 | 🔴 CRÍTICO | Configuración | Variables de entorno E2E no definidas | Bloquea global-setup |
| 2 | 🔴 CRÍTICO | Cobertura | No hay tests E2E para flujo de oportunidades | Cobertura 0% |
| 3 | 🔴 CRÍTICO | Cobertura | No hay tests E2E para aceptar viaje | Cobertura 0% |
| 4 | 🔴 CRÍTICO | Cobertura | No hay tests E2E para lista de traslados | Cobertura 0% |
| 5 | 🔴 CRÍTICO | Cobertura | No hay tests E2E de ciclo vida completo | Cobertura 0% |

---

## ❌ ERROR 1: Variables de Entorno Bloqueantes

### Síntoma
```
Error: Falta configurar una variable de entorno para E2E: 
PLAYWRIGHT_E2E_CONDUCTOR_EMAIL o E2E_CONDUCTOR_EMAIL
```

**Ubicación:** [apps/app-conductor/tests/global-setup.ts](apps/app-conductor/tests/global-setup.ts#L22)

### Causa Raíz
El archivo `global-setup.ts` requiere credenciales de E2E para preparar los fixtures (usuarios, datos de prueba), pero **no están definidas en ningún lado**:
- ❌ No están en `.env.example`
- ❌ No hay script de setup
- ❌ No hay documentación

### Variables Requeridas
```bash
# OBLIGATORIAS (al menos una de cada par)
PLAYWRIGHT_E2E_CONDUCTOR_EMAIL=conductor-e2e@ruumruum.test
PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD=your-e2e-password-here
PLAYWRIGHT_SUPABASE_URL=https://tu-proyecto.supabase.co
PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

# O alternativas (fallback automático):
E2E_CONDUCTOR_EMAIL=...
E2E_CONDUCTOR_PASSWORD=...
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Impacto
🔴 **CRÍTICO:** Sin estas variables, `playwright test` falla **antes de ejecutar cualquier test**.

### Solución Recomendada
**Corto plazo:** Agregar ejemplo en `.env.example`:
```bash
# Credenciales para pruebas E2E (Playwright)
# Formato: email de un usuario real que será creado o actualizado en Supabase
PLAYWRIGHT_E2E_CONDUCTOR_EMAIL=
PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD=

# Clave de admin de Supabase (para preparar fixtures)
PLAYWRIGHT_SUPABASE_URL=
PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY=
```

**Largo plazo:** Crear script `scripts/setup-e2e.mjs` que:
1. Solicite credenciales Supabase al usuario
2. Valide acceso a Supabase
3. Genere/actualice `.env.local` con variables E2E

---

## ❌ ERROR 2: Sin Tests de Flujo de Oportunidades

### Síntoma
No existe cobertura E2E para: **Ver lista de viajes disponibles → Filtrar → Expandir detalles**

**Ubicación:** [apps/app-conductor/tests/e2e/sprint-c5-critical-flows.spec.ts](apps/app-conductor/tests/e2e/sprint-c5-critical-flows.spec.ts#L9)

### Qué Existe Ahora
```typescript
test("oportunidades: sin violaciones estructurales básicas", async ({ page }) => {
  await page.goto("/viajes");
  await expect(page.locator("main")).toBeVisible();
  // ❌ Solo verifica que la página carga, sin navigación a "disponibles"
});
```

**Problema:** 
- ✅ Verifica que `/viajes` carga sin errores
- ❌ NO navega a `/viajes?vista=disponibles`
- ❌ NO lista viajes disponibles
- ❌ NO verifica calendario de ofertas
- ❌ NO expande detalles de un traslado

### Casos Faltantes
1. **Navegar a vista disponibles**
   - `page.goto("/viajes?vista=disponibles")`
   - Verificar que aparece la lista de ofertas

2. **Listar traslados disponibles**
   - Verificar que aparecen las tarjetas de traslados
   - Verificar que se muestra ganancia, origen, destino
   - Verificar que se muestra "DISPONIBLE" badge

3. **Expandir detalles de traslado**
   - Click en tarjeta de traslado
   - Verificar que aparece: dirección recolección, entrega, duración, distancia
   - Verificar que hay botón "Ver completo"

4. **Filtrar por calendario**
   - Cambiar día en el calendario
   - Verificar que se actualiza la lista
   - Verificar contador de traslados: "3 Traslados" o "1 Traslado"

5. **Estados vacíos**
   - Si no hay traslados disponibles ese día
   - Verificar mensaje: "Sin oportunidades nuevas. Te avisaremos..."
   - Verificar sugerencia de "Revisa otros días"

### Impacto
🔴 **CRÍTICO:** 0% de cobertura en el flujo más importante de app-conductor. No se puede declarar que funciona el mercado de oportunidades.

### Solución
Crear test `test("Flujo de oportunidades: ver y filtrar viajes disponibles")`:
```typescript
test("Flujo de oportunidades: listar, expandir y ver detalles", async ({ page }) => {
  // 1. Navegar a disponibles
  await page.goto("/viajes?vista=disponibles");
  
  // 2. Verificar que aparecen traslados
  const tarjetas = page.locator('[role="button"]').filter({ hasText: /DISPONIBLE|Traslado #/ });
  await expect(tarjetas).toHaveCount(1); // Fixture prepara 1 disponible
  
  // 3. Verificar contenido
  await expect(page.getByText(/\$1,450|1,450 MXN/)).toBeVisible(); // Ganancia
  await expect(page.getByText(/Plaza de la Constitución|CDMX/)).toBeVisible();
  
  // 4. Expandir detalles
  await page.getByRole("button", { name: /Ver detalles|Detalles/i }).click();
  await expect(page.getByText(/Recolección|Entrega/)).toBeVisible();
  
  // 5. Ver completo
  await page.getByRole("link", { name: /Ver completo/i }).click();
  await expect(page).toHaveURL(/\/viajes\/[a-f0-9-]+/);
});
```

---

## ❌ ERROR 3: Sin Tests de Aceptar Viaje

### Síntoma
No existe cobertura E2E para: **Aceptar un viaje disponible**

**Ubicación:** No existe el test

### Qué Falta
1. **Navegación a detalles del traslado**
   - Desde `/viajes?vista=disponibles` → Click en traslado → `/viajes/[id]`
   - Verificar que carga `TripOpportunityDetails` component

2. **Mostrar información completa**
   - Ganancia conductor
   - Origen y destino con direcciones completas
   - Fechas, horarios, distancia
   - Requisitos especiales (si aplica)
   - Información de contacto origen/destino

3. **Aceptar el traslado**
   - Click en botón "Aceptar" o "Aceptar traslado"
   - Verificar que se ejecuta `aceptarViaje()` RPC
   - Verificar respuesta exitosa

4. **Validaciones post-aceptación**
   - Traslado desaparece de `/viajes?vista=disponibles`
   - Traslado aparece en `/viajes` (mis viajes)
   - Se muestra mensaje de éxito: "Traslado aceptado exitosamente"
   - Se redirige a `/viajes` o `/viajes/[id]`

5. **Casos de error**
   - Aceptar sin estar autenticado → Redirige a `/login`
   - Aceptar con documentos incompletos → Muestra error
   - Otro conductor lo aceptó antes → Error de conflicto
   - Error de red → Reintentar o mostrar aviso

### Impacto
🔴 **CRÍTICO:** No se valida que el conductor pueda **aceptar oportunidades**, que es la acción core de app-conductor.

### Solución
Crear test `test("Aceptar un viaje disponible")`:
```typescript
test("Aceptar un viaje disponible", async ({ page }) => {
  // 1. Navegar a disponibles con fixture
  await page.goto("/viajes?vista=disponibles");
  
  // 2. Ir a detalles del traslado disponible
  await page.getByRole("link", { name: /Ver detalles|Ver completo/ }).click();
  await expect(page).toHaveURL(/\/viajes\/[a-f0-9-]+/);
  
  // 3. Verificar información
  await expect(page.getByText(/\$1,450|Plaza de la Constitución/)).toBeVisible();
  
  // 4. Aceptar
  await page.getByRole("button", { name: /Aceptar|Aceptar traslado/i }).click();
  
  // 5. Verificar éxito
  await expect(page.getByText(/Traslado aceptado/i)).toBeVisible();
  
  // 6. Verificar que no vuelve a disponibles
  await page.goto("/viajes?vista=disponibles");
  await expect(page.getByText(/Sin oportunidades|Te avisaremos/i)).toBeVisible();
});
```

---

## ❌ ERROR 4: Sin Tests de Lista de Traslados Asignados

### Síntoma
No existe cobertura E2E para: **Ver lista de mis traslados (aceptados, en curso, por cerrar)**

**Ubicación:** No existe el test

### Qué Falta
1. **Navegar a "mis viajes"**
   - URL: `/viajes` (sin filtro de vista)
   - O: `/viajes?vista=mis-viajes`
   - Verificar que es la pestaña por defecto

2. **Listar traslados del conductor**
   - Mostrar traslados con estado: conductor_asignado, traslado_en_curso, evidencia_inicial_en_proceso, etc.
   - Cada tarjeta debe mostrar:
     - Folio del traslado
     - Origen - Destino
     - Estado: "ACEPTADO", "EN CURSO", "POR CERRAR"
     - Ganancia estimada
     - Duración, distancia

3. **Agrupar por estado**
   - `en-curso`: Traslados siendo operados en este momento
   - `proximos`: Traslados aceptados pero no iniciados
   - `por-cerrar`: Traslados completados que necesitan cierre/comprobante

4. **Expandir y ver acciones**
   - Botón "Abrir traslado" → Navega a `/viajes/[id]`
   - Botón "Contacto" → Muestra info de contacto origen/destino
   - Botón "Problema" → Reportar incidencia
   - Botón "Emergencia" → Abrir panel de emergencia (en traslado en curso)

5. **Estados vacíos**
   - Si no hay traslados en ese grupo → Mensaje: "Sin traslados..."

### Casos de Uso
- Conductor ve sus 3 traslados del día
- Clickea en uno "EN CURSO" → Ve detalles, ubicación, siguiente paso
- Clickea "Ver completo" → Va a `/viajes/[id]` para acciones
- Puede ver contactos, reportar problema, emergencia desde allí

### Impacto
🔴 **CRÍTICO:** No se valida que el conductor pueda **ver y gestionar** sus traslados asignados.

### Solución
Crear test `test("Lista de traslados asignados")`:
```typescript
test("Listar y abrir traslado asignado", async ({ page }) => {
  // 1. Navegar a mis viajes
  await page.goto("/viajes");
  
  // 2. Verificar traslado en estado evidencia_inicial_en_proceso
  await expect(page.getByText(/Traslado #/)).toBeVisible();
  await expect(page.getByText(/EN CURSO|En proceso/i)).toBeVisible();
  
  // 3. Abrir traslado
  await page.getByRole("link", { name: /Abrir|Iniciar traslado/i }).click();
  
  // 4. Verificar detalles
  await expect(page).toHaveURL(/\/viajes\/[a-f0-9-]+/);
  await expect(page.getByText(/Dirígete|Contacto|Problema/)).toBeVisible();
});
```

---

## ❌ ERROR 5: Sin Tests del Ciclo de Vida Completo

### Síntoma
No existe cobertura E2E end-to-end que valide todo el flujo de un traslado desde inicio hasta fin.

**Ubicación:** No existe el test

### Estados del Traslado a Validar
```
1. pendiente_de_conductor
   ↓ (Conductor acepta desde /viajes?vista=disponibles)
2. conductor_asignado
   ↓ (Conductor inicia ruta)
3. conductor_en_camino_al_origen
   ↓ (Conductor confirma llegada)
4. conductor_en_punto_de_recoleccion
   ↓ (Conductor confirma contacto)
5. verificacion_vehiculo_en_proceso
   ↓ (Conductor inspecciona)
6. evidencia_inicial_en_proceso ← START: Fixture prepara aquí
   ↓ (Conductor captura fotos)
7. evidencia_inicial_completada
   ↓ (Conductor confirma recepción)
8. vehiculo_recibido
   ↓ (Conductor inicia traslado)
9. traslado_en_curso
   ↓ (Conductor confirma llegada a destino)
10. llegada_a_destino
   ↓ (Conductor inicia registro final)
11. evidencia_final_en_proceso ← Fixture también puede preparar aquí
   ↓ (Conductor captura fotos finales)
12. evidencia_final_completada
   ↓ (Conductor confirma entrega)
13. entrega_confirmada
   ↓ (Sistema genera pago)
14. pago_pendiente → pago_completado
   ↓
15. servicio_cerrado ✅ FIN
```

### Casos Faltantes de Tests

**Caso 1: Desde aceptación hasta evidencia inicial**
- Verificar que traslado pasa por: `conductor_asignado` → ... → `evidencia_inicial_en_proceso`
- Validar que cada transición muestra la acción esperada en UI

**Caso 2: Captura de evidencia inicial**
- Click en "Capturar evidencia inicial"
- App abre cámara
- Captura múltiples fotos (frente, laterales, atrás)
- Verifica cantidad de fotos requeridas
- Botón "Confirmar recepción" se habilita

**Caso 3: Iniciar traslado**
- Click en "Iniciar traslado"
- Estado cambia a `traslado_en_curso`
- Se habilita tracking en tiempo real
- Mostradores de distancia/tiempo
- Botones de emergencia disponibles

**Caso 4: Completar traslado**
- Llegar a destino → "Confirmar llegada"
- Estado → `llegada_a_destino` / `evidencia_final_en_proceso`
- Capturar evidencia final
- Confirmar entrega → `entrega_confirmada`

**Caso 5: Cierre y pago**
- Verificar que traslado aparece en `/ganancias`
- Estado económico: `sin_calcular` → `confirmado` → `pagado`
- Aparece en historial: `/viajes?vista=historial`

### Impacto
🔴 **CRÍTICO:** No se valida que funciona la **cadena de valor completa** del servicio. Sin esto, no se puede garantizar que un conductor puede completar un traslado de principio a fin.

### Solución
Crear test largo `test("Ciclo de vida completo: aceptar traslado hasta cierre")`:
```typescript
test("Ciclo de vida completo del traslado", async ({ page, context }) => {
  // Este test es largo (~5-10 min) y prueba todo el flujo
  // Utiliza dos traslados fixture:
  // - e204: para aceptar (estado: pendiente_de_conductor)
  // - e205: para continuar desde evidencia inicial
  
  // Parte 1: Aceptar traslado
  // Parte 2: Navegar al punto de recolección
  // Parte 3: Capturar evidencia inicial
  // Parte 4: Iniciar traslado
  // Parte 5: Llegar a destino
  // Parte 6: Capturar evidencia final
  // Parte 7: Confirmar cierre
  // Parte 8: Verificar en ganancias
});
```

---

## 📊 Tabla de Errores vs Soluciones

| # | Error | Archivo | Línea | Tipo | Severidad | Solución |
|---|-------|---------|-------|------|-----------|----------|
| 1 | Variables E2E no definidas | global-setup.ts | 22 | Config | 🔴 CRÍTICO | Agregar a `.env.example` |
| 2 | No hay tests de oportunidades | sprint-c5-critical-flows.spec.ts | 9-11 | Cobertura | 🔴 CRÍTICO | Crear test ~30 líneas |
| 3 | No hay tests de aceptar viaje | (no existe) | - | Cobertura | 🔴 CRÍTICO | Crear test ~40 líneas |
| 4 | No hay tests de lista de traslados | (no existe) | - | Cobertura | 🔴 CRÍTICO | Crear test ~30 líneas |
| 5 | No hay tests de ciclo de vida | (no existe) | - | Cobertura | 🔴 CRÍTICO | Crear test ~100+ líneas |

---

## 🔧 Plan de Remediación

### Fase 1: Setup Inicial (30 min)
- [ ] Actualizar `.env.example` con variables E2E
- [ ] Crear script `scripts/setup-e2e.sh` o `.mjs` para configurar credenciales
- [ ] Documentar en `README.md` cómo ejecutar tests E2E

### Fase 2: Tests Básicos (4-6 horas)
- [ ] Crear test de flujo de oportunidades (40 líneas)
- [ ] Crear test de aceptar viaje (50 líneas)
- [ ] Crear test de lista de traslados (35 líneas)
- [ ] Ejecutar y validar que pasan

### Fase 3: Tests Avanzados (6-10 horas)
- [ ] Crear test de ciclo de vida completo (100+ líneas)
- [ ] Mockear transiciones de estado si es necesario
- [ ] Considerar usar `test.step()` para debug

### Fase 4: CI/CD Integration (2 horas)
- [ ] Agregar paso de `playwright test` a `.github/workflows/ci.yml`
- [ ] Configurar artifacts de reporte HTML
- [ ] Documentar fallos y retry logic

---

## 📝 Documentación Recomendada

Crear archivo [tests/E2E_GUIDE.md](tests/E2E_GUIDE.md):
```markdown
# Guía de Tests E2E - App Conductor

## Setup
1. Copiar variables del `.env.example`
2. Ejecutar `scripts/setup-e2e.mjs`
3. Verificar `.env.local` tiene credenciales

## Ejecutar tests
```bash
pnpm exec playwright test tests/e2e/
```

## Flujos cubiertos
- ✅ Oportunidades (viajes disponibles)
- ✅ Aceptar viaje
- ✅ Lista de traslados
- ✅ Ciclo de vida completo
```

---

## 📞 Contacto & Escalada

**Responsable:** QA / Automation  
**Prioridad:** P0 - Bloquea release  
**Timeline:** Completar en Sprint C5  

---

## Apéndice A: UUIDs de Fixtures E2E

```typescript
export const E2E_CONDUCTOR_ID = "00000000-0000-4000-8000-00000000e201";
export const E2E_OWNER_ID = "00000000-0000-4000-8000-00000000e202";
export const E2E_VEHICLE_ID = "00000000-0000-4000-8000-00000000e203";
export const E2E_AVAILABLE_TRIP_ID = "00000000-0000-4000-8000-00000000e204";
export const E2E_ACTIVE_TRIP_ID = "00000000-0000-4000-8000-00000000e205";
export const E2E_PAYOUT_ID = "00000000-0000-4000-8000-00000000e206";
```

**Traslados disponibles:**
- `e204`: Estado `pendiente_de_conductor` (aceptable)
- `e205`: Estado `evidencia_inicial_en_proceso` (activo, asignado a conductor E2E)

---

**Fin del reporte**
