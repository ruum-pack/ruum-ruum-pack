import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const AUTH_STATE_PATH = "tests/.auth/conductor.json";
const ACTIVE_TRIP_ID = "00000000-0000-4000-8000-00000000e205";

const ROUTES = [
  "/panel",
  "/viajes",
  `/viajes/${ACTIVE_TRIP_ID}`,
  `/viajes/${ACTIVE_TRIP_ID}/evidencia`,
  "/ganancias",
  "/cuenta/perfil",
  "/cuenta/documentos",
];

const ZOOM_DIR = resolve(process.cwd(), "artifacts/a11y/zoom-200");
const DARK_DIR = resolve(process.cwd(), "artifacts/a11y/dark-theme");

function routeSlug(route: string) {
  return route === "/" ? "home" : route.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-").replace(/-$/, "");
}

async function openProtectedRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "commit", timeout: 30_000 });
  await page.locator("#contenido-principal, body").first().waitFor({ state: "visible", timeout: 20_000 });
  const finalUrl = new URL(page.url());
  expect(finalUrl.pathname, `${route} redirigió a /login durante auditoría visual`).not.toBe("/login");
  expect(finalUrl.pathname).toBe(route);
}

async function disableMotion(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
    `,
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: element.textContent?.trim().slice(0, 80) ?? "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.width > 0 && (item.left < -2 || item.right > viewportWidth + 2))
      .slice(0, 10);

    return { documentWidth, viewportWidth, offenders };
  });

  expect(
    overflow,
    `Hay overflow horizontal: ${JSON.stringify(overflow.offenders, null, 2)}`
  ).toMatchObject({ documentWidth: expect.any(Number), viewportWidth: expect.any(Number), offenders: [] });
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth + 2);
}

async function assertInputsAtLeast16px(page: Page) {
  const smallInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLElement>("input, textarea, select"))
      .filter((element) => {
        const styles = window.getComputedStyle(element);
        return Number.parseFloat(styles.fontSize) < 16;
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        name: element.getAttribute("name"),
        ariaLabel: element.getAttribute("aria-label"),
        fontSize: window.getComputedStyle(element).fontSize,
      }));
  });

  expect(smallInputs, `Inputs con fuente menor a 16px: ${JSON.stringify(smallInputs, null, 2)}`).toEqual([]);
}

async function assertEssentialTextNotClipped(page: Page) {
  const clipped = await page.evaluate(() => {
    const selector = "h1,h2,h3,p,label,summary,button,a,[role='button'],[role='link']";
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const text = element.textContent?.trim();
        if (!text) return false;
        const styles = window.getComputedStyle(element);
        if (styles.overflow === "visible") return false;
        return element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2;
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: element.textContent?.trim().slice(0, 80),
        overflow: window.getComputedStyle(element).overflow,
      }))
      .slice(0, 10);
  });

  expect(clipped, `Texto esencial truncado: ${JSON.stringify(clipped, null, 2)}`).toEqual([]);
}

async function assertFocusVisible(page: Page) {
  await page.keyboard.press("Tab");
  const focusState = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body) return { hasFocus: false };
    const styles = window.getComputedStyle(active);
    return {
      hasFocus: true,
      tag: active.tagName.toLowerCase(),
      text: active.textContent?.trim().slice(0, 80) ?? "",
      outlineWidth: styles.outlineWidth,
      boxShadow: styles.boxShadow,
    };
  });

  expect(focusState.hasFocus, "No hubo elemento enfocado al navegar con teclado").toBe(true);
  expect(
    focusState.outlineWidth !== "0px" || focusState.boxShadow !== "none",
    `El foco no es visible: ${JSON.stringify(focusState)}`
  ).toBe(true);
}

async function assertCtaVisible(page: Page) {
  const visibleActions = await page
    .locator("button:visible, a[href]:visible")
    .filter({ hasNotText: /^$/ })
    .count();

  expect(visibleActions, "No hay CTA o acción visible en la ruta auditada").toBeGreaterThan(0);
}

async function assertContrast(page: Page) {
  const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  expect(
    result.violations,
    `Contraste WCAG AA insuficiente: ${JSON.stringify(
      result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target),
      })),
      null,
      2
    )}`
  ).toEqual([]);
}

async function setBrowserZoom(page: Page, zoom: number) {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: zoom });
}

test.describe("A11Y visual zoom and contrast", () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test.beforeAll(() => {
    mkdirSync(ZOOM_DIR, { recursive: true });
    mkdirSync(DARK_DIR, { recursive: true });
  });

  for (const route of ROUTES) {
    test(`zoom 200 and dark contrast for ${route}`, async ({ page }) => {
      test.skip(test.info().project.name !== "chromium", "La auditoría visual usa CDP de Chromium para zoom.");

      await page.setViewportSize({ width: 1280, height: 900 });
      await openProtectedRoute(page, route);
      await disableMotion(page);
      await setBrowserZoom(page, 2);

      await assertNoHorizontalOverflow(page);
      await assertInputsAtLeast16px(page);
      await assertEssentialTextNotClipped(page);
      await assertCtaVisible(page);
      await assertFocusVisible(page);
      await assertContrast(page);
      await page.screenshot({ path: resolve(ZOOM_DIR, `${routeSlug(route)}.png`), fullPage: true });

      await page.addStyleTag({ content: "html { font-size: 150% !important; }" });
      await assertNoHorizontalOverflow(page);
      await assertEssentialTextNotClipped(page);

      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await assertNoHorizontalOverflow(page);
      await assertEssentialTextNotClipped(page);

      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await assertContrast(page);
      await page.screenshot({ path: resolve(DARK_DIR, `${routeSlug(route)}.png`), fullPage: true });
    });
  }
});
