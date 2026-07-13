param(
  [switch]$OmitirBuilds
)

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo

function Ejecutar-Comando {
  param([string]$Descripcion, [scriptblock]$Accion)
  Write-Host "`n==> $Descripcion" -ForegroundColor Cyan
  & $Accion
  if ($LASTEXITCODE -ne 0) {
    throw "$Descripcion falló con código $LASTEXITCODE."
  }
}

$contenedor = docker ps --filter "name=supabase_db_ruum" --format "{{.Names}}"
if ($contenedor -ne "supabase_db_ruum") {
  throw "Supabase local no está iniciado. Ejecuta: pnpm db:start"
}

Ejecutar-Comando "Aplicar migraciones locales pendientes" {
  supabase migration up --local
}

$pruebasSql = @(
  "rt02_estados_expediente_conductor.test.sql",
  "rt03_rt04_solicitudes_integridad.test.sql",
  "rt05_rt07_metadata_minima_compatibilidad.test.sql",
  "rt08_rt11_rpc_flujo_solicitud.test.sql",
  "rt12_rt15_documentos_versionados.test.sql",
  "rt17_rt18_consentimientos_separados.test.sql",
  "rt23_rt24_torre_control_auditoria.test.sql",
  "rt25_rls_perfiles_reales.test.sql",
  "rt27_metricas_registro_conductor.test.sql"
)

foreach ($prueba in $pruebasSql) {
  Ejecutar-Comando "SQL $prueba" {
    Get-Content -Raw (Join-Path $Repo "supabase/test/$prueba") |
      docker exec -i supabase_db_ruum psql -U postgres -d postgres -v ON_ERROR_STOP=1
  }
}

Ejecutar-Comando "Pruebas unitarias compartidas" {
  pnpm --filter @ruum/shared test
}

foreach ($paquete in @("@ruum/shared", "@ruum/api", "app-usuario", "app-conductor", "panel-admin")) {
  Ejecutar-Comando "Typecheck $paquete" {
    pnpm --filter $paquete typecheck
  }
}

if (-not $OmitirBuilds) {
  foreach ($aplicacion in @("app-usuario", "app-conductor", "panel-admin")) {
    Ejecutar-Comando "Build $aplicacion" {
      pnpm --filter $aplicacion build
    }
  }
}

Ejecutar-Comando "Verificar formato del diff" {
  git diff --check
}

Write-Host "`nRegresión de registro de conductor completada correctamente." -ForegroundColor Green
