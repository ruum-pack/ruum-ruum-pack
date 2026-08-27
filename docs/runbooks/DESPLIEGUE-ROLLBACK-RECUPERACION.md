# Runbook: Despliegue, Rollback y Recuperación — Panel Admin

## 1. Despliegue

### Prerrequisitos
- Node.js >= 24, pnpm 10, Docker (opcional para Supabase local)
- Acceso a: Supabase project, variables de entorno, Stripe dashboard
- CI verde: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

### Pasos

```bash
# 1. Sincronizar rama
git checkout main
git pull origin main

# 2. Instalar dependencias (lockfile congelado)
pnpm install --frozen-lockfile

# 3. Regenerar tipos Supabase (si hay migraciones nuevas)
pnpm db:types

# 4. Validar entorno
pnpm validate:env panel-admin

# 5. Typecheck, lint, test
pnpm typecheck --filter=@ruum/panel-admin
pnpm lint --filter=@ruum/panel-admin
pnpm test --filter=@ruum/panel-admin

# 6. Construir
pnpm build --filter=@ruum/panel-admin

# 7. Desplegar (Vercel / Docker)
# Vercel:
vercel --prod

# Docker:
docker build -t ruum-panel-admin:latest .
docker push registry.ruum.com/panel-admin:latest
```

### Post-despliegue
1. Verificar health endpoint: `GET /api/observabilidad`
2. Verificar readiness: `GET /api/observabilidad?check=readiness`
3. Ejecutar pruebas de humo: `pnpm test:smoke`
4. Verificar health completo: `GET /api/observabilidad?check=full`

---

## 2. Rollback

### Rollback de Vercel
```bash
vercel rollback --scope ruum
# O desde dashboard: Deployments → ⋮ → Rollback to Stable
```

### Rollback de Docker
```bash
docker pull registry.ruum.com/panel-admin:anterior
docker stop ruum-panel-admin
docker run -d --name ruum-panel-admin \
  -p 3002:3002 \
  --env-file .env.production \
  registry.ruum.com/panel-admin:anterior
```

### Rollback de Base de Datos (Supabase)
```bash
# Si la migración se ejecutó sola:
supabase db diff --linked
supabase db pull

# Restaurar desde backup
supabase db dump --linked -f backup_pre_release.sql
psql "$SUPABASE_DB_URL" -f backup_pre_release.sql
```

### Criterios de Rollback
| Indicador | Acción |
|-----------|--------|
| Health check falla (>30s) | Rollback inmediato |
| Error rate > 1% | Rollback inmediato |
| p95 latency > 1500ms | Rollback tras 5 min |
| Violación de datos | Rollback + restauración DB |

---

## 3. Recuperación ante Incidentes

### Incidente: Health check caído
1. `curl -f http://panel-admin/api/observabilidad || echo "LIVENESS FAIL"`
2. Revisar logs: `docker logs ruum-panel-admin --tail 100`
3. Verificar variables de entorno: `docker exec ruum-panel-admin env`
4. Verificar conectividad Supabase: `curl -I $NEXT_PUBLIC_SUPABASE_URL`
5. Si es error de migración: ejecutar rollback de DB

### Incidente: Fuga de datos sensibles
1. Desconectar servicio: `docker stop ruum-panel-admin`
2. Rotar todas las claves en Supabase Dashboard
3. Rotar STRIPE_WEBHOOK_SECRET
4. Rotar RESEND_API_KEY
5. Actualizar .env.production con nuevas claves
6. Re-desplegar

### Incidente: Violación RLS
1. Ejecutar: `supabase db dump --linked -f rls_dump.sql`
2. Revisar políticas: `SELECT * FROM pg_policies WHERE tablename = 'tabla_afectada'`
3. Aplicar hotfix: `supabase db push`
4. Verificar: ejecutar pruebas SQL de RLS

### Incidente: Corrupción de datos por concurrencia
1. Identificar versión afectada: `SELECT * FROM version_history ORDER BY created_at DESC LIMIT 10`
2. Reconstruir desde auditoría: `SELECT * FROM registro_auditoria WHERE traslado_id = ?`
3. Aplicar corrección vía RPC transaccional

---

## 4. Monitoreo Continuo

### Alertas configuradas
| Alerta | Umbral | Canal |
|--------|--------|-------|
| Health check liveness | 3 fallos consecutivos | Slack + Email |
| Error rate HTTP 5xx | > 1% en 5 min | Slack |
| Latencia p99 | > 1500ms en 1 min | Slack |
| Violaciones RLS detectadas | Cualquiera | PagerDuty |
| Secretos en código | Cualquiera | Slack #security |

### Dashboard de Observabilidad
- `GET /api/observabilidad` → Liveness
- `GET /api/observabilidad?check=readiness` → Readiness (Supabase + RPC)
- `GET /api/observabilidad?check=full` → Full health (versión, host, Supabase, DB, RPC)

### Trazabilidad
Cada solicitud HTTP incluye `x-request-id` para rastrear:
- UI → API → Auditoría → RPC
- Los eventos de auditoría incluyen `trace_id` en el campo `datos`
