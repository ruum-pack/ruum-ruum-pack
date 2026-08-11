import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón que test/root-page-auth-redirect.test.ts: mockeamos las
// dependencias externas del Route Handler para poder invocarlo directamente
// como función y revisar a dónde redirige, sin levantar un servidor real.

const verifyOtpMock = vi.fn();
const exchangeCodeForSessionMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {}
  }))
}));

vi.mock("@ruum/api/supabase", () => ({
  crearClienteServidor: vi.fn(() => ({
    auth: {
      verifyOtp: verifyOtpMock,
      exchangeCodeForSession: exchangeCodeForSessionMock
    }
  }))
}));

vi.mock("@ruum/api/services", () => ({
  obtenerConductorActual: vi.fn(),
  obtenerSolicitudConductorActual: vi.fn()
}));

async function ejecutarCallback(query: string) {
  const { GET } = await import("../src/app/auth/callback/route");
  const request = new NextRequest(`https://conductor.ruumruum.mx/auth/callback${query}`);
  const respuesta = await GET(request);
  return respuesta.headers.get("location");
}

describe("/auth/callback — rama de recuperación de contraseña", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    verifyOtpMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it("sin Supabase configurado, cae al fallback de /recuperar-password (no /registro)", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    const destino = await ejecutarCallback("?type=recovery&token_hash=abc123");
    expect(destino).toBe("https://conductor.ruumruum.mx/recuperar-password?error=enlace_invalido");
  });

  it("sin Supabase configurado y sin type=recovery, cae al fallback genérico de /registro", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    const destino = await ejecutarCallback("?token_hash=abc123");
    expect(destino).toBe("https://conductor.ruumruum.mx/registro?error=enlace_invalido");
  });

  it("con token_hash válido y type=recovery, redirige a /nueva-password", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-prueba";
    verifyOtpMock.mockResolvedValue({ error: null });

    const destino = await ejecutarCallback("?type=recovery&token_hash=token-valido");
    expect(destino).toBe("https://conductor.ruumruum.mx/nueva-password");
    expect(verifyOtpMock).toHaveBeenCalledWith({ type: "recovery", token_hash: "token-valido" });
  });

  it("con code (PKCE) y type=recovery, redirige a /nueva-password sin consultar el estado del conductor", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-prueba";
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const destino = await ejecutarCallback("?type=recovery&code=codigo-valido");
    expect(destino).toBe("https://conductor.ruumruum.mx/nueva-password");
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("codigo-valido");
  });

  it("si verifyOtp falla, redirige a /recuperar-password?error=enlace_invalido (no a /nueva-password ni a /registro)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-prueba";
    verifyOtpMock.mockResolvedValue({ error: { message: "Token has expired" } });

    const destino = await ejecutarCallback("?type=recovery&token_hash=token-expirado");
    expect(destino).toBe("https://conductor.ruumruum.mx/recuperar-password?error=enlace_invalido");
  });

  it("un enlace de recuperación nunca debe caer en /registro?verificado=1 (mezclaría flujos)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-prueba";
    verifyOtpMock.mockResolvedValue({ error: null });

    const destino = await ejecutarCallback("?type=recovery&token_hash=token-valido");
    expect(destino).not.toContain("/registro");
  });
});
