# Checklist inmediato para visto bueno

La liberación externa permanece en **NO-GO** hasta que todos los puntos obligatorios tengan evidencia verificable.

| Orden | Acción | Evidencia mínima | Estado inicial |
|---:|---|---|---|
| 1 | Corregir `sprint-close-p0-static.test.mjs` | Ejecución PASS en CI | Implementado |
| 2 | Build, typecheck, lint, Vitest y Playwright | URL del workflow y artefactos | Automatizado en CI; pendiente corrida verde |
| 3 | Construir APK firmada con Firebase real | APK, SHA-256, versionCode y log Gradle | Pendiente infraestructura real |
| 4 | Ruta física de 60 minutos | Video/log, métricas y comparación de puntos | Pendiente dispositivo |
| 5 | Matriz push completa | Evidencia abierta/background/cerrada/reinicio | Pendiente Firebase/dispositivo |
| 6 | TalkBack | Matriz firmada y defectos | Pendiente dispositivo |
| 7 | Batería Galaxy A14 | Battery Historian/capturas y porcentaje/hora | Pendiente Galaxy A14 |
| 8 | Logout con pendientes | Logs de bloqueo, sincronización y force logout autorizado | Pendiente ejecución física/integrada |
| 9 | Instalación de rollback | Video/log de actualización a build de rollback | Pendiente APK firmadas |
| 10 | Adjuntar evidencias | Carpeta de release con hashes y manifiesto | Pendiente pruebas |
| 11 | Resolver defectos P0/P1 | Tickets cerrados y regresión verde | Pendiente resultados |
| 12 | Firmar acta GO/NO-GO | Acta con nombres, fecha, decisión y firmas | Pendiente responsables |

## Regla de decisión

- **NO-GO:** cualquier P0 abierto, pérdida de evidencia/telemetría, tracking interrumpido, rollback fallido, push crítico fallido o bloqueo grave de accesibilidad.
- **GO condicionado:** sólo defectos P2 documentados, con mitigación, propietario y fecha comprometida.
- **GO:** CI verde, pruebas físicas aprobadas, rollback validado, evidencias completas y acta firmada.

## Carpeta de evidencia esperada

```text
release-evidence/<version>/
  manifest.json
  apk/
  ci/
  route-60m/
  push-matrix/
  talkback/
  battery-galaxy-a14/
  logout-pending/
  rollback/
  defects/
  acta-go-no-go.pdf
```

`manifest.json` debe registrar versión, versionCode, commit, ambiente, fecha, responsable y SHA-256 de cada archivo adjunto.
