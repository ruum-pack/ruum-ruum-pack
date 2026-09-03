# docs/eliminar — Eliminables sin riesgo

Esta carpeta contiene duplicados exactos, artefactos generados y archivos desubicados movidos el 2026-09-03. **Se pueden borrar con `git rm -r docs/eliminar` sin impacto** (no referenciados en `architecture.md`, workflows ni código).

| Archivo | Origen | Motivo |
|---|---|---|
| `CSP_DEUDA-duplicado-exacto.md` | `docs/CSP_DEUDA.md` | Hash idéntico a `docs/CSP_DEUDA_P2.md` |
| `README.Docker-duplicado.md` | `docs/README.Docker.md` | Plantilla 15 líneas duplicada de `docs/DOCKER_README.md` (113 líneas) |
| `README-app-usuario-desubicado.md` | `docs/README.md` | Contenido migrado a `apps/app-usuario/README.md` (correcta ubicación) |
| `README-panel-admin-typo-READMEr.md` | `docs/READMEr.md` | Typo `READMEr`, migrado a `apps/panel-admin/README.md` |
| `Informe_Arquitectura_Flujos_App_Usuario.docx` | `/Informe_...docx` raíz | Triplicado de `docs/archive/informes/INFORME_FLUJOS_APP_USUARIO.md` |
| `Informe_Arquitectura_Tecnica_Ruum_Usuario_Conductor.docx` | `/Informe_...docx` raíz | Triplicado de `docs/archive/informes/INFORME_FLUJOS_APP_CONDUCTOR.md` |
| `informe-flujos-app-conductor.docx` | `docs/app-conductor/...docx` | Duplicado `.md` archivado |
| `informe-flujos-app-usuario.docx` | `docs/app-usuario/...docx` | Duplicado `.md` archivado |
| `storybook-aviso-de-privacidad.docx` | `apps/app-conductor/storybook-static/...` | Artefacto build generado, no fuente (gitignore `storybook-static/`) |
| `storybook-terminos-y-condiciones.docx` | `apps/app-conductor/storybook-static/...` | Artefacto build generado |
| `Nueva-carpeta-vacia/` | `/Nueva carpeta` | Directorio vacío sin uso |
| `build.log` | `/build.log` | Log CI local, no documentación |

Fuente canónica legales permanece en `docs/Ruum_Ruum_*.docx` y `public/docs-legales/` (copia despliegue).
