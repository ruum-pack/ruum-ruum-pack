# Ensayo de Migración — Staging desde Cero

## Objetivo
Reconstruir el entorno de staging completo desde cero sin intervención manual, validando que el pipeline CI y los scripts de inicialización son autosuficientes.

## Prerrequisitos
- Acceso a proyecto Supabase staging
- Acceso a GitHub Actions (CI)
- Variables de entorno configuradas en GitHub Secrets

## Procedimiento

### 1. Inicializar Base de Datos
```bash
# Clonar repositorio
git clone git@github.com:ruum/ruum.git staging-test
cd staging-test

# Instalar dependencias
pnpm install --frozen-lockfile

# Iniciar Supabase local (para validación de migraciones)
supabase start

# Reset completo de la DB local
supabase db reset

# Aplicar migraciones locales
supabase migration up

# Generar tipos
pnpm db:types
```

### 2. Validar Integridad
```bash
# Ejecutar SQL tests
supabase test db

# Regenerar y verificar tipos
git diff --exit-code packages/shared/src/types/supabase.ts || {
  echo "ERROR: Los tipos generados no coinciden con el commit."
  exit 1
}
```

### 3. Construir y Verificar
```bash
pnpm typecheck --filter=@ruum/panel-admin
pnpm lint --filter=@ruum/panel-admin
pnpm test --filter=@ruum/panel-admin
pnpm build --filter=@ruum/panel-admin
pnpm test:smoke
```

### 4. Desplegar en Staging
```bash
# Configurar remote de staging
vercel link --scope ruum --project panel-admin-staging

# Desplegar
vercel --env NEXT_PUBLIC_SUPABASE_URL=$STAGING_SUPABASE_URL \
  --env NEXT_PUBLIC_SUPABASE_ANON_KEY=$STAGING_ANON_KEY \
  --env SUPABASE_SERVICE_ROLE_KEY=$STAGING_SERVICE_ROLE_KEY

# Verificar despliegue
curl -f https://panel-admin-staging.vercel.app/api/observabilidad
curl -f "https://panel-admin-staging.vercel.app/api/observabilidad?check=readiness"
```

### 5. Smoke Tests en Staging
```bash
# Ejecutar E2E con sesión real de staging
ADMIN_STORAGE_STATE=./tests/.auth/admin-staging.json \
  pnpm exec playwright test tests/e2e/ --config=playwright.config.ts

# Ejecutar a11y
ADMIN_STORAGE_STATE=./tests/.auth/admin-staging.json \
  pnpm exec playwright test tests/a11y-real/
```

### 6. Pruebas de Carga
```bash
BASE_URL=https://panel-admin-staging.vercel.app k6 run tests/load/panel-admin-degradacion.js
```

### 7. Verificar Trazabilidad
```bash
# Verificar que una solicitud genera trace_id
curl -I https://panel-admin-staging.vercel.app/api/observabilidad \
  | grep x-request-id

# Verificar health check completo
curl -s "https://panel-admin-staging.vercel.app/api/observabilidad?check=full" \
  | jq .
```

## Criterios de Aceptación
- [ ] `pnpm install --frozen-lockfile` exitoso sin modificaciones
- [ ] `supabase db reset` + `supabase migration up` exitoso
- [ ] `pnpm db:types` no produce cambios en el árbol de trabajo
- [ ] `pnpm typecheck`, `lint`, `test`, `build` verdes
- [ ] `pnpm test:smoke` pasa en staging desplegado
- [ ] E2E con sesión real pasa en staging
- [ ] `curl /api/observabilidad?check=full` devuelve `status: "ok"`
- [ ] `x-request-id` presente en respuestas HTTP
- [ ] Pruebas de carga sin violación de umbrales
- [ ] Sin secretos hardcodeados detectados por `scan-secrets.mjs`

## Notas
- El archivo `.env.local` no debe existir durante la construcción CI (usar GitHub Secrets)
- La demo mode (`NEXT_PUBLIC_PANEL_ADMIN_DEMO`) debe estar desactivada en staging
- Stripe debe estar en modo test para staging
- Las migraciones de base de datos se ejecutan automáticamente al hacer `supabase db push`
