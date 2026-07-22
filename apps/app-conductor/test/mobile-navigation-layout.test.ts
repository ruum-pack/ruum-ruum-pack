import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GLOBALS_CSS = readFileSync(resolve(__dirname, "../src/app/globals.css"), "utf8");

function cssPxVariable(name: string, scope = GLOBALS_CSS) {
  const match = scope.match(new RegExp(`${name}:\\s*(\\d+)px`));
  if (!match) throw new Error(`No se encontró ${name} en globals.css`);
  return Number(match[1]);
}

function mediaBlock(query: string) {
  const start = GLOBALS_CSS.indexOf(query);
  if (start === -1) throw new Error(`No se encontró ${query} en globals.css`);

  const open = GLOBALS_CSS.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < GLOBALS_CSS.length; index += 1) {
    const char = GLOBALS_CSS[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return GLOBALS_CSS.slice(open + 1, index);
  }

  throw new Error(`No se pudo cerrar ${query} en globals.css`);
}

describe("navegación móvil con viaje activo", () => {
  it("mantiene la interfaz en una columna y con controles táctiles bajo 768px", () => {
    const mobile = mediaBlock("@media (max-width: 767px)");

    expect(mobile).toContain(".conductor-responsive-grid");
    expect(mobile).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(mobile).toContain(".conductor-responsive-stack");
    expect(mobile).toContain("flex-direction: column");
    expect(mobile).toContain("min-height: 44px");
  });

  it("hace medios responsivos, tablas desplazables y titulares resistentes en móvil", () => {
    const mobile = mediaBlock("@media (max-width: 767px)");

    expect(mobile).toContain(":where(img, picture, video, canvas)");
    expect(mobile).toContain("max-width: 100%");
    expect(mobile).toContain(":where(table)");
    expect(mobile).toContain("overflow-x: auto");
    expect(mobile).toContain("font-size: clamp");
    expect(mobile).toContain("overflow-wrap: anywhere");
  });

  it("reserva espacio suficiente para la tarjeta fija en 320x568 y safe area", () => {
    const mobile = mediaBlock("@media (max-width: 767px)");
    const compact = mediaBlock("@media (max-width: 767px) and (max-height: 600px)");
    const navOffset = cssPxVariable("--conductor-mobile-nav-offset", mobile);
    const compactTripOffset = cssPxVariable("--conductor-mobile-active-trip-offset", compact);
    const compactReserve = cssPxVariable("--conductor-mobile-page-reserve", compact);

    expect(navOffset).toBeGreaterThanOrEqual(80);
    expect(compactTripOffset).toBeGreaterThanOrEqual(72);
    expect(compactReserve).toBeGreaterThanOrEqual(navOffset + compactTripOffset + 16);
    expect(compact).toContain(".conductor-mobile-active-trip-destination");
    expect(compact).toContain("display: none");
    expect(compact).toContain("min-height: 3.5rem");
  });

  it("oculta la tarjeta en horizontal bajo y vuelve a reservar sólo la barra inferior", () => {
    const landscape = mediaBlock("@media (max-width: 767px) and (max-height: 430px)");

    expect(cssPxVariable("--conductor-mobile-active-trip-offset", landscape)).toBe(0);
    expect(cssPxVariable("--conductor-mobile-page-reserve", landscape)).toBe(104);
    expect(landscape).toContain(".conductor-mobile-active-trip");
    expect(landscape).toContain("display: none");
    expect(landscape).toContain("env(safe-area-inset-bottom)");
  });
});
