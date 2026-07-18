#!/usr/bin/env node

/**
 * Script para ejecutar auditorías de accesibilidad de forma local
 * 
 * Uso:
 *   npm run audit:a11y -- [ruta1] [ruta2] ...
 *   node scripts/audit-a11y.mjs --route / --route /login
 */

import { spawn, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Rutas principales por defecto (basadas en la estructura real)
const DEFAULT_ROUTES = [
  '/', // Redirige a /onboarding
  '/onboarding',
  '/login',
  '/nueva-password',
  '/recuperar-password',
  '/registro',
  '/panel',
  '/ganancias',
  '/configuracion',
  '/cuenta',
  '/cuenta/perfil',
  '/cuenta/datos-bancarios',
  '/cuenta/documentos',
  '/cuenta/legal',
  '/cuenta/seguridad',
  '/cuenta/soporte',
  '/cuenta/preferencias',
  '/legal/privacidad',
  '/legal/terminos',
];

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
  };
  const reset = '\x1b[0m';
  const color = colors[type] || colors.info;
  console.log(`${color}[A11Y]${reset} ${message}`);
}

function runCommand(command, cwd = projectRoot) {
  return new Promise((resolve, reject) => {
    log(`Ejecutando: ${command}`);
    const child = spawn(command, { 
      shell: true, 
      cwd,
      stdio: 'inherit' 
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function runESLintA11y() {
  log('Iniciando auditoría ESLint con reglas de accesibilidad...', 'info');
  
  try {
    await runCommand('npm run lint:a11y');
    log('✅ Auditoría ESLint completada sin errores', 'success');
    return true;
  } catch (error) {
    log('❌ Error en auditoría ESLint: ' + error.message, 'error');
    return false;
  }
}

async function runAxeAudit(routes = DEFAULT_ROUTES) {
  log('Iniciando auditoría Axe Core...', 'info');
  
  // Asegurar que el directorio de resultados exista
  const resultsDir = resolve(projectRoot, 'results');
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }
  
  const reportPath = resolve(resultsDir, `axe-report-${new Date().toISOString().slice(0, 10)}.json`);
  
  // Iniciar servidor en segundo plano si no está corriendo
  try {
    const serverCheck = spawn('lsof', ['-i', ':3001']);
    let serverRunning = false;
    
    serverCheck.on('close', (code) => {
      if (code === 0) serverRunning = true;
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!serverRunning) {
      log('Iniciando servidor de desarrollo...', 'info');
      spawn('npm', ['run', 'dev'], { 
        cwd: projectRoot,
        detached: true,
        stdio: 'ignore'
      });
      
      // Esperar a que el servidor inicie
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  } catch (error) {
    // Si falla la verificación, intentar iniciar el servidor
    log('No se pudo verificar el servidor, iniciando uno nuevo...', 'warning');
  }
  
  try {
    // Ejecutar Axe CLI para cada ruta
    const axeResults = [];
    
    for (const route of routes) {
      log(`Auditando ruta: ${route}`);
      const routeReportPath = resolve(resultsDir, `axe-${route.replace(/\//g, '-')}.json`);
      
      try {
        await runCommand(`npx axe http://localhost:3001${route} --save ${routeReportPath}`);
        
        // Leer y analizar el reporte
        if (existsSync(routeReportPath)) {
          const report = JSON.parse(readFileSync(routeReportPath, 'utf-8'));
          axeResults.push({
            route,
            violations: report.violations || [],
            passes: report.passes || [],
            timestamp: new Date().toISOString()
          });
          
          if (report.violations && report.violations.length > 0) {
            log(`⚠️  ${report.violations.length} violaciones encontradas en ${route}`, 'warning');
          } else {
            log(`✅ Sin violaciones en ${route}`, 'success');
          }
        }
      } catch (error) {
        log(`❌ Error auditando ${route}: ${error.message}`, 'error');
      }
    }
    
    // Guardar reporte consolidado
    writeFileSync(resolve(resultsDir, 'axe-consolidated-report.json'), JSON.stringify(axeResults, null, 2));
    
    // Verificar si hay errores críticos
    const hasCriticalErrors = axeResults.some(r => r.violations.length > 0);
    
    if (hasCriticalErrors) {
      log('❌ Se encontraron errores críticos de accesibilidad', 'error');
      return false;
    }
    
    log('✅ Auditoría Axe Core completada sin errores críticos', 'success');
    return true;
  } catch (error) {
    log('❌ Error en auditoría Axe: ' + error.message, 'error');
    return false;
  }
}

async function runPlaywrightA11y() {
  log('Iniciando pruebas de accesibilidad con Playwright...', 'info');
  
  try {
    await runCommand('npm run test:a11y');
    log('✅ Pruebas Playwright completadas', 'success');
    return true;
  } catch (error) {
    log('❌ Error en pruebas Playwright: ' + error.message, 'error');
    return false;
  }
}

async function runLighthouseAudit(routes = DEFAULT_ROUTES.slice(0, 3)) {
  log('Iniciando auditoría Lighthouse...', 'info');
  
  const lhciConfig = {
    ci: {
      collect: {
        url: routes.map(r => `http://localhost:3001${r}`),
        numberOfRuns: 1,
      },
      assert: {
        assertions: {
          'accessibility': ['error', { minScore: 0.95 }],
        },
      },
    },
  };
  
  // Guardar configuración temporal
  const tempConfigPath = resolve(projectRoot, 'lighthouserc-temp.js');
  writeFileSync(tempConfigPath, `module.exports = ${JSON.stringify(lhciConfig, null, 2)};`);
  
  try {
    await runCommand('npx lhci autorun --config=lighthouserc-temp.js');
    
    // Leer resultados
    const lhciDir = resolve(projectRoot, '.lighthouse-ci');
    if (existsSync(lhciDir)) {
      log('✅ Auditoría Lighthouse completada', 'success');
    } else {
      log('⚠️  No se encontraron resultados de Lighthouse', 'warning');
    }
    
    return true;
  } catch (error) {
    log('❌ Error en auditoría Lighthouse: ' + error.message, 'error');
    return false;
  } finally {
    // Limpiar configuración temporal
    if (existsSync(tempConfigPath)) {
      unlinkSync(tempConfigPath);
    }
  }
}

async function generateReport() {
  log('Generando reporte consolidado...', 'info');
  
  const resultsDir = resolve(projectRoot, 'results');
  const report = {
    timestamp: new Date().toISOString(),
    esLint: { status: 'pending', errors: [] },
    axe: { status: 'pending', violations: [] },
    playwright: { status: 'pending', errors: [] },
    lighthouse: { status: 'pending', scores: {} },
  };
  
  // Leer reportes existentes
  if (existsSync(resolve(resultsDir, 'axe-consolidated-report.json'))) {
    const axeReport = JSON.parse(readFileSync(resolve(resultsDir, 'axe-consolidated-report.json'), 'utf-8'));
    report.axe = {
      status: axeReport.every(r => r.violations.length === 0) ? 'passed' : 'failed',
      violations: axeReport.flatMap(r => r.violations),
    };
  }
  
  // Guardar reporte final
  const finalReportPath = resolve(resultsDir, 'accessibility-audit-report.json');
  writeFileSync(finalReportPath, JSON.stringify(report, null, 2));
  
  log(`✅ Reporte generado: ${finalReportPath}`, 'success');
  
  // Mostrar resumen
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE AUDITORÍA DE ACCESIBILIDAD');
  console.log('='.repeat(60));
  console.log(`Fecha: ${report.timestamp}`);
  console.log(`\nESLint: ${report.esLint.status}`);
  console.log(`Axe: ${report.axe.status} (${report.axe.violations.length} violaciones)`);
  console.log(`Playwright: ${report.playwright.status}`);
  console.log(`Lighthouse: ${report.lighthouse.status}`);
  console.log('\n' + '='.repeat(60));
  
  if (report.axe.violations.length > 0) {
    console.log('\n⚠️  VIOLACIONES DE ACCESIBILIDAD:');
    report.axe.violations.forEach((v, i) => {
      console.log(`\n${i + 1}. ${v.description}`);
      console.log(`   Ruta: ${v.nodes?.[0]?.target || 'N/A'}`);
      console.log(`   Impacto: ${v.impact || 'N/A'}`);
      console.log(`   Ayuda: ${v.helpUrl || 'N/A'}`);
    });
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  const routes = [];
  
  // Parsear argumentos
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--route' && args[i + 1]) {
      routes.push(args[i + 1]);
      i++;
    }
  }
  
  const useDefaultRoutes = routes.length === 0;
  const routesToAudit = useDefaultRoutes ? DEFAULT_ROUTES : routes;
  
  console.log('\n' + '='.repeat(60));
  console.log('AUDITORÍA DE ACCESIBILIDAD AUTOMÁTICA');
  console.log('='.repeat(60));
  console.log(`Rutas a auditar: ${routesToAudit.join(', ')}`);
  console.log('='.repeat(60) + '\n');
  
  const results = {
    esLint: false,
    axe: false,
    playwright: false,
    lighthouse: false,
  };
  
  // Ejecutar auditorías
  results.esLint = await runESLintA11y();
  results.axe = await runAxeAudit(routesToAudit);
  results.playwright = await runPlaywrightA11y();
  results.lighthouse = await runLighthouseAudit(routesToAudit.slice(0, 3));
  
  // Generar reporte
  await generateReport();
  
  // Verificar criterios de aceptación
  console.log('\n' + '='.repeat(60));
  console.log('CRITERIOS DE ACEPTACIÓN');
  console.log('='.repeat(60));
  
  const criteriaMet = {
    axe: results.axe ? '✅ Cero errores críticos de Axe' : '❌ Errores críticos de Axe encontrados',
    lighthouse: results.lighthouse ? '✅ Lighthouse Accessibility ≥ 95' : '❌ Lighthouse Accessibility < 95',
  };
  
  console.log(criteriaMet.axe);
  console.log(criteriaMet.lighthouse);
  
  if (results.axe && results.lighthouse) {
    console.log('\n🎉 Todos los criterios de aceptación cumplidos!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Algunos criterios no se cumplieron');
    process.exit(1);
  }
}

// Ejecutar
main().catch(error => {
  log('❌ Error inesperado: ' + error.message, 'error');
  process.exit(1);
});
