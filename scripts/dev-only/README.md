# Scripts de Desarrollo Local (Dev-Only)

Esta carpeta está destinada **exclusivamente** a scripts de diagnóstico y pruebas locales en entornos de desarrollo aislados.

## ⚠️ Reglas de Seguridad Críticas:
1. **NUNCA** coloques credenciales `SUPABASE_SERVICE_ROLE_KEY` ni llaves maestras en archivos de código fuente.
2. **NUNCA** quemes IDs reales de producción o staging en scripts.
3. Todas las operaciones de prueba deben realizarse contra una instancia local de Supabase (`supabase start`) o proyecto de pruebas de desarrollo.
4. Cualquier script en este directorio está excluido del control de versiones por `.gitignore`.
