import { describe, expect, it, vi } from "vitest";

// `redirect()` de Next.js interrumpe el render lanzando un objeto especial;
// aquí lo simulamos lanzando un Error con el destino, para poder capturarlo
// en cada test con try/catch.
const redirectMock = vi.fn((destino: string) => {
  throw new Error(`NEXT_REDIRECT:${destino}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

async function destinoDeLaRaiz(parametros: Record<string, string | string[] | undefined>) {
  const { default: PaginaInicioConductor } = await import("../src/app/page");
  try {
    await PaginaInicioConductor({ searchParams: Promise.resolve(parametros) });
  } catch (err) {
    return (err as Error).message.replace("NEXT_REDIRECT:", "");
  }
  throw new Error("Se esperaba un redirect() y no ocurrió");
}

describe("raíz de app-conductor (/)", () => {
  it("sin parámetros de confirmación, redirige al onboarding como antes", async () => {
    expect(await destinoDeLaRaiz({})).toBe("/onboarding");
  });

  it("reenvía el `code` de confirmación (flujo PKCE) a /auth/callback en vez de perderlo", async () => {
    const destino = await destinoDeLaRaiz({ code: "abc123" });
    expect(destino.startsWith("/auth/callback?")).toBe(true);
    expect(new URLSearchParams(destino.split("?")[1]).get("code")).toBe("abc123");
  });

  it("reenvía `token_hash` y `type` juntos (flujo OTP/hash) a /auth/callback", async () => {
    const destino = await destinoDeLaRaiz({ token_hash: "xyz789", type: "signup" });
    const query = new URLSearchParams(destino.split("?")[1]);
    expect(destino.startsWith("/auth/callback?")).toBe(true);
    expect(query.get("token_hash")).toBe("xyz789");
    expect(query.get("type")).toBe("signup");
  });

  it("ignora parámetros irrelevantes (sin code/token_hash) y sigue yendo a onboarding", async () => {
    expect(await destinoDeLaRaiz({ utm_source: "correo" })).toBe("/onboarding");
  });
});
