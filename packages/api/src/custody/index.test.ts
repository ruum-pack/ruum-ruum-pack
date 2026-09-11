import { describe, expect, it } from "vitest";
import * as custody from "./index";
import * as tracking from "../tracking/index";
import * as incidents from "../incidents/index";
import * as claims from "../claims/index";
import * as billing from "../billing/index";
import * as admin from "../services/admin";
import * as services from "../services/index";

const CASOS: Array<[string, Record<string, unknown>, string[]]> = [
  ["custody", custody as Record<string, unknown>, ["obtenerEvidenciaVehiculo", "exportarEvidenciaFirmada"]],
  ["tracking", tracking as Record<string, unknown>, ["registrarUbicacionTraslado", "obtenerUltimaUbicacionTraslado", "suscribirUbicacionTraslado"]],
  ["incidents", incidents as Record<string, unknown>, ["listarIncidenciasAdmin"]],
  [
    "claims",
    claims as Record<string, unknown>,
    ["listarDisputasAdmin", "resolverDisputaAdmin", "listarReclamosSeguroAdmin", "actualizarReclamoSeguroAdmin"]
  ],
  [
    "billing",
    billing as Record<string, unknown>,
    ["listarPagosAdmin", "obtenerFinanzasTrasladoAdmin", "ajustarPrecioFinalAdmin", "emitirCotizacionAdmin", "aplicarTarifaNormativaAdmin"]
  ]
];

describe("contratos módulos pequeños (Fase 6)", () => {
  for (const [nombre, registro, esperadas] of CASOS) {
    it(`${nombre} expone su superficie`, () => {
      for (const fn of esperadas) {
        expect(registro[fn], `${nombre}.${fn}`).toBeDefined();
      }
    });

    it(`${nombre} coincide con el barrel público`, () => {
      // tracking no pasa por services/admin (se reubicó el fichero completo);
      // el resto coincide vía facade admin.
      const registroPublico =
        nombre === "tracking"
          ? (services as unknown as Record<string, unknown>)
          : (admin as unknown as Record<string, unknown>);
      for (const fn of esperadas) {
        expect(registroPublico[fn], `${nombre}.${fn}`).toBe(registro[fn]);
      }
    });
  }
});
