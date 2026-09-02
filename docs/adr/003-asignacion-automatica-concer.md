# ADR 003 — Asignación automática CONCER por competencia auditable

- **Fecha:** 2026-09-02
- **Estado:** Aceptado / Implementado
- **Contexto:**
  Los traslados en `pendiente_de_conductor` se asignaban al primer conductor que ejecutaba la RPC de aceptación o mediante selección manual de Administración. Ese modelo protegía contra la doble asignación, pero no resolvía la competencia con criterios de desempeño y equidad. Además, la elegibilidad estaba duplicada entre TypeScript y PostgreSQL.

- **Decisión:**
  1. Mantener los identificadores internos `basico`, `ejecutivo`, `luxury` y `coleccion`; mostrar únicamente las etiquetas comerciales Concer 1, 2, 3 y 4.
  2. Separar capacidad y prioridad: CONCER determina qué traslados puede realizar un conductor; la eficiencia operativa determina el orden entre conductores elegibles.
  3. Abrir automáticamente una competencia al entrar un traslado en `pendiente_de_conductor`. Todos los conductores que pasen la validación central pueden solicitarlo durante una ventana breve.
  4. Resolver la competencia de forma lexicográfica: categoría de puntualidad, menor número de asignaciones en siete días, mayor tiempo desde la última asignación y desempate determinista.
  5. Considerar la ubicación únicamente como validación de viabilidad para servicios programados. No se muestra a otros conductores ni incrementa el puntaje.
  6. Calcular puntualidad con la hora programada y el evento auditable de llegada al origen. Un retraso queda provisional 72 horas; una disputa lo suspende hasta resolución. `favor_reclamante` y `solucion_parcial` descartan la ocurrencia binaria; `en_contra` la confirma.
  7. Resolver y asignar dentro de PostgreSQL con bloqueo de fila, revalidación de elegibilidad, congelación de ganancia y auditoría. La función pública solo permite solicitar; la resolución queda restringida a procesos internos.
  8. Conservar la asignación manual como contingencia para competencias sin solicitudes o excepciones operativas.

- **Consecuencias:**
  - `+` Una sola autoridad de elegibilidad para la asignación automática.
  - `+` Selección explicable, reproducible y protegida contra carreras.
  - `+` Equidad incorporada desde la primera versión.
  - `+` Las consecuencias subjetivas o disputables no se aplican antes del debido proceso.
  - `-` El conductor ya no obtiene el traslado al tocar el botón; envía una solicitud y espera el cierre de la ventana.
  - `-` La viabilidad geográfica depende de que el dispositivo comparta una ubicación reciente; la política inicial permite continuar sin ella para evitar bloquear el despliegue.
  - `-` Las certificaciones especiales deben administrarse en el nuevo catálogo operativo antes de asignar automáticamente traslados Concer 3 o 4.

- **Referencias:**
  - `packages/shared/src/rules/asignacion-traslado.ts`
  - `packages/shared/src/constants/niveles-concer.ts`
  - `packages/api/src/services/traslados.ts`
  - `supabase/migrations/20260902131724_asignacion_automatica_concer.sql`

