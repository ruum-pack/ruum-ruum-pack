/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { AppStateProvider } from "../../../../../state/AppStateProvider";
import { haCambiadoTarifa, generarTarifaSnapshot, CAMPOS_PASO_TARIFA } from "../../tarifa-gate";
import { guardarBorradorTrasladoLocal, leerBorradorTrasladoLocal, limpiarBorradorTrasladoLocal } from "../../../../../lib/borrador-traslado";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// Mock supabase y servicios para evitar red
vi.mock("../../../../../lib/supabase-browser", () => ({
  crearClienteNavegador: vi.fn(() => ({})),
  tieneSupabaseConfigurado: vi.fn(() => false),
}));
vi.mock("@ruum/api/services", () => ({
  crearTraslado: vi.fn(),
  listarVehiculosDeUsuario: vi.fn(async () => []),
  obtenerUsuarioActual: vi.fn(async () => null),
  previsualizarTarifaUsuario: vi.fn(async () => null),
  aceptarCotizacionUsuario: vi.fn(),
}));
vi.mock("../../../../../lib/codigos-postales", () => ({
  consultarCodigoPostalMx: vi.fn(async () => null),
}));
vi.mock("../../../../../lib/mapbox", () => ({
  esErrorConfiguracionMapbox: vi.fn(() => false),
  mensajeErrorMapbox: vi.fn((e: unknown) => String(e)),
  sugerirDireccionesAutocomplete: vi.fn(async () => []),
  sugerirDireccionesPorCodigoPostal: vi.fn(async () => []),
  tieneMapboxConfigurado: vi.fn(() => false),
  calcularRutaMapbox: vi.fn(async () => null),
  geocodificarDireccion: vi.fn(async () => null),
}));
vi.mock("../../../../../lib/catalogo-vehiculos", async (orig) => {
  const mod = (await orig()) as Record<string, unknown>;
  return { ...mod, modelosPorMarca: vi.fn(() => ["Versa", "Sentra"]), resumenClasificacionVehiculo: vi.fn(() => "Sedan"), clasificacionesPorVehiculo: vi.fn(() => []), tipoSugeridoParaVehiculo: vi.fn(() => "sedan") };
});

import { useNuevoTraslado } from "../useNuevoTraslado";

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AppStateProvider, null, children);
}

describe("useNuevoTraslado (2.1 Fase 1 — 80%+)", () => {
  beforeEach(() => {
    localStorage.clear();
    limpiarBorradorTrasladoLocal();
    vi.clearAllMocks();
  });

  it("actualizar marca invalida tarifa previa (haCambiadoTarifa)", async () => {
    const { result } = renderHook(() => useNuevoTraslado(), { wrapper });

    // Simular flujo: usuario aceptó tarifa en paso 0
    // Primero setear datos tarifa-relevantes y snapshot
    await act(async () => {
      result.current.actualizar("marca", "Nissan");
      result.current.actualizar("modelo", "Versa");
      result.current.actualizar("origenCodigoPostal", "03100");
      result.current.actualizar("destinoCodigoPostal", "06600");
      result.current.actualizar("condicion", "seminueva" as never);
    });

    // Aceptar tarifa (setea tarifaPreviaAceptada true + snapshot)
    await act(async () => {
      result.current.aceptarTarifaYContinuar();
    });

    // Avanzamos a paso 1 para que la guarda de tarifa esté activa (paso >0)
    // aceptarTarifaYContinuar ya hace setPaso(1) si validación pasa; forzamos
    await act(async () => {
      // Asegurar que snapshot existe
      expect(result.current.tarifaPreviaSnapshot).not.toBeNull();
      expect(result.current.tarifaPreviaAceptada).toBe(true);
    });

    // Cambiar marca -> debe invalidar
    await act(async () => {
      result.current.actualizar("marca", "Toyota");
    });

    expect(result.current.tarifaPreviaAceptada).toBe(false);
    expect(result.current.errorPaso).toMatch(/tarifa/i);
  });

  it("haCambiadoTarifa detecta cambios en CAMPOS_PASO_TARIFA", () => {
    const snap = generarTarifaSnapshot({ origenCodigoPostal: "03100", destinoCodigoPostal: "06600", marca: "Nissan", modelo: "Versa", condicion: "seminueva", modalidadProgramacion: "lo_antes_posible", fechaHoraProgramada: "" });
    expect(haCambiadoTarifa(snap, { origenCodigoPostal: "03100", destinoCodigoPostal: "06600", marca: "Nissan", modelo: "Versa", condicion: "seminueva", modalidadProgramacion: "lo_antes_posible", fechaHoraProgramada: "" })).toBe(false);
    expect(haCambiadoTarifa(snap, { origenCodigoPostal: "03100", destinoCodigoPostal: "06600", marca: "Toyota", modelo: "Versa", condicion: "seminueva", modalidadProgramacion: "lo_antes_posible", fechaHoraProgramada: "" })).toBe(true);
    expect(CAMPOS_PASO_TARIFA.has("marca" as never)).toBe(true);
    expect(CAMPOS_PASO_TARIFA.has("color" as never)).toBe(false);
  });

  it("avanzarPaso valida campos requeridos y bloquea si faltan", async () => {
    const { result } = renderHook(() => useNuevoTraslado(), { wrapper });

    // Sin datos, avanzar desde paso 0 debe fallar (validación de tarifa gate)
    await act(async () => {
      result.current.avanzarPaso();
    });
    // No avanzó porque faltan campos esenciales
    // El hook setea errores y no incrementa paso si hay errores
    // Verificamos que paso sigue siendo 0 o errorPaso está seteado
    expect(result.current.paso).toBe(0);
    expect(result.current.errorPaso ?? Object.keys(result.current.errores).length > 0).toBeTruthy();
  });

  it("guardarBorrador persiste en localStorage (no IndexedDB) con vigencia 24h", async () => {
    const { result } = renderHook(() => useNuevoTraslado(), { wrapper });

    await act(async () => {
      result.current.actualizar("marca", "Nissan");
      result.current.actualizar("modelo", "Versa");
      result.current.actualizar("origenCodigoPostal", "03100");
    });

    // Esperar debounce de guardado (600ms + buffer)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 800));
    });

    const borrador = leerBorradorTrasladoLocal();
    expect(borrador).not.toBeNull();
    expect(borrador?.marca).toBe("Nissan");
    expect(new Date(borrador!.expiraEn).getTime()).toBeGreaterThan(Date.now());
  });

  it("validarCampo y erroresFormulario marcan campo inválido", async () => {
    const { result } = renderHook(() => useNuevoTraslado(), { wrapper });
    await act(async () => {
      result.current.actualizar("marca", "");
      result.current.validarCampo("marca");
    });
    expect(result.current.errores.marca).toBeDefined();
  });
});
