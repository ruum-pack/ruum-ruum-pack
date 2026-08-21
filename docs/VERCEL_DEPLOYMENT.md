# Deployment a Vercel

Este documento explica cómo configurar el deployment de Ruum en Vercel.

## Variables de Entorno Requeridas

Vercel requiere que las siguientes variables de entorno estén configuradas en el dashboard o heredadas desde la configuración del repositorio.

### Para `app-conductor` (Producción)
- `NEXT_PUBLIC_SUPABASE_URL` - URL del proyecto Supabase (ej: `https://xxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Clave anónima de Supabase
- `NEXT_PUBLIC_APP_URL` - URL base de la aplicación (ej: `https://conductor.ruum.mx`)
- `NEXT_PUBLIC_APP_VERSION` - Versión SemVer (ej: `1.0.0`) - **Se carga automáticamente desde `config/app-version.json`**
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` - Token público de Mapbox (debe comenzar con `pk.`)

### Para `app-usuario` (Producción)
- `NEXT_PUBLIC_SUPABASE_URL` - URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Clave anónima de Supabase
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` - Token público de Mapbox

### Para `panel-admin` (Producción)
- `NEXT_PUBLIC_SUPABASE_URL` - URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Clave anónima de Supabase

## Pasos de Configuración en Vercel

### 1. Conectar Repositorio
```bash
vercel link
```

### 2. Configurar Variables de Entorno

#### Opción A: Dashboard de Vercel (Recomendado)
1. Abre [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega cada variable requerida:
   - `NEXT_PUBLIC_SUPABASE_URL` (Production)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production)
   - `NEXT_PUBLIC_APP_URL` (Production)
   - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (Production)

#### Opción B: Usando Vercel CLI
```bash
# Production
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_APP_URL
vercel env add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

# Verificar variables configuradas
vercel env ls
```

### 3. Desplegar
```bash
# Build local para pruebas
pnpm build

# Deploy a Vercel
vercel --prod
```

## Carga Automática de Variables

### NEXT_PUBLIC_APP_VERSION
Se carga automáticamente desde `config/app-version.json` durante el build:
- No es necesario configurarla en Vercel
- Se actualiza automáticamente cuando cambias `config/app-version.json`

### En Preview/Development
En ambientes que no sean producción, el script de validación:
- Genera valores dummy para variables faltantes
- Permite hacer deploy de preview aunque falten variables reales
- Útil para testing de cambios antes de producción

## Actualizar la Versión de la App

1. Edita `config/app-version.json`:
   ```json
   {
     "version": "1.0.1",
     "versionCode": 10001,
     "minimumSupported": "1.0.0"
   }
   ```

2. Commit y push:
   ```bash
   git add config/app-version.json
   git commit -m "chore: update app version to 1.0.1"
   git push
   ```

3. Vercel automáticamente detectará la nueva versión en el próximo build

## Validación del Build

El script `scripts/validate-env.mjs` ejecuta validaciones:

### En Desarrollo/Preview
✅ Permite construir sin todas las variables
✅ Usa valores dummy si faltan variables

### En Producción
❌ Requiere TODAS las variables
❌ Valida que URLs usen HTTPS
❌ Valida que versión sea SemVer válida
❌ Rechaza versión "0.0.1" o "ci" en producción

## Solucionar Problemas

### Error: "faltan variables: NEXT_PUBLIC_APP_VERSION"
**Solución:** Verifica que `config/app-version.json` existe y es válido

### Error: "NEXT_PUBLIC_SUPABASE_URL debe usar https://"
**Solución:** Asegúrate de usar la URL completa: `https://project.supabase.co`

### Error: "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN debe empezar con pk."
**Solución:** Usa tu token público de Mapbox (no el token secreto)

### Error: "NEXT_PUBLIC_APP_VERSION no puede ser 0.0.1/ci en producción"
**Solución:** Actualiza `config/app-version.json` a una versión real (ej: 1.0.0)

## Referencias
- [Documentación de Vercel - Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Supabase - API Keys](https://supabase.com/docs/guides/api#api-url-and-keys)
- [Mapbox - Getting Started](https://docs.mapbox.com/mapbox-js/guides/install/)

