import { describe, expect, it, vi } from "vitest";

const capacitorMock = vi.hoisted(() => ({
  esNativo: vi.fn(() => false),
  plataformaActual: vi.fn<() => "ios" | "android" | "web">(() => "web")
}));

vi.mock("../src/lib/capacitor", () => capacitorMock);

import { createNavigationOptions } from "../src/lib/navigation-launcher";

const target = {
  lat: 19.4326,
  lng: -99.1332,
  address: "Centro, CDMX"
};

describe("navigation launcher", () => {
  it("usa enlaces HTTPS en web", () => {
    capacitorMock.esNativo.mockReturnValue(false);
    capacitorMock.plataformaActual.mockReturnValue("web");

    const options = createNavigationOptions(target);

    expect(options[0]).toMatchObject({
      id: "google",
      href: "https://www.google.com/maps/dir/?api=1&destination=19.4326%2C-99.1332&travelmode=driving",
      webHref: "https://www.google.com/maps/dir/?api=1&destination=19.4326%2C-99.1332&travelmode=driving"
    });
    expect(options[0].nativeHref).toBeUndefined();
  });

  it("prioriza Google Maps y Waze nativos en Capacitor Android", () => {
    capacitorMock.esNativo.mockReturnValue(true);
    capacitorMock.plataformaActual.mockReturnValue("android");

    const options = createNavigationOptions(target);

    expect(options.map((option) => option.nativeHref)).toEqual([
      "comgooglemaps://?daddr=19.4326%2C-99.1332&directionsmode=driving",
      "waze://?ll=19.4326%2C-99.1332&navigate=yes"
    ]);
    expect(options.every((option) => option.webHref.startsWith("https://"))).toBe(true);
  });

  it("usa q en Waze cuando solo hay direccion", () => {
    capacitorMock.esNativo.mockReturnValue(true);
    capacitorMock.plataformaActual.mockReturnValue("android");

    const options = createNavigationOptions({
      lat: null,
      lng: null,
      address: "Av. Reforma 222, CDMX"
    });

    expect(options.find((option) => option.id === "waze")?.nativeHref).toBe(
      "waze://?q=Av.%20Reforma%20222%2C%20CDMX&navigate=yes"
    );
  });

  it("incluye Apple Maps nativo en Capacitor iOS", () => {
    capacitorMock.esNativo.mockReturnValue(true);
    capacitorMock.plataformaActual.mockReturnValue("ios");

    const options = createNavigationOptions(target);

    expect(options.find((option) => option.id === "apple")?.nativeHref).toBe(
      "maps://?daddr=19.4326%2C-99.1332&dirflg=d"
    );
  });
});
