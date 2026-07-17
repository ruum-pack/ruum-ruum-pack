import { describe, expect, it, vi } from "vitest";
import { firmarUrlsEvidencia, resolverUrlEvidencia, rutaEvidenciaDesdeUrl } from "./evidencia";

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
