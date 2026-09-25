import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ refresh: false }));
vi.mock("@ruum/api/supabase", () => ({
  crearClienteServidor: (_url: string, _key: string, cookies: { setAll: (values: unknown[]) => void }) => ({
    auth: {
      getUser: async () => {
        if (auth.refresh) cookies.setAll([{ name: "session", value: "renewed", options: { httpOnly: true } }]);
        return { data: { user: null } };
      },
    },
  }),
}));
vi.mock("@ruum/api/operations", () => ({
  obtenerAdminSesion: vi.fn(),
  registrarAccesoDenegado: vi.fn(),
  verificarPermisoRuta: vi.fn(),
}));

import { middleware } from "./middleware";

afterEach(() => vi.unstubAllEnvs());

describe("CSP del panel en producción", () => {
  it.each([false, true])("propaga el nonce al renderer y al navegador (refresh=%s)", async (refresh) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_PANEL_ADMIN_DEMO", "false");
    auth.refresh = refresh;
    const response = await middleware(new NextRequest("https://panel.example/login", {
      headers: { "x-nonce": "untrusted", "Content-Security-Policy": "script-src 'unsafe-inline'", cookie: "existing=kept" },
    }));
    const nonce = response.headers.get("x-middleware-request-x-nonce");
    const csp = response.headers.get("Content-Security-Policy");
    expect(nonce).toBeTruthy();
    expect(nonce).not.toBe("untrusted");
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp?.match(/(?:^|; )script-src ([^;]+)/)?.[1]).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    if (refresh) {
      expect(response.headers.get("x-middleware-request-cookie")).toContain("session=renewed");
      expect(response.headers.get("x-middleware-request-cookie")).toContain("existing=kept");
      expect(response.cookies.get("session")?.value).toBe("renewed");
    }
  });
});
