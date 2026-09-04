import { describe, expect, it, vi } from "vitest";
import { crearTraslado } from "./traslados";

describe("crearTraslado service - validación preventiva", () => {
  const clienteMock = {
    rpc: vi.fn().mockResolvedValue({
      data: { id: "00000000-0000-0000-0000-000000000001", tipo_pago: "anticipado", precio_cotizado: 1200 },
      error: null
    })
  };

  it("rechaza llamada con clave de idempotencia que no sea UUID antes de llamar a la base de datos", async () => {
    const vehiculo = { vehiculoId: "11111111-1111-1111-1111-111111111111" };
    const traslado = {
      contacto_entrega_nombre: "Ana",
      contacto_entrega_telefono: "5512345678",
      contacto_recepcion_nombre: "Luis",
      contacto_recepcion_telefono: "5587654321",
      origen_lat: null,
      origen_lng: null,
      origen_direccion: "Calle 1",
      origen_ciudad: "CDMX",
      destino_lat: null,
      destino_lng: null,
      destino_direccion: "Calle 2",
      destino_ciudad: "CDMX"
    };

    await expect(
      crearTraslado(clienteMock as never, vehiculo, traslado, "clave-invalida-no-uuid", [])
    ).rejects.toThrow(/Datos de traslado inválidos/);

    expect(clienteMock.rpc).not.toHaveBeenCalled();
  });

  it("permite llamada válida y ejecuta la RPC", async () => {
    clienteMock.rpc.mockClear();
    const vehiculo = { vehiculoId: "11111111-1111-1111-1111-111111111111" };
    const traslado = {
      contacto_entrega_nombre: "Ana",
      contacto_entrega_telefono: "5512345678",
      contacto_recepcion_nombre: "Luis",
      contacto_recepcion_telefono: "5587654321",
      origen_lat: null,
      origen_lng: null,
      origen_direccion: "Calle 1",
      origen_ciudad: "CDMX",
      destino_lat: null,
      destino_lng: null,
      destino_direccion: "Calle 2",
      destino_ciudad: "CDMX"
    };
    const claveValida = "00000000-0000-0000-0000-000000000000";

    const res = await crearTraslado(clienteMock as never, vehiculo, traslado, claveValida, []);
    expect(res.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(clienteMock.rpc).toHaveBeenCalledWith("usuario_crea_traslado", expect.any(Object));
  });
});
