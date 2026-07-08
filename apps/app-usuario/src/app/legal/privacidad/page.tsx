import Link from "next/link";
import { NavegacionUsuario } from "../../NavegacionUsuario";

export const metadata = {
  title: "Aviso de privacidad — Ruum Ruum",
};

export default function PaginaPrivacidad() {
  return (
    <main className="app-page">
      <NavegacionUsuario />
      <div className="app-container py-10 sm:py-14">
        <div className="mb-6">
          <Link
            href="/cuenta/legal"
            className="font-body text-sm text-ink/55 underline-offset-4 hover:underline"
          >
            ← Volver a Legal
          </Link>
        </div>

        <article className="app-card mx-auto max-w-3xl px-6 py-8 sm:px-10">
          <header className="mb-8 border-b border-ink/10 pb-6">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/40">
              Documento legal
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold">
              Aviso de privacidad
            </h1>
            <p className="mt-1 font-body text-sm text-ink/50">
              Ruum Ruum — vigente desde el 3 de julio de 2026
            </p>
          </header>

          <div className="space-y-6 font-body text-sm leading-7 text-ink/80">
            <p>
              En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión
              de los Particulares (LFPDPPP), Moviliax S.A. de C.V. (&quot;Ruum Ruum&quot;)
              pone a su disposición el presente Aviso de Privacidad.
            </p>

            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-ink">
                1. Responsable del tratamiento
              </h2>
              <p>
                Moviliax S.A. de C.V., con domicilio en la Ciudad de México, es la entidad
                responsable del tratamiento de sus datos personales.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-ink">
                2. Datos personales recabados
              </h2>
              <p>
                Ruum Ruum recaba los siguientes datos personales: nombre completo, correo
                electrónico, número de teléfono celular, domicilio, datos del vehículo
                (marca, modelo, año, placas, número de serie), e imagen de identificación
                oficial para verificación de identidad.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-ink">
                3. Finalidades del tratamiento
              </h2>
              <p>Sus datos se utilizan para:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Gestionar su cuenta y los traslados solicitados.</li>
                <li>Verificar su identidad y la del vehículo a trasladar.</li>
                <li>Generar el Pasaporte Digital con evidencia fotográfica.</li>
                <li>Procesar pagos y emitir comprobantes fiscales.</li>
                <li>Enviar notificaciones sobre el estado de su traslado.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-ink">
                4. Transferencia de datos
              </h2>
              <p>
                Ruum Ruum no comparte sus datos personales con terceros para fines comerciales.
                La información puede ser compartida con conductores certificados únicamente
                en la medida necesaria para ejecutar el traslado contratado.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-ink">
                5. Derechos ARCO
              </h2>
              <p>
                Tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de
                sus datos personales. Para ejercer estos derechos, contacte a nuestro
                equipo de privacidad a través del Centro de ayuda dentro de la Plataforma.
              </p>
            </section>
          </div>

          <div className="mt-8 border-t border-ink/10 pt-6">
            <a
              href="/docs-legales/aviso-de-privacidad-ruum-ruum.docx"
              download
              className="font-body text-sm text-route-dark underline-offset-4 hover:underline"
            >
              Descargar documento completo (.docx)
            </a>
          </div>
        </article>
      </div>
    </main>
  );
}
