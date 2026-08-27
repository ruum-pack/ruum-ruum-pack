# Sprint C5 — Despliegue gradual y rollback

## Canales
1. Interno: equipo y dispositivos controlados; 100% de logs observables.
2. Piloto pequeño: 5–10 conductores, feature flags al 10%.
3. Piloto ampliado: 25–50 conductores, rollout 25–50%.
4. Producción gradual: 75% y después 100%, nunca en un solo salto.

## Gates
- Sin regresiones P0/P1 en viaje, evidencia, tracking, push o pagos.
- Crash-free sessions >= 99.5% durante el piloto.
- RPC failure y evidencia atascada sin incremento material frente a la versión anterior.
- Prueba TalkBack y ruta física firmadas.

## Rollback
1. Desactivar la funcionalidad afectada en `feature_flags_app`.
2. Fijar `version_recomendada` a la versión estable anterior.
3. No reducir `version_minima` si el backend ya es incompatible; desplegar primero compatibilidad backend.
4. Detener rollout de tienda/canal MDM.
5. Restaurar Edge Functions/RPC desde el tag estable.
6. Registrar incidente, alcance, versión, métrica detonante y hora de recuperación.

## Cambios mínimos por release
Versión, commit/tag, migraciones, flags, compatibilidad backend, riesgos, responsable, canal, fecha y procedimiento de reversión.
