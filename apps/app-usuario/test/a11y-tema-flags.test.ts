import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn(async () => ({ data: null, error: null }));
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("../src/lib/supabase-browser", () => ({
  crearClienteNavegador: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom
  }))
}));

import {
  isFeatureEnabled,
  getFeatureFlagData,
  clearFeatureFlagCache
} from "../src/lib/feature-flags";
import conductorConfig from "../../app-conductor/capacitor.config";
import usuarioConfig from "../capacitor.config";

/**
 * PR-15 P2 — Cleanup Arquitectónico (Quick wins)
 * Pruebas:
 * 1. Caché TTL de feature flags
 * 2. Configuración Capacitor: server.url vs allowNavigation
 * 3. Seguridad de WebView en Capacitor (cleartext: false, allowMixedContent: false)
 */

describe("PR-15 — Cleanup Arquitectónico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFeatureFlagCache();
  });

  describe("1. Caché en memoria con TTL para Feature Flags", () => {
    it("guarda en caché la consulta a feature_flags_app y evita queries repetitivas", async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          habilitada: true,
          porcentaje_rollout: 100,
          versiones_permitidas: null
        },
        error: null
      });

      // Primera llamada: consulta la base de datos
      const data1 = await getFeatureFlagData("nuevo_flujo_pago");
      expect(data1).toEqual({
        habilitada: true,
        porcentaje_rollout: 100,
        versiones_permitidas: null
      });
      expect(mockFrom).toHaveBeenCalledTimes(1);

      // Segunda llamada inmediata: debe responder desde la caché en memoria (sin consultar BD)
      const data2 = await getFeatureFlagData("nuevo_flujo_pago");
      expect(data2).toEqual(data1);
      expect(mockFrom).toHaveBeenCalledTimes(1);

      // Limpiar caché y llamar de nuevo: debe consultar BD
      clearFeatureFlagCache();
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          habilitada: false,
          porcentaje_rollout: 0,
          versiones_permitidas: null
        },
        error: null
      });

      const data3 = await getFeatureFlagData("nuevo_flujo_pago");
      expect(data3?.habilitada).toBe(false);
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it("evalúa rollout determinista por usuario y versión", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          habilitada: true,
          porcentaje_rollout: 50,
          versiones_permitidas: ["1.0.0"]
        },
        error: null
      });

      process.env.NEXT_PUBLIC_APP_VERSION = "1.0.0";

      // Mismo usuario siempre recibe el mismo resultado
      const res1 = await isFeatureEnabled("experimento_ui", "user-abc-123");
      const res2 = await isFeatureEnabled("experimento_ui", "user-abc-123");
      expect(res1).toBe(res2);

      // Versión no permitida retorna false
      process.env.NEXT_PUBLIC_APP_VERSION = "0.9.0";
      const resVersionInvalida = await isFeatureEnabled("experimento_ui", "user-abc-123", true);
      expect(resVersionInvalida).toBe(false);
    });
  });

  describe("2. Configuración móvil Capacitor (server.url vs allowNavigation)", () => {
    it("app-conductor tiene configurado server.url, cleartext: false y allowNavigation canónico", () => {
      expect(conductorConfig.server?.androidScheme).toBe("https");
      expect(conductorConfig.server?.cleartext).toBe(false);
      expect(conductorConfig.android?.allowMixedContent).toBe(false);
      expect(conductorConfig.server?.url).toBeDefined();

      const allowNav = conductorConfig.server?.allowNavigation ?? [];
      expect(allowNav).toContain("*.ruumruum-moviliax.online");
      expect(allowNav).toContain("*.supabase.co");
      expect(allowNav).toContain("verify.didit.me");
      expect(allowNav).toContain("*.stripe.com");
      expect(allowNav).toContain("*.mapbox.com");
    });

    it("app-usuario tiene configurado server.url, cleartext: false y allowNavigation canónico", () => {
      expect(usuarioConfig.server?.androidScheme).toBe("https");
      expect(usuarioConfig.server?.cleartext).toBe(false);
      expect(usuarioConfig.android?.allowMixedContent).toBe(false);
      expect(usuarioConfig.server?.url).toBeDefined();

      const allowNav = usuarioConfig.server?.allowNavigation ?? [];
      expect(allowNav).toContain("*.ruumruum-moviliax.online");
      expect(allowNav).toContain("*.supabase.co");
      expect(allowNav).toContain("verify.didit.me");
      expect(allowNav).toContain("*.stripe.com");
      expect(allowNav).toContain("*.mapbox.com");
    });
  });
});
