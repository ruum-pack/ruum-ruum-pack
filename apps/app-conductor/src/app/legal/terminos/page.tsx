import Link from "next/link";
import appVersion from "../../../../../../config/app-version.json";

export const metadata = {
  title: "Términos y condiciones — Ruum Ruum Conductor"
};

export default function PaginaTerminosConductor() {
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
            Términos y Condiciones de Uso
          </h1>
          <p className="mt-1.5 font-body text-xs text-text-tertiary">
            Ruum Ruum by Movilia • Última actualización: 3 de julio de 2026 • App v{appVersion.version} (mín. {appVersion.minimumSupported})
          </p>
        </header>

        <div className="space-y-6 font-body text-sm leading-7 text-text-secondary">
          <p>
            El presente documento establece los términos y condiciones bajo los cuales Moviliax S.A. de C.V.
            (&quot;Ruum Ruum&quot;) presta el servicio de traslado vehicular con conductor certificado a través
            de su plataforma digital.
          </p>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">1. Definiciones</h2>
            <p><strong>Plataforma:</strong> La aplicación móvil y web de Ruum Ruum disponible para usuarios registrados.</p>
            <p className="mt-2"><strong>Usuario:</strong> Persona física o moral que solicita el servicio de traslado vehicular a través de la Plataforma.</p>
            <p className="mt-2"><strong>Conductor:</strong> Persona física certificada por Ruum Ruum para realizar traslados vehiculares.</p>
            <p className="mt-2"><strong>Pasaporte Digital:</strong> Documento digital generado por la Plataforma que contiene el registro fotográfico, el estado del vehículo y la trazabilidad del traslado.</p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">2. Registro y Certificación CONCER</h2>
            <p>
              Para operar como Conductor, la persona debe completar el registro con datos verídicos, cargar la
              documentación solicitada (identificación oficial, licencia vigente) y aprobar la revisión documental
              y de antecedentes. La cuenta creada al registrarse queda pendiente de validación hasta que Ruum Ruum
              confirme que la documentación es correcta; el envío del registro no garantiza la activación.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">3. Obligaciones del Conductor</h2>
            <p>
              El Conductor se compromete a mantener vigente su licencia de conducir y su documentación de
              identidad, a informar de inmediato cualquier suspensión, cancelación o proceso legal relacionado con
              su licencia, y a operar los traslados conforme a los niveles CONCER habilitados para su perfil.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">4. Pagos y Cancelaciones</h2>
            <p>
              Ruum Ruum no acepta pagos en efectivo. Todos los traslados se liquidan a través de los métodos de
              pago registrados en la Plataforma. Las cancelaciones realizadas después de que el conductor haya
              sido asignado pueden generar un cargo según la política de cancelación vigente.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">5. Registro del Vehículo y Responsabilidad</h2>
            <p>
              El Pasaporte Digital constituye registro del estado del vehículo al inicio y al final de cada
              traslado. Cualquier reclamación por daños debe realizarse dentro de las 24 horas siguientes a la
              entrega del vehículo, con referencia al folio del traslado.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-text-primary">6. Modificaciones</h2>
            <p>
              Ruum Ruum se reserva el derecho de modificar los presentes Términos. Las modificaciones serán
              notificadas a través de la Plataforma con al menos 15 días de anticipación. El uso continuado de la
              Plataforma constituye la aceptación de los nuevos Términos.
            </p>
          </section>
        </div>

        <div className="mt-8 border-t border-border/60 pt-6">
          <a
            href="/docs-legales/terminos-y-condiciones-ruum-ruum.docx"
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
