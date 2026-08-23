import { describe, expect, it, vi } from "vitest";
import {
  extraerRutaComprobante,
  extraerRutaIncidencia,
  firmarUrlsEvidencia,
  resolverUrlEvidencia,
  rutaEvidenciaDesdeUrl
} from "./evidencia";

function clienteSupabaseMock(error: Error | null = null) {
  const createSignedUrl = vi.fn(async (path: string) => ({
    data: error ? null : { signedUrl: `https://signed.test/${path}` },
    error
  }));
  return {
    cliente: {
      storage: {
        from: vi.fn(() => ({ createSignedUrl }))
      }
    },
    createSignedUrl
  };
}

describe("resolver URLs privadas de evidencia", () => {
  it("usa como path relativo los valores nuevos guardados en evidencia_fotos.url", () => {
    expect(rutaEvidenciaDesdeUrl("auth-user/traslado/inicial/foto.jpg")).toBe(
      "auth-user/traslado/inicial/foto.jpg"
    );
  });

  it("extrae el path desde URLs publicas historicas de Supabase Storage", () => {
    expect(
      rutaEvidenciaDesdeUrl(
        "https://proyecto.supabase.co/storage/v1/object/public/evidencia/auth-user/traslado/foto%201.jpg"
      )
    ).toBe("auth-user/traslado/foto 1.jpg");
  });

  it("extrae el path desde URLs firmadas (/storage/v1/object/sign/)", () => {
    expect(
      rutaEvidenciaDesdeUrl(
        "https://proyecto.supabase.co/storage/v1/object/sign/evidencia/auth-user/traslado/gastos/ticket.jpg?token=eyJhbGciOi..."
      )
    ).toBe("auth-user/traslado/gastos/ticket.jpg");
  });

  it("no renderiza URLs externas como evidencia privada", () => {
    expect(rutaEvidenciaDesdeUrl("https://cdn.test/auth-user/traslado/foto.jpg")).toBeNull();
  });

  it("genera URL firmada temporal desde el bucket privado", async () => {
    const supabase = clienteSupabaseMock();

    await expect(resolverUrlEvidencia(supabase.cliente as never, "auth-user/traslado/foto.jpg")).resolves.toBe(
      "https://signed.test/auth-user/traslado/foto.jpg"
    );

    expect(supabase.cliente.storage.from).toHaveBeenCalledWith("evidencia");
    expect(supabase.createSignedUrl).toHaveBeenCalledWith("auth-user/traslado/foto.jpg", 60 * 30);
  });

  it("firma listas de fotos sin conservar fallback publico", async () => {
    const supabase = clienteSupabaseMock();

    await expect(
      firmarUrlsEvidencia(supabase.cliente as never, [
        { id: "foto-1", url: "auth-user/traslado/foto.jpg" },
        { id: "foto-2", url: "https://externo.test/foto.jpg" }
      ])
    ).resolves.toEqual([
      { id: "foto-1", url: "auth-user/traslado/foto.jpg", url_visual: "https://signed.test/auth-user/traslado/foto.jpg" },
      { id: "foto-2", url: "https://externo.test/foto.jpg", url_visual: null }
    ]);
  });
});

describe("P1 - Extracción y saneamiento de rutas para gastos e incidencias", () => {
  describe("extraerRutaComprobante", () => {
    it("prioriza la columna dedicada comprobante_ruta si está presente", () => {
      const res = extraerRutaComprobante("Gasto de gasolina Magna", "auth-123/tras-456/gastos/ticket.jpg");
      expect(res.ruta).toBe("auth-123/tras-456/gastos/ticket.jpg");
      expect(res.texto).toBe("Gasto de gasolina Magna");
    });

    it("extrae la ruta desde tags estructurados [COMPROBANTE_RUTA: ...]", () => {
      const res = extraerRutaComprobante("[COMPROBANTE_RUTA: auth-123/tras-456/gastos/ticket.jpg] Casetas autopista");
      expect(res.ruta).toBe("auth-123/tras-456/gastos/ticket.jpg");
      expect(res.texto).toBe("Casetas autopista");
    });

    it("sanea registros legados con signed URLs en [COMPROBANTE: ...] extrayendo solo la ruta privada", () => {
      const signedUrl = "https://supabase.co/storage/v1/object/sign/evidencia/user-1/trip-2/gastos/recibo.pdf?token=abc123secret";
      const res = extraerRutaComprobante(`[COMPROBANTE: ${signedUrl}] Pago de maniobra`);
      expect(res.ruta).toBe("user-1/trip-2/gastos/recibo.pdf");
      expect(res.texto).toBe("Pago de maniobra");
      expect(res.texto).not.toContain("token");
      expect(res.texto).not.toContain("/object/sign/");
    });
  });

  describe("extraerRutaIncidencia", () => {
    it("extrae la ruta privada y nombre de evidencia de la descripción", () => {
      const desc = "Vehículo no enciende\n\nFalla en marcha\n\nEvidencia adjunta: tablero.jpg\nRuta: user-1/trip-2/incidencias/123-tablero.jpg";
      const res = extraerRutaIncidencia(desc);
      expect(res.ruta).toBe("user-1/trip-2/incidencias/123-tablero.jpg");
      expect(res.nombre).toBe("tablero.jpg");
      expect(res.textoLimpio).toContain("Vehículo no enciende");
      expect(res.textoLimpio).toContain("Falla en marcha");
      expect(res.textoLimpio).not.toContain("URL temporal");
    });

    it("sanea URLs temporales y tokens históricos de la descripción de incidencias", () => {
      const desc = "Colisión leve\n\nGolpe en defensa\n\nEvidencia adjunta: foto.jpg\nRuta: u1/t1/incidencias/foto.jpg\nURL temporal: https://supabase.co/storage/v1/object/sign/evidencia/u1/t1/incidencias/foto.jpg?token=secret123";
      const res = extraerRutaIncidencia(desc);
      expect(res.ruta).toBe("u1/t1/incidencias/foto.jpg");
      expect(res.nombre).toBe("foto.jpg");
      expect(res.textoLimpio).not.toContain("URL temporal:");
      expect(res.textoLimpio).not.toContain("secret123");
      expect(res.textoLimpio).not.toContain("/object/sign/");
    });
  });
});
