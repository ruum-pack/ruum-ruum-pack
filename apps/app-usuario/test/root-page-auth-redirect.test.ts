import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destino: string) => {
  throw new Error(`NEXT_REDIRECT:${destino}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("../src/lib/supabase-server", () => ({
  crearClienteServidor: vi.fn(async () => ({}))
}));

vi.mock("@ruum/api/services", () => ({
  obtenerUsuarioActual: vi.fn(async () => null),
  listarTrasladosDeUsuario: vi.fn(async () => [])
}));

async function destinoDeLaRaiz(parametros: Record<string, string | string[] | undefined> = {}) {
  const { default: PaginaInicio } = await import("../src/app/page");
  try {
    await PaginaInicio({ searchParams: Promise.resolve(parametros) });
  } catch (err) {
    return (err as Error).message.replace("NEXT_REDIRECT:", "");
  }
  return null;
}

describe("raíz de app-usuario (/)", () => {
  it("sin sesión activa, redirige inmediatamente a /login", async () => {
    const destino = await destinoDeLaRaiz({});
    expect(destino).toBe("/login");
  });

  it("con ?landing=true explícito, no redirige y permite renderizar landing pública", async () => {
    const destino = await destinoDeLaRaiz({ landing: "true" });
    expect(destino).toBeNull();
  });
});
