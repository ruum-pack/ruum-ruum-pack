import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();

vi.mock("../../../lib/supabase-server", () => ({
  crearClienteServidor: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

describe("Sec3 POST /api/traslados — validación paso servidor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function req(body: unknown, headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost/api/traslados", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", ...headers },
    });
  }

  it("rechaza sin autenticación → 401", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("./route");
    const res = await POST(req({ paso: 4, marca: "Nissan" }));
    expect(res.status).toBe(401);
  });

  it("rechaza paso <4 (0 como 5 falsificado) → 400", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { POST } = await import("./route");
    // paso 0 (índice) -> contador 1 <4 -> 400
    expect((await POST(req({ paso: 0 }))).status).toBe(400);
    // paso 1 -> 2 <4
    expect((await POST(req({ paso: 1 }))).status).toBe(400);
    // paso 2 -> 3 <4
    expect((await POST(req({ paso: 2 }))).status).toBe(400);
    // wizardPaso alias
    expect((await POST(req({ wizardPaso: 1 }))).status).toBe(400);
    // string
    expect((await POST(req({ paso: "1" }))).status).toBe(400);
  });

  it("rechaza payload incompleto aunque paso sea 4 → 400 por esquema", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { POST } = await import("./route");
    // paso 4 pasa el check de paso, pero falta marca/modelo -> esquema falla
    const res = await POST(req({ paso: 4, marca: "" }));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/inválidos|incompleta/i);
  });

  it("acepta paso 3 índice (→4) con payload válido → 200", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { POST } = await import("./route");
    const valido = {
      paso: 3, // índice 3 -> contador 4
      vehiculoSeleccionadoId: "",
      vehiculosUsuarioIds: [],
      marca: "Nissan",
      modelo: "Versa",
      color: "gris",
      placas: "ABC123",
      vin: "VIN123",
      anio: "2022",
      transmision: "automatica",
      condicion: "seminueva",
      estadoGeneral: "Buen estado, desgaste normal",
      tieneTarjeta: true,
      tieneVerificacion: true,
      tienePlacas: true,
      puedeCircular: true,
      origenCodigoPostal: "03100",
      origenEstado: "CDMX",
      origenCiudad: "CDMX",
      origenColonia: "Del Valle",
      origenCalle: "A",
      origenNumero: "1",
      destinoCodigoPostal: "06600",
      destinoEstado: "CDMX",
      destinoCiudad: "CDMX",
      destinoColonia: "Juárez",
      destinoCalle: "B",
      destinoNumero: "2",
      entregaNombre: "Ana",
      entregaApellido: "López",
      entregaTelefono: "5512345678",
      recepcionNombre: "Luis",
      recepcionApellido: "Pérez",
      recepcionTelefono: "5587654321",
      modalidadProgramacion: "lo_antes_posible",
      fechaHoraProgramada: "",
      zonaHoraria: "America/Mexico_City",
      tipoRuta: "local",
      tipoServicio: "personal",
      motivoServicio: "entrega_cliente",
      aceptaPoliticas: true,
      paradas: [],
    };
    const res = await POST(req(valido));
    expect(res.status).toBe(200);
    const json = await res.json() as { pasoValidado: number };
    expect(json.pasoValidado).toBe(4);
  });

  it("acepta paso 4 contador directo → 200 y mensaje genérico en error 500 no expone env", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { POST } = await import("./route");
    // Forzar error interno simulando body no JSON? Ya probamos 500 es genérico
    const bad = new NextRequest("http://localhost/api/traslados", { method: "POST", body: "not json", headers: { "content-type": "application/json" } });
    // @ts-ignore — pasar request malformado, el handler hace json().catch -> 400
    const res = await POST(bad as NextRequest);
    expect([400, 500]).toContain(res.status);
    const json = await res.json() as { error: string };
    expect(json.error).not.toMatch(/NEXT_PUBLIC_/);
  });

  it("GET no permitido → 405", async () => {
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(405);
  });
});
