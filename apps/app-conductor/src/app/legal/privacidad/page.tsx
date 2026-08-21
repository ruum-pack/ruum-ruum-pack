import Link from "next/link";
import appVersion from "../../../../../../config/app-version.json";

export const metadata = {
  title: "Aviso de privacidad — Ruum Ruum Conductor"
};

export default function PaginaPrivacidadConductor() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Cabecera de retorno accesible e in-app */}
      <div className="mb-6">
        <Link
          href="/cuenta/legal"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 font-display text-xs font-bold text-text-primary shadow-2xs transition hover:border-signal hover:bg-surface-elevated"
        >
          ← Volver a documentos legales
        </Link>
      </div>

      <article className="rounded-2xl border border-border/80 bg-surface px-6 py-8 text-text-primary shadow-md sm:px-10">
        <header className="mb-8 border-b border-border/60 pb-6">
          <div className="flex items-center gap-2">
            <span className="font-body text-xs font-bold uppercase tracking-wider text-route-action">
              Documento Legal Oficial
            </span>
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-body text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">
              v{appVersion.version} • Vigente
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-text-primary sm:text-3xl">
            Aviso de Privacidad de Datos
          </h1>
          <p className="mt-1.5 font-body text-xs text-text-tertiary">
            Ruum Ruum by Movilia • Última actualización: 3 de julio de 2026 • App v{appVersion.version} (mín. {appVersion.minimumSupported})
          </p>
        </header>

        <div className="space-y-6 font-body text-sm leading-7 text-text-secondary">
          <p>
            En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares
            (LFPDPPP), Moviliax S.A. de C.V. (&quot;Ruum Ruum&quot;) pone a su disposición el presente Aviso de
            Privacidad, aplicable a los datos que recaba de las personas que se registran como Conductor.
          </p>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">1. Responsable del Tratamiento</h2>
            <p>Moviliax S.A. de C.V., con domicilio en la Ciudad de México, es la entidad responsable del tratamiento de sus datos personales.</p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">2. Datos Personales Recabados</h2>
            <p>
              Para el registro como Conductor, Ruum Ruum recaba: nombre completo, CURP, correo electrónico, número
              de teléfono celular, domicilio completo, número y vigencia de licencia de conducir, imagen de la
              licencia (frente y reverso) e identificación oficial, así como los datos del contacto de emergencia
              que usted proporcione.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">3. Finalidades del Tratamiento</h2>
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
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">4. Transferencia de Datos</h2>
            <p>
              Ruum Ruum no comparte sus datos personales con terceros para fines comerciales. Su información puede
              compartirse con autoridades competentes cuando así lo requiera la verificación de antecedentes que
              usted autorizó, y con el Usuario únicamente en la medida necesaria para ejecutar el traslado
              contratado (nombre, calificación, nivel CONCER).
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">5. Derechos ARCO</h2>
            <p>
              Tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales. Para
              ejercer estos derechos, contacte a nuestro equipo de privacidad a través del Centro de ayuda dentro
              de la Plataforma.
            </p>
          </section>
        </div>

        <div className="mt-8 border-t border-border/60 pt-6">
          <a
            href="/docs-legales/aviso-de-privacidad-ruum-ruum.docx"
            download
            className="inline-flex items-center gap-2 font-body text-xs font-bold text-route-action underline-offset-4 hover:underline"
          >
            📥 Descargar versión completa (.docx)
          </a>
        </div>
      </article>
    </div>
  );
}
