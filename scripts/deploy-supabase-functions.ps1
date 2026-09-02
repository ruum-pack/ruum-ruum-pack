[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string[]]$Name
)

$ErrorActionPreference = "Stop"
$functionsRoot = Join-Path $PSScriptRoot "..\supabase\functions"

if (-not (Test-Path -LiteralPath $functionsRoot -PathType Container)) {
  throw "No se encontró el directorio de funciones: $functionsRoot"
}

function Get-DeployableFunctionDirectories {
  Get-ChildItem -LiteralPath $functionsRoot -Directory |
    Where-Object {
      $_.Name -notlike "_*" -and
      (Test-Path -LiteralPath (Join-Path $_.FullName "index.ts") -PathType Leaf)
    } |
    Sort-Object Name
}

if ($Name -and $Name.Count -gt 0) {
  $selected = foreach ($functionName in $Name) {
    if ($functionName -notmatch "^[A-Za-z][A-Za-z0-9_-]*$") {
      throw "Nombre de función inválido: '$functionName'."
    }

    $functionPath = Join-Path $functionsRoot $functionName
    if (-not (Test-Path -LiteralPath $functionPath -PathType Container)) {
      throw "No existe la función local: '$functionName'."
    }

    $entrypoint = Join-Path $functionPath "index.ts"
    if (-not (Test-Path -LiteralPath $entrypoint -PathType Leaf)) {
      throw "La función '$functionName' no tiene index.ts; no se puede desplegar."
    }

    Get-Item -LiteralPath $functionPath
  }
} else {
  $selected = @(Get-DeployableFunctionDirectories)
}

if ($selected.Count -eq 0) {
  throw "No hay funciones locales con un index.ts desplegable."
}

$failed = [System.Collections.Generic.List[string]]::new()
foreach ($functionDirectory in $selected) {
  Write-Host "`nDesplegando $($functionDirectory.Name)..." -ForegroundColor Cyan
  & supabase functions deploy $functionDirectory.Name
  if ($LASTEXITCODE -ne 0) {
    $failed.Add($functionDirectory.Name)
  }
}

if ($failed.Count -gt 0) {
  throw "Falló el despliegue de: $($failed -join ', ')"
}

Write-Host "`nDespliegue completado: $($selected.Name -join ', ')" -ForegroundColor Green
