import Link from "next/link";

export const metadata = {
  title: "Aviso de privacidad — Ruum Ruum Conductor"
};

export default function PaginaPrivacidadConductor() {
  return (
    <main className="conductor-page">
      <div className="conductor-content max-w-3xl">
        <div className="mb-6">
          <Link href="/registro" className="font-body text-sm text-text-secondary underline-offset-4 hover:underline">
            ← Volver al registro
          </Link>
        </div>

        <article className="rounded-2xl border border-border bg-white px-6 py-8 shadow-[0_1px_2px_rgba(26,31,46,0.08)] sm:px-10">
          <header className="mb-8 border-b border-border pb-6">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Documento legal</p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">Aviso de privacidad</h1>
            <p className="mt-1 font-body text-sm text-text-tertiary">Versión 1 · ruum ruum by Movilia — vigente desde el 3 de julio de 2026</p>
          </header>

          <div className="space-y-6 font-body text-sm leading-7 text-text-primary">
            <p>
              En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares
              (LFPDPPP), Moviliax S.A. de C.V. (&quot;Ruum Ruum&quot;) pone a su disposición el presente Aviso de
              Privacidad, aplicable a los datos que recaba de las personas que se registran como Conductor.
            </p>

            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-text-primary">1. Responsable del tratamiento</h2>
              <p>Moviliax S.A. de C.V., con domicilio en la Ciudad de México, es la entidad responsable del tratamiento de sus datos personales.</p>
            </section>

            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-text-primary">2. Datos personales recabados</h2>
              <p>
                Para el registro como Conductor, Ruum Ruum recaba: nombre completo, CURP, correo electrónico, número
                de teléfono celular, domicilio completo, número y vigencia de licencia de conducir, imagen de la
                licencia (frente y reverso) e identificación oficial, así como los datos del contacto de emergencia
                que usted proporcione.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-text-primary">3. Finalidades del tratamiento</h2>
              <p>Sus datos se utilizan para:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Verificar su identidad y elegibilidad para operar como Conductor certificado (CONCER).</li>
                <li>Realizar la verificación de antecedentes y de su historial de manejo que usted autorizó durante el registro.</li>
                <li>Gestionar su cuenta, sus traslados asignados y sus pagos.</li>
                <li>Generar el Pasaporte Digital con registro fotográfico del vehículo en cada traslado.</li>
                <li>Contactar a la persona indicada como contacto de emergencia únicamente en caso de una eventualidad durante un traslado.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-text-primary">4. Transferencia de datos</h2>
              <p>
                Ruum Ruum no comparte sus datos personales con terceros para fines comerciales. Su información puede
                compartirse con autoridades competentes cuando así lo requiera la verificación de antecedentes que
                usted autorizó, y con el Usuario únicamente en la medida necesaria para ejecutar el traslado
                contratado (nombre, calificación, nivel CONCER).
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-display text-base font-semibold text-text-primary">5. Derechos ARCO</h2>
              <p>
                Tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales. Para
                ejercer estos derechos, contacte a nuestro equipo de privacidad a través del Centro de ayuda dentro
                de la Plataforma.
              </p>
            </section>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <a
              href="/docs-legales/aviso-de-privacidad-ruum-ruum.docx"
              download
              className="font-body text-sm text-route-action underline-offset-4 hover:underline"
            >
              Descargar documento completo (.docx)
            </a>
          </div>
        </article>
      </div>
    </main>
  );
}
