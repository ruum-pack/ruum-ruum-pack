# run-tests.ps1
# Cargar variables de entorno: primero .env.test, y si existe, sobreescribir con scratch/.env.test
$envFiles = @('.env.test', 'scratch/.env.test')
foreach ($envFile in $envFiles) {
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            $line = $_.Trim()
            if (-not $line -or $line.StartsWith('#')) { return }
            if ($line -match '^([^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                    $value = $matches[1]
                }
                Set-Item -Path "env:$name" -Value $value
                Write-Host "Cargada ($envFile): $name" -ForegroundColor Green
            }
        }
    }
}

# Ejecutar las pruebas a11y con Playwright
node scripts/run-a11y-playwright.mjs --project=chromium --workers=1
