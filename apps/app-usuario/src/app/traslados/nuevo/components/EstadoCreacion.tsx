import { Aviso } from "@ruum/ui";
import { NavegacionUsuario } from "../../../NavegacionUsuario";

export function EstadoCreacion({ resultado, volver }: { resultado: { ok: boolean; mensaje: string }; volver: () => void }) {
  return <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
    <NavegacionUsuario variante="claro" />
    <div className="user-v2-content user-v2-content--wide py-20">
      <Aviso tono={resultado.ok ? "info" : "danger"}>{resultado.mensaje}</Aviso>
      <div className="mt-6">
        {resultado.ok ? <a href="/mis-viajes" className="user-v2-primary-button inline-flex w-full items-center justify-center px-4 py-2 sm:w-auto">Ver mis traslados</a> :
          <button type="button" onClick={volver} className="user-v2-secondary-button inline-flex w-full items-center justify-center px-4 py-2 sm:w-auto">← Volver al formulario</button>}
      </div>
    </div>
  </main>;
}
