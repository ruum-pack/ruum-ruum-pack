import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { AxeResults, Result as AxeViolation } from 'axe-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const AUTH_STATE_PATH = 'tests/.auth/conductor.json';
const ACTIVE_TRIP_EVIDENCE_ROUTE = '/viajes/00000000-0000-4000-8000-00000000e205/evidencia';
const AXE_RESULTS_PATH = resolve(process.cwd(), 'results/axe-results.json');

type AxeException = {
  route: string;
  ruleId: string;
  target: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  reason: string;
  expiresAt: string;
};

type AxeRouteResult = {
  route: string;
  authenticated: boolean;
  checkedAt: string;
  violations: Array<{
    id: string;
    impact: AxeViolation['impact'];
    help: string;
    helpUrl: string;
    nodes: Array<{ target: string[]; html: string }>;
  }>;
};

const AXE_EXCEPTIONS: AxeException[] = [];
const axeRouteResults: AxeRouteResult[] = [];

async function abrirRuta(page: Page, route: string, options: { requireAuth?: boolean } = {}) {
  await page.goto(route, { waitUntil: 'commit', timeout: 30_000 });
  await page.locator('#contenido-principal, body').first().waitFor({ state: 'visible', timeout: 20_000 });
  const finalUrl = new URL(page.url());

  if (options.requireAuth) {
    expect(finalUrl.pathname, `${route} redirigió a /login en una prueba autenticada`).not.toBe('/login');
    expect(finalUrl.pathname, `La ruta protegida ${route} terminó en una URL inesperada`).toBe(new URL(route, 'http://localhost').pathname);
  }

  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
    `
  });
}

const SMOKE_ROUTE = '/onboarding';

// Smoke de rutas representativas. La auditoría exhaustiva por ruta vive en scripts/audit-a11y.mjs.
const PUBLIC_AXE_SMOKE_ROUTES = [
  '/onboarding',
  '/login',
  '/registro',
  '/legal/privacidad',
];

const PROTECTED_AXE_SMOKE_ROUTES = [
  '/panel',
  '/ganancias',
  '/cuenta/perfil',
  ACTIVE_TRIP_EVIDENCE_ROUTE,
];

const CRITICAL_ROUTES = new Set([...PROTECTED_AXE_SMOKE_ROUTES]);

function assertNoExpiredAxeExceptions() {
  const today = new Date().toISOString().slice(0, 10);
  const expired = AXE_EXCEPTIONS.filter((exception) => exception.expiresAt < today);

  expect(
    expired,
    `Hay excepciones Axe vencidas. Actualiza o elimina la excepción documentada: ${expired
      .map((exception) => `${exception.route} ${exception.ruleId} ${exception.target}`)
      .join(', ')}`
  ).toEqual([]);
}

function isDocumentedException(route: string, violation: AxeViolation, target: string[]) {
  const targetSelector = target.join(' ');

  return AXE_EXCEPTIONS.some((exception) => {
    return (
      exception.route === route &&
      exception.ruleId === violation.id &&
      exception.impact === violation.impact &&
      exception.target === targetSelector
    );
  });
}

function policyViolations(route: string, violations: AxeViolation[]) {
  return violations.flatMap((violation) => {
    return violation.nodes
      .filter((node) => !isDocumentedException(route, violation, node.target))
      .filter(() => {
        if (violation.impact === 'critical') return true;
        return CRITICAL_ROUTES.has(route) && violation.impact === 'serious';
      })
      .map((node) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        target: node.target,
      }));
  });
}

function recordAxeResult(route: string, authenticated: boolean, report: AxeResults) {
  axeRouteResults.push({
    route,
    authenticated,
    checkedAt: new Date().toISOString(),
    violations: report.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        html: node.html,
      })),
    })),
  });
}

function expectAxePolicy(route: string, report: AxeResults) {
  assertNoExpiredAxeExceptions();
  const failures = policyViolations(route, report.violations);

  expect(
    failures,
    `${route} tiene violaciones Axe fuera de política: ${JSON.stringify(failures, null, 2)}`
  ).toEqual([]);
}

test.afterAll(() => {
  mkdirSync(dirname(AXE_RESULTS_PATH), { recursive: true });
  writeFileSync(
    AXE_RESULTS_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        policy: {
          criticalViolationsAllowed: 0,
          seriousViolationsAllowedOnCriticalRoutes: 0,
          criticalRoutes: [...CRITICAL_ROUTES],
          exceptionRule: 'Toda excepción debe declarar route, ruleId, target, impact, reason y expiresAt.',
        },
        exceptions: AXE_EXCEPTIONS,
        routes: axeRouteResults,
      },
      null,
      2
    )
  );
});

test.describe('Accessibility Audit - Axe Core', () => {
  for (const route of PUBLIC_AXE_SMOKE_ROUTES) {
    test(`Axe accessibility audit for ${route}`, async ({ page }) => {
      test.skip(
        test.info().project.name !== 'chromium',
        'Axe completo se ejecuta en Chromium; las comprobaciones específicas cubren el smoke cross-browser.'
      );

      await test.step('Navigate to page', async () => {
        await abrirRuta(page, route);
      });

      await test.step('Run Axe accessibility check', async () => {
        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

        recordAxeResult(route, false, accessibilityScanResults);
        expectAxePolicy(route, accessibilityScanResults);
      });
    });
  }
});

test.describe('Accessibility Audit - Axe Core Authenticated', () => {
  test.use({ storageState: AUTH_STATE_PATH });

  for (const route of PROTECTED_AXE_SMOKE_ROUTES) {
    test(`Authenticated Axe accessibility audit for ${route}`, async ({ page }) => {
      test.skip(
        test.info().project.name !== 'chromium',
        'Axe completo se ejecuta en Chromium; las comprobaciones específicas cubren el smoke cross-browser.'
      );

      await test.step('Navigate to authenticated page', async () => {
        await abrirRuta(page, route, { requireAuth: true });
      });

      await test.step('Run Axe accessibility check', async () => {
        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

        recordAxeResult(route, true, accessibilityScanResults);
        expectAxePolicy(route, accessibilityScanResults);
      });
    });
  }
});

test.describe('Accessibility - Specific Checks', () => {
  test('All images have alt text', async ({ page }) => {
    await abrirRuta(page, SMOKE_ROUTE);
    
    const images = await page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      const role = await images.nth(i).getAttribute('role');
      
      // Imágenes decorativas pueden tener alt vacío, pero deben tenerlo
      if (role !== 'presentation' && role !== 'none') {
        expect(alt).not.toBeNull();
        expect(alt?.trim()).not.toBe('');
      }
    }
  });

  test('All links have meaningful text', async ({ page }) => {
    await abrirRuta(page, SMOKE_ROUTE);
    
    const links = await page.locator('a[href]');
    const count = await links.count();
    
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const href = await link.getAttribute('href');
      
      // Links deben tener texto o aria-label significativo
      if (!ariaLabel && text?.trim()) {
        expect(text.trim().length).toBeGreaterThan(0);
        expect(text.trim().toLowerCase()).not.toMatch(/^(click here|more|read more|link)$/i);
      }
    }
  });

  test('Page has proper language attribute', async ({ page }) => {
    await abrirRuta(page, SMOKE_ROUTE);
    
    const html = await page.locator('html');
    const lang = await html.getAttribute('lang');
    
    expect(lang).toBeTruthy();
    expect(lang).toMatch(/^[a-z]{2}(-[a-z]{2})?$/i);
  });

  test('Heading hierarchy is correct', async ({ page }) => {
    await abrirRuta(page, SMOKE_ROUTE);
    
    const h1 = await page.locator('h1');
    const h2 = await page.locator('h2');
    const h3 = await page.locator('h3');
    const h4 = await page.locator('h4');
    const h5 = await page.locator('h5');
    const h6 = await page.locator('h6');
    
    // Debe haber al menos un h1
    expect(await h1.count()).toBeGreaterThan(0);
    
    // No debe haber saltos en la jerarquía (h1 -> h3 sin h2)
    if (await h2.count() > 0 || await h3.count() > 0) {
      expect(await h1.count()).toBeGreaterThan(0);
    }
    if (await h3.count() > 0 || await h4.count() > 0) {
      expect(await h2.count()).toBeGreaterThan(0);
    }
  });

  test('Skip link is present', async ({ page }) => {
    await abrirRuta(page, SMOKE_ROUTE);
    
    const skipLinks = await page.locator('a[href="#contenido-principal"], a[href="#main"], a[href="#content"]');
    expect(await skipLinks.count()).toBeGreaterThan(0);
  });

  test('Focus management is correct', async ({ page }) => {
    await abrirRuta(page, SMOKE_ROUTE);
    
    // Verificar que elementos interactivos sean focuseables
    const buttons = await page.locator('button:not([disabled]), [role="button"]:not([aria-disabled="true"])');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      const tabIndex = await button.getAttribute('tabindex');
      
      // Botones deben ser focuseables por defecto
      if (tabIndex) {
        expect(parseInt(tabIndex)).not.toBe(-1);
      }
    }
  });
});

test.describe('Accessibility - Authenticated Specific Checks', () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test('All form inputs have associated labels', async ({ page }) => {
    await abrirRuta(page, '/cuenta/perfil', { requireAuth: true });

    const inputs = await page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"])');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      // Verificar que tenga algún tipo de etiqueta
      if (!ariaLabel && !ariaLabelledBy) {
        // Buscar label asociado por id
        if (id) {
          const label = await page.locator(`label[for="${id}"]`);
          await expect(label).toHaveCount(1);
        }
        // Buscar label envuelto
        else if (name) {
          const label = await page.locator(`label:has(input[name="${name}"])`);
          await expect(label).toHaveCount(1);
        }
      }
    }
  });

  test('Protected routes do not pass after redirecting to login', async ({ page }) => {
    for (const route of PROTECTED_AXE_SMOKE_ROUTES) {
      await abrirRuta(page, route, { requireAuth: true });
    }
  });
});
