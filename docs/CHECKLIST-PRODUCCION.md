# Checklist de Producción — Panel Admin

## Pre-despliegue

### Código
- [ ] `pnpm typecheck --filter=@ruum/panel-admin` sin errores
- [ ] `pnpm lint --filter=@ruum/panel-admin` sin errores bloqueantes
- [ ] `pnpm test --filter=@ruum/panel-admin` verde
- [ ] `pnpm build --filter=@ruum/panel-admin` reproducible
- [ ] Sin casts `any` en módulos críticos (auditoría, aprobaciones, permisos)
- [ ] Sin secretos en código (verificado con `scripts/scan-secrets.mjs`)

### Base de Datos
- [ ] Migraciones aplicadas en staging
- [ ] `supabase db dump --linked` ejecutado (backup pre-despliegue)
- [ ] Pruebas RLS ejecutadas: `supabase test db --linked`
- [ ] Seed data verificada

### Entorno
- [ ] Variables de entorno completas en `.env.production`
- [ ] `NEXT_PUBLIC_PANEL_ADMIN_DEMO` ausente o `"false"`
- [ ] `NODE_ENV=production`
- [ ] URLs de Supabase: producción (no staging)
- [ ] Stripe keys: producción (no test, si aplica)

### Seguridad
- [ ] Service role key NO expuesta al cliente
- [ ] RLS activa en todas las tablas públicas
- [ ] Middleware bloquea acceso no administrativo
- [ ] Headers de seguridad: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`

## Post-despliegue

### Smoke Tests
- [ ] `curl -f http://panel-admin/api/observabilidad` → 200
- [ ] `curl -f "http://panel-admin/api/observabilidad?check=readiness"` → 200
- [ ] Iniciar sesión como admin
- [ ] Dashboard carga sin errores
- [ ] Viajes, pagos, auditoría accesibles
- [ ] Exportación CSV descargable

### Monitoreo
- [ ] Health check liveness pasa
- [ ] Error rate < 1%
- [ ] Latencia p95 < 800ms
- [ ] Logs sin errores inesperados

### Rollback Ready
- [ ] Último build estable etiquetado
- [ ] Backup de base de datos disponible
- [ ] Comando de rollback documentado

## Post-lanzamiento (24h)

- [ ] Sin incidentes de seguridad
- [ ] Sin quejas de usuarios reportadas
- [ ] Sin errores 5xx en logs
- [ ] Sin violaciones RLS detectadas
- [ ] Consumo de API dentro de límites de Supabase
