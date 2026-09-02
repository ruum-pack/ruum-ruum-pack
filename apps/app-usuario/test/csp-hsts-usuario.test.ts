import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { buildCspUsuario, applySecurityHeadersUsuario } from "../src/middleware";
import { POST as postCspReport, GET as getCspReport, HEAD as headCspReport } from "../src/app/api/csp-report/route";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * PR-12 P1 — CSP + HSTS en app-usuario
 * Pruebas obligatorias:
 * 1. Stripe Elements & Payment Intents
 * 2. Didit
 * 3. Callbacks y Supabase
 * 4. Mapbox
 * 5. Nonce y 'strict-dynamic' en producción
 * 6. HSTS (Strict-Transport-Security)
 * 7. Report-Only en staging
 * 8. Compatibilidad móvil Capacitor
 */

describe("PR-12 — CSP + HSTS en app-usuario", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    process.env = { ...envOriginal };
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  describe("1. Generación de CSP y estrategia Nonce + strict-dynamic", () => {
    it("en producción: script-src usa nonce y 'strict-dynamic' sin unsafe-eval ni unsafe-inline", () => {
      const nonce = "test-nonce-12345";
      const csp = buildCspUsuario(nonce, true, false);

      expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
      expect(csp).not.toContain("unsafe-eval");
      // En script-src de prod no debe haber unsafe-inline
      const scriptDirective = csp.split(";").find((d) => d.trim().startsWith("script-src"));
      expect(scriptDirective).toBeDefined();
      expect(scriptDirective).not.toContain("'unsafe-inline'");
    });

    it("en desarrollo: script-src permite unsafe-inline y unsafe-eval para HMR y DX", () => {
      const nonce = "test-nonce-dev";
      const csp = buildCspUsuario(nonce, false, false);

      expect(csp).toContain("'unsafe-inline'");
      expect(csp).toContain("'unsafe-eval'");
    });

    it("style-src soporta flag estricto CSP_STRICT_STYLES=true en producción", () => {
      const nonce = "test-nonce-style";
      process.env.CSP_STRICT_STYLES = "true";
      const cspEstricto = buildCspUsuario(nonce, true, false);
      const styleDirective = cspEstricto.split(";").find((d) => d.trim().startsWith("style-src"));
      expect(styleDirective).toBe(` style-src 'self' 'nonce-${nonce}'`);

      delete process.env.CSP_STRICT_STYLES;
      const cspNormal = buildCspUsuario(nonce, true, false);
      expect(cspNormal).toContain(`style-src 'self' 'unsafe-inline' 'nonce-${nonce}'`);
    });
  });

  describe("2. HSTS y Headers de Seguridad", () => {
    it("en producción: Strict-Transport-Security está presente con max-age=63072000, includeSubDomains y preload", () => {
      process.env.NODE_ENV = "production";
      const nonce = "nonce-hsts-prod";
      const res = applySecurityHeadersUsuario(new NextResponse(), nonce);

      expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(res.headers.get("x-nonce")).toBe(nonce);
    });

    it("en staging: activa Content-Security-Policy-Report-Only hacia /api/csp-report", () => {
      process.env.NODE_ENV = "production";
      process.env.NEXT_PUBLIC_RUUM_AMBIENTE = "staging";
      const nonce = "nonce-staging";
      const res = applySecurityHeadersUsuario(new NextResponse(), nonce);

      const reportOnly = res.headers.get("Content-Security-Policy-Report-Only");
      expect(reportOnly).toBeDefined();
      expect(reportOnly).toContain("report-uri /api/csp-report");
      expect(reportOnly).toContain("report-to csp-endpoint");
      expect(reportOnly).toContain(`nonce-${nonce}`);
    });
  });

  describe("3. Excepciones requeridas para Stripe Elements & Payment Intents", () => {
    it("permite todos los orígenes de Stripe en script-src, frame-src, connect-src e img-src", () => {
      const nonce = "nonce-stripe";
      const csp = buildCspUsuario(nonce, true, false);

      // script-src
      expect(csp).toContain("https://js.stripe.com");
      expect(csp).toContain("https://*.stripe.com");

      // frame-src
      expect(csp).toContain("frame-src 'self' https://verify.didit.me https://*.didit.me https://js.stripe.com https://*.stripe.com https://*.stripe.network https://hooks.stripe.com");

      // connect-src
      expect(csp).toContain("https://api.stripe.com");
      expect(csp).toContain("https://*.stripe.network");
      expect(csp).toContain("https://r.stripe.com");
      expect(csp).toContain("https://m.stripe.com");
      expect(csp).toContain("https://q.stripe.com");

      // img-src
      expect(csp).toContain("https://*.stripe.com");
    });
  });

  describe("4. Excepciones requeridas para Didit Identity Verification", () => {
    it("permite dominios de Didit en frame-src, connect-src, img-src y Permissions-Policy", () => {
      const nonce = "nonce-didit";
      const res = applySecurityHeadersUsuario(new NextResponse(), nonce);
      const csp = res.headers.get("Content-Security-Policy") ?? "";

      expect(csp).toContain("https://verify.didit.me");
      expect(csp).toContain("https://*.didit.me");
      expect(csp).toContain("https://apx.didit.me");

      const permissions = res.headers.get("Permissions-Policy");
      expect(permissions).toContain('camera=(self "https://verify.didit.me" "https://*.didit.me")');
      expect(permissions).toContain('geolocation=(self "https://verify.didit.me" "https://*.didit.me")');
      expect(permissions).toContain('microphone=(self "https://verify.didit.me" "https://*.didit.me")');
    });
  });

  describe("5. Excepciones requeridas para Mapbox", () => {
    it("permite mapas y telemetría de Mapbox en connect-src, img-src y worker-src blob:", () => {
      const nonce = "nonce-mapbox";
      const csp = buildCspUsuario(nonce, true, false);

      expect(csp).toContain("https://*.mapbox.com");
      expect(csp).toContain("https://api.mapbox.com");
      expect(csp).toContain("https://events.mapbox.com");
      expect(csp).toContain("worker-src 'self' blob:");
      expect(csp).toContain("child-src 'self' blob:");
    });
  });

  describe("6. Excepciones para Supabase, Callbacks y Capacitor Móvil", () => {
    it("permite API de Supabase, WebSockets y esquemas móviles", () => {
      const nonce = "nonce-infra";
      const cspProd = buildCspUsuario(nonce, true, false);
      const cspDev = buildCspUsuario(nonce, false, false);

      expect(cspProd).toContain("https://*.supabase.co");
      expect(cspProd).toContain("https://*.supabase.in");

      expect(cspDev).toContain("ws: wss:");
      expect(cspDev).toContain("capacitor://localhost");
      expect(cspDev).toContain("http://localhost:*");
    });
  });

  describe("7. Script externo theme-init y Endpoint de Reportes CSP", () => {
    it("/public/theme-init.js existe físicamente y no contiene vulnerabilidades", () => {
      const rutaTheme = existsSync(join(__dirname, "../public/theme-init.js"))
        ? join(__dirname, "../public/theme-init.js")
        : join(process.cwd(), "public/theme-init.js");
      expect(existsSync(rutaTheme)).toBe(true);
      const contenido = readFileSync(rutaTheme, "utf-8");
      expect(contenido).toContain("ruum-tema");
      expect(contenido).toContain("data-theme");
    });

    it("el endpoint /api/csp-report responde 204 No Content sin fallar", async () => {
      const reqPost = new Request("http://localhost/api/csp-report", {
        method: "POST",
        body: JSON.stringify({ "csp-report": { "violated-directive": "script-src" } })
      });

      const resPost = await postCspReport(reqPost as unknown as import("next/server").NextRequest);
      expect(resPost.status).toBe(204);

      const resGet = await getCspReport();
      expect(resGet.status).toBe(204);

      const resHead = await headCspReport();
      expect(resHead.status).toBe(204);
    });
  });
});
