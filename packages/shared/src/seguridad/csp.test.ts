import { describe, expect, it } from "vitest";
import {
  buildCsp,
  buildCspEstatico,
  CSP_PRESETS,
  IMAGES_REMOTE_PATTERNS,
} from "./csp";

describe("seguridad/csp — invariantes SEC-002/SEC-003", () => {
  it("prod con nonce: script-src con nonce + strict-dynamic, sin unsafe-*", () => {
    for (const app of ["conductor", "usuario", "panel"] as const) {
      const csp = buildCsp({ nonce: "abc123", isProd: true, extras: CSP_PRESETS[app] });
      const script = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
      expect(script).toContain("'nonce-abc123'");
      expect(script).toContain("'strict-dynamic'");
      expect(script).not.toContain("'unsafe-inline'");
      expect(script).not.toContain("'unsafe-eval'");
    }
  });

  it("fallback estático prod: sin unsafe-inline ni unsafe-eval en script-src", () => {
    for (const app of ["conductor", "usuario", "panel"] as const) {
      const csp = buildCspEstatico(true, CSP_PRESETS[app]);
      const script = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
      expect(script).toContain("'strict-dynamic'");
      expect(script).not.toContain("'unsafe-inline'");
      expect(script).not.toContain("'unsafe-eval'");
    }
  });

  it("dev: script-src con unsafe-inline + unsafe-eval (HMR)", () => {
    const csp = buildCsp({ nonce: "n", isProd: false, extras: CSP_PRESETS.conductor });
    const script = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(script).toContain("'unsafe-inline'");
    expect(script).toContain("'unsafe-eval'");
  });

  it("strictStyles elimina unsafe-inline de style-src en prod", () => {
    const csp = buildCsp({
      nonce: "n",
      isProd: true,
      strictStyles: true,
      extras: CSP_PRESETS.panel,
    });
    const style = csp.split(";").find((d) => d.trim().startsWith("style-src")) ?? "";
    expect(style).not.toContain("'unsafe-inline'");
  });

  it("images unificado cubre supabase/mapbox/didit/stripe", () => {
    const hosts = IMAGES_REMOTE_PATTERNS.map((p) => p.hostname).join(" ");
    for (const h of ["supabase.co", "supabase.in", "mapbox.com", "didit.me", "stripe.com"]) {
      expect(hosts).toContain(h);
    }
  });
});
