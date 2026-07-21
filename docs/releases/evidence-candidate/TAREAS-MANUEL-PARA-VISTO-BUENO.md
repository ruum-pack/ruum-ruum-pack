# Tareas del responsable para obtener el visto bueno

## 1. Ejecutar la CI oficial

1. Subir este candidato al repositorio Git.
2. Crear una rama `release/1.0.0` o disparar manualmente el workflow.
3. Confirmar que estén configurados los secretos de Firebase y firma Android.
4. Exigir que todos los jobs terminen en verde.
5. Descargar y conservar logs, reportes Playwright y artefactos de CI.

## 2. Congelar el candidato

Registrar:

- commit SHA definitivo;
- versión `1.0.0`;
- `versionCode 10000`;
- ambiente y URL remota;
- fecha/hora de corte;
- APK firmada exacta;
- SHA-256 publicado por CI.

No aceptar cambios de código después del congelamiento. Cualquier corrección crea un candidato nuevo y reinicia las pruebas afectadas.

## 3. Instalar exclusivamente la APK congelada

- Verificar antes de instalar que el SHA-256 local coincida con el publicado por CI.
- Instalar esa misma APK en todos los dispositivos de prueba.
- Registrar modelo, Android, número de serie o identificador interno y hora de instalación.

## 4. Ejecutar pruebas físicas

- Ruta física de 60 minutos con pantalla bloqueada, cambios de red, detención y reinicio.
- Push con app abierta, en background, cerrada y después de reinicio.
- TalkBack en todos los flujos críticos.
- Consumo de batería en Galaxy A14.
- Logout con evidencia y telemetría pendientes.
- Instalación de la build de rollback basada en la versión anterior y firmada con la misma clave.

## 5. Adjuntar evidencias

Guardar en el expediente:

- videos y capturas;
- Logcat;
- reportes de batería;
- puntos de telemetría y lag;
- entregas/aperturas de push;
- reporte TalkBack;
- hashes de APK candidata y rollback;
- versión, commit, dispositivo, usuario y traslado usados.

## 6. Gestión de defectos

- Registrar todo defecto con severidad, pasos, evidencia y versión.
- Bloquear el piloto ante cualquier P0 o P1.
- Corregir únicamente defectos encontrados, sin agregar alcance.
- Crear un nuevo commit candidato y repetir las pruebas afectadas más el gate automatizado completo.

## 7. Firmar y autorizar

- Completar el acta GO/NO-GO.
- Obtener firmas de Dirección, Tecnología, Operaciones y QA.
- Autorizar rollout gradual sólo con decisión GO o GO condicionado explícito.
- Iniciar por canal interno, piloto pequeño, piloto ampliado y producción gradual.
