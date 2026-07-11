import { Aviso } from "@ruum/ui";
import { NavegacionUsuario } from "../../../NavegacionUsuario";

export function EstadoCreacion({ resultado, volver }: { resultado: { ok: boolean; mensaje: string }; volver: () => void }) {
  return <main className="app-page">
    <NavegacionUsuario />
    <div className="mx-auto max-w-xl px-6 py-20">
      <Aviso tono={resultado.ok ? "info" : "peligro"}>{resultado.mensaje}</Aviso>
      <div className="mt-6">
        {resultado.ok ? <a href="/mis-viajes" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-signal px-4 py-2 font-display text-sm font-bold text-ink">Ver mis traslados</a> :
          <button type="button" onClick={volver} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-mist px-4 py-2 font-body text-sm font-medium text-ink">← Volver al formulario</button>}
      </div>
    </div>
  </main>;
}
