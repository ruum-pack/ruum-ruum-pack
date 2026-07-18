#!/usr/bin/env node

/**
 * Script para probar accesibilidad en una ruta específica
 * 
 * Uso:
 *   node scripts/test-route-a11y.mjs /login
 *   node scripts/test-route-a11y.mjs /panel
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

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

async function testRouteWithAxe(route) {
  const resultsDir = resolve(projectRoot, 'results');
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }
  
  const reportPath = resolve(resultsDir, `axe-${route.replace(/\//g, '-')}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
  
  log(`Probando ruta: ${route}`, 'info');
  log(`Reporte se guardará en: ${reportPath}`, 'info');
  
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['axe', `http://localhost:3001${route}`, '--save', reportPath], {
      stdio: 'pipe',
      cwd: projectRoot,
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0 && existsSync(reportPath)) {
        try {
          const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
          resolve(report);
        } catch (error) {
          reject(new Error(`No se pudo leer el reporte: ${error.message}`));
        }
      } else {
        reject(new Error(`Axe CLI falló con código ${code}: ${stderr}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function testRouteWithPlaywright(route) {
  log(`Probando con Playwright: ${route}`, 'info');
  
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['playwright', 'test', 'tests/a11y/accessibility.spec.ts', `--grep`, route, '--reporter=line'], {
      stdio: 'inherit',
      cwd: projectRoot,
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Playwright falló con código ${code}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function analyzeReport(report, route) {
  const violations = report.violations || [];
  const passes = report.passes || [];
  const incomplete = report.incomplete || [];
  
  console.log('\n' + '='.repeat(70));
  console.log(`REPORTE DE ACCESIBILIDAD - ${route}`);
  console.log('='.repeat(70));
  
  console.log(`\n📊 Estadísticas:`);
  console.log(`  ✅ Pasos: ${passes.length}`);
  console.log(`  ❌ Violaciones: ${violations.length}`);
  console.log(`  ⚠️  Incompletos: ${incomplete.length}`);
  
  if (violations.length > 0) {
    console.log('\n🔴 VIOLACIONES ENCONTRADAS:');
    violations.forEach((violation, index) => {
      console.log(`\n${index + 1}. ${violation.description}`);
      console.log(`   📌 ID: ${violation.id}`);
      console.log(`   🎯 Impacto: ${violation.impact}`);
      console.log(`   📖 WCAG: ${violation.tags.join(', ')}`);
      console.log(`   🔗 Ayuda: ${violation.helpUrl}`);
      console.log(`   📍 Nodos afectados: ${violation.nodes.length}`);
      
      violation.nodes.forEach((node, nodeIndex) => {
        console.log(`\n   Nodo ${nodeIndex + 1}:`);
        console.log(`     HTML: ${node.html.slice(0, 200)}...`);
        console.log(`     Target: ${node.target.join(' > ')}`);
        console.log(`     Fijar con: ${JSON.stringify(node.failureSummary)}`);
      });
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  ACCIONES RECOMENDADAS');
    console.log('='.repeat(70));
    
    violations.forEach((violation) => {
      console.log(`\n${violation.id}:`);
      console.log(`  • Descripción: ${violation.description}`);
      console.log(`  • Solución: ${violation.help}`);
    });
  } else {
    console.log('\n✅ No se encontraron violaciones de accesibilidad');
  }
  
  if (incomplete.length > 0) {
    console.log('\n🟡 ELEMENTOS INCOMPLETOS (requieren revisión manual):');
    incomplete.forEach((incomplete, index) => {
      console.log(`\n${index + 1}. ${incomplete.description}`);
      console.log(`   ID: ${incomplete.id}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  
  return { violations, passes, incomplete };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\nUso:');
    console.log('  node scripts/test-route-a11y.mjs <ruta>');
    console.log('\nEjemplos:');
    console.log('  node scripts/test-route-a11y.mjs /login');
    console.log('  node scripts/test-route-a11y.mjs /panel');
    console.log('  node scripts/test-route-a11y.mjs /onboarding');
    console.log('\nRutas disponibles:');
    console.log('  /, /onboarding, /login, /nueva-password, /recuperar-password');
    console.log('  /registro, /panel, /ganancias, /configuracion, /cuenta');
    console.log('  /cuenta/perfil, /cuenta/datos-bancarios, /cuenta/documentos');
    console.log('  /cuenta/legal, /cuenta/seguridad, /cuenta/soporte');
    console.log('  /cuenta/preferencias, /legal/privacidad, /legal/terminos');
    process.exit(1);
  }
  
  const route = args[0];
  
  // Validar formato de ruta
  if (!route.startsWith('/')) {
    console.error('❌ La ruta debe empezar con /');
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('PRUEBA DE ACCESIBILIDAD POR RUTA');
  console.log('='.repeat(70));
  console.log(`Ruta: ${route}`);
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log('='.repeat(70));
  
  try {
    // Verificar que el servidor está corriendo
    log('Verificando servidor en http://localhost:3001...', 'info');
    
    try {
      await new Promise((resolve, reject) => {
        const checkServer = spawn('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:3001']);
        let output = '';
        
        checkServer.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        checkServer.on('close', (code) => {
          if (output.includes('200') || output.includes('301') || output.includes('302') || output.includes('307') || output.includes('308')) {
            resolve();
          } else {
            reject(new Error(`Servidor no responde correctamente (código: ${output})`));
          }
        });
        
        checkServer.on('error', reject);
      });
      
      log('✅ Servidor está funcionando', 'success');
    } catch (error) {
      log(`⚠️  No se pudo verificar el servidor: ${error.message}`, 'warning');
      log('Asegúrate de que el servidor esté corriendo con: npm run dev', 'warning');
      
      const confirm = await new Promise((resolve) => {
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim().toLowerCase());
        });
        process.stdout.write('¿Quieres continuar de todos modos? (s/n): ');
      });
      
      if (confirm !== 's' && confirm !== 'si' && confirm !== 'y' && confirm !== 'yes') {
        process.exit(0);
      }
    }
    
    // Ejecutar prueba con Axe
    const report = await testRouteWithAxe(route);
    
    // Analizar reporte
    const results = await analyzeReport(report, route);
    
    // Guardar resumen
    const resultsDir = resolve(projectRoot, 'results');
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }
    
    const summary = {
      route,
      timestamp: new Date().toISOString(),
      violations: results.violations.length,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      hasCriticalErrors: results.violations.some(v => v.impact === 'critical' || v.impact === 'serious'),
    };
    
    writeFileSync(
      resolve(resultsDir, `summary-${route.replace(/\//g, '-')}.json`),
      JSON.stringify(summary, null, 2)
    );
    
    log(`\n✅ Prueba completada. Resumen guardado en results/`, 'success');
    
    // Verificar criterios de aceptación
    if (results.violations.length === 0) {
      log('\n✅ CRITERIO CUMPLIDO: Cero errores de Axe', 'success');
    } else if (results.violations.some(v => v.impact === 'critical' || v.impact === 'serious')) {
      log('\n❌ CRITERIO NO CUMPLIDO: Hay errores críticos de accesibilidad', 'error');
      process.exit(1);
    } else {
      log('\n⚠️  ADVERTENCIA: Hay violaciones menores que deberían corregirse', 'warning');
    }
    
  } catch (error) {
    log(`\n❌ Error al probar ruta ${route}: ${error.message}`, 'error');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Error inesperado: ${error.message}`, 'error');
  process.exit(1);
});
