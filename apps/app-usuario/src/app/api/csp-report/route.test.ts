import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET, HEAD } from "./route";
import { MAX_BODY, __clearCspRateLimitForTest } from "../../../lib/csp-rate-limit";

describe("R14 csp-report — rate-limit distribuido + límites", () => {
  beforeEach(() => {
    __clearCspRateLimitForTest();
    vi.restoreAllMocks();
  });

  function req(body: string, headers: Record<string, string> = {}, ip = "1.1.1.1") {
    return new NextRequest("http://localhost/api/csp-report", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/csp-report",
        "x-forwarded-for": ip,
        ...headers,
      },
    });
  }

  it("POST normal → 204", async () => {
    const res = await POST(req(JSON.stringify({ "csp-report": { "violated-directive": "script-src" } })));
    expect(res.status).toBe(204);
  });

  it("body > MAX_BODY*2 con Content-Length → 413", async () => {
    const big = "a".repeat(MAX_BODY * 2 + 1);
    const res = await POST(req(big, { "content-length": String(big.length) }));
    expect(res.status).toBe(413);
  });

  it("N+1 requests dentro de la ventana → 429 con Retry-After", async () => {
    const ip = "2.2.2.2";
    // 10 permitidas
    for (let i = 0; i < 10; i++) {
      const r = await POST(req(JSON.stringify({ "csp-report": { "violated-directive": "script-src" } }), {}, ip));
      expect(r.status).toBe(204);
    }
    // 11ª debe ser 429
    const blocked = await POST(req(JSON.stringify({ "csp-report": { "violated-directive": "script-src" } }), {}, ip));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeDefined();
    const retry = Number(blocked.headers.get("Retry-After"));
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(60);
  });

  it("GET y HEAD responden 204 sin rate-limit", async () => {
    expect((await GET()).status).toBe(204);
    expect((await HEAD()).status).toBe(204);
  });

  it("diferentes IPs tienen contadores independientes", async () => {
    const ipA = "3.3.3.3";
    const ipB = "4.4.4.4";
    for (let i = 0; i < 10; i++) {
      expect((await POST(req("{}", {}, ipA))).status).toBe(204);
    }
    expect((await POST(req("{}", {}, ipA))).status).toBe(429);
    // B aún permitido
    expect((await POST(req("{}", {}, ipB))).status).toBe(204);
  });
});
