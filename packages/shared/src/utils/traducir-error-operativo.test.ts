import { describe,expect,it } from "vitest";
import { traducirErrorOperativo } from "./traducir-error-operativo";

describe("traducción de errores operativos",()=>{
  it.each([
    ["conductor_duplicado:curp","Este CURP ya está asociado a otra solicitud."],
    ["La licencia está vencida.","Tu licencia está vencida. Actualiza la vigencia para continuar."],
    ["JWT expired","Tu sesión expiró; vuelve a verificar tu cuenta."],
    ["duplicate key value violates unique constraint foo","Ya existe un registro con esos datos. Revisa la información capturada."],
    ["storage upload failed","No pudimos registrar uno de tus documentos. Revisa el archivo e intenta nuevamente."]
  ])("traduce %s",(entrada,salida)=>expect(traducirErrorOperativo({message:entrada})).toBe(salida));
  it("nunca expone un error técnico desconocido",()=>{
    expect(traducirErrorOperativo({message:"PostgREST PGRST999"},"No pudimos continuar.")).toBe("No pudimos continuar.");
  });
});
