import { describe, expect, it } from "vitest";

import { itemColaAFotoEvidencia } from "../src/app/viajes/[id]/evidencia/useEvidenceQueue";

describe("useEvidenceQueue", () => {
  it("presenta una foto local pendiente como evidencia no sincronizada", () => {
    expect(
      itemColaAFotoEvidencia({
        localId: "local-1",
        trasladoId: "traslado-1",
        tipo: "final",
        angulo: "lateral_derecho",
        dataUrl: "data:image/jpeg;base64,Zm90bw==",
        lat: 19.4326,
        lng: -99.1332,
        capturadaEn: "2026-07-17T12:00:00.000Z"
      })
    ).toEqual({
      id: "local-1",
      traslado_id: "traslado-1",
      tipo: "final",
      angulo: "lateral_derecho",
      local_path: "data:image/jpeg;base64,Zm90bw==",
      timestamp: "2026-07-17T12:00:00.000Z",
      lat: 19.4326,
      lng: -99.1332,
      sincronizada: false
    });
  });
});
