"use client";

/**
 * Sprint 2 (2026-07-11) — antes de esto, `window.google` nunca existía en
 * ningún entorno: no había ni key ni <script> del SDK de Maps cargado en
 * ningún lado del monorepo. El AutocompleteService de CP en traslados/nuevo
 * ya asumía que existiría, pero siempre caía en su fallback silencioso.
 *
 * Este módulo es la única puerta de entrada al SDK: carga el script una sola
 * vez (singleton), y expone geocodificarDireccion() para reemplazar los
 * origen_lat/lng y destino_lat/lng. Si no puede resolver una dirección, el
 * flujo conserva NULL para que operaciones la identifique como pendiente.
 *
 * Mismo patrón defensivo que tieneStripePublicoConfigurado() en PagoStripe.tsx:
 * si no hay key, todo lo de acá abajo degrada a null/[] sin tronar.
 */

const clavePublica = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              request: {
                input: string;
                types?: string[];
                componentRestrictions?: { country: string };
              },
              callback: (predictions: Array<{ description: string }> | null) => void
            ) => void;
          };
        };
        Geocoder: new () => {
          geocode: (
            request: { address: string; componentRestrictions?: { country: string } },
            callback: (
              results: Array<{ geometry: { location: { lat: () => number; lng: () => number } } }> | null,
              status: string
            ) => void
          ) => void;
        };
      };
    };
  }
}

export function tieneGoogleMapsConfigurado(): boolean {
  return Boolean(clavePublica);
}

let cargaEnCurso: Promise<boolean> | null = null;

/**
 * Inyecta el <script> del SDK una sola vez (singleton compartido entre
 * llamadas concurrentes) y resuelve cuando window.google.maps ya está listo.
 * Resuelve `false` en vez de rechazar si no hay key o si el script falla —
 * quien llama decide el fallback (ver geocodificarDireccion).
 */
export function cargarGoogleMaps(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.maps) return Promise.resolve(true);
  if (!clavePublica) return Promise.resolve(false);
  if (cargaEnCurso) return cargaEnCurso;

  cargaEnCurso = new Promise((resolve) => {
    const existente = document.querySelector<HTMLScriptElement>("script[data-ruum-google-maps]");
    if (existente) {
      existente.addEventListener("load", () => resolve(Boolean(window.google?.maps)));
      existente.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(clavePublica)}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.dataset.ruumGoogleMaps = "true";
    script.addEventListener("load", () => resolve(Boolean(window.google?.maps)));
    script.addEventListener("error", () => resolve(false));
    document.head.appendChild(script);
  });

  return cargaEnCurso;
}

export interface CoordenadasGeocodificadas {
  lat: number;
  lng: number;
}

/**
 * Dirección completa (calle, colonia, ciudad, CP, estado) -> lat/lng.
 * Devuelve null si Maps no está configurado, si el script no cargó, si la
 * dirección no resuelve, o si Google no encuentra coincidencias — nunca
 * lanza, para que el flujo de creación de traslado pueda seguir con el
 * fallback de siempre (0,0 + aviso) en vez de bloquear la solicitud.
 */
export async function geocodificarDireccion(direccion: string): Promise<CoordenadasGeocodificadas | null> {
  const listo = await cargarGoogleMaps();
  if (!listo || !window.google?.maps) return null;

  const Geocoder = window.google.maps.Geocoder;
  return new Promise((resolve) => {
    const geocoder = new Geocoder();
    geocoder.geocode({ address: direccion, componentRestrictions: { country: "mx" } }, (resultados, status) => {
      if (status !== "OK" || !resultados || resultados.length === 0) {
        resolve(null);
        return;
      }
      const ubicacion = resultados[0].geometry.location;
      resolve({ lat: ubicacion.lat(), lng: ubicacion.lng() });
    });
  });
}
