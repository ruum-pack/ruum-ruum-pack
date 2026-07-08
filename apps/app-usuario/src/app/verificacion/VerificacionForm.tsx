"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { crearClienteNavegador } from "../../lib/supabase-browser";
import { subirDocumentoIdentidad, actualizarPerfilUsuario, type PerfilUsuarioActualizable } from "@ruum/api/services";
import { consultarCodigoPostalMx } from "../../lib/codigos-postales";

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/heic", "image/heif", "application/pdf"];
const EXTENSIONES_ACEPTADAS = [".jpg", ".jpeg", ".png", ".heic", ".pdf"];
const TAMANO_MAXIMO_MB = 10;

function soloDigitos(valor: string, maximo?: number) {
  const limpio = valor.replace(/\D/g, "");
  return maximo ? limpio.slice(0, maximo) : limpio;
}

function extensionArchivo(nombre: string) {
  const punto = nombre.lastIndexOf(".");
  return punto >= 0 ? nombre.slice(punto).toLowerCase() : "";
}

function esErrorRed(error: unknown) {
  const mensaje = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    mensaje.includes("network") ||
    mensaje.includes("fetch") ||
    mensaje.includes("failed to fetch") ||
    mensaje.includes("load failed") ||
    mensaje.includes("timeout")
  );
}

/* ── Pantalla de confirmación — se muestra tras envío exitoso ── */
function ConfirmacionEnRevision({ destino }: { destino: string }) {
  return (
    <div className="grid gap-5">
      {/* Ícono de éxito */}
      <div className="flex justify-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#e6f9f0]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#1d9e75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <h2 className="font-display text-xl font-semibold">Documentación enviada</h2>
        <p className="mt-2 font-body text-sm leading-6 text-ink/60">
          Recibimos tu identificación y domicilio. El equipo de Ruum Ruum revisará
          tu información en un plazo de <strong className="text-ink">24 a 48 horas hábiles</strong>.
        </p>
      </div>

      {/* Checklist de estado */}
      <div className="app-card grid gap-4 px-5 py-5">
        {[
          { label: "Cuenta creada", sub: "Correo y contraseña", ok: true },
          { label: "Teléfono registrado", sub: "Para notificaciones del traslado", ok: true },
          { label: "Domicilio", sub: "Guardado correctamente", ok: true },
          { label: "Identificación oficial", sub: "Recibida — en revisión", ok: true },
          { label: "Verificación de cuenta", sub: "Pendiente de aprobación por el equipo", ok: false, pendiente: true },
        ].map(({ label, sub, ok, pendiente }) => (
          <div key={label} className="flex items-center gap-3">
            <div className={[
              "flex size-8 items-center justify-center rounded-full",
              ok && !pendiente ? "bg-[#e6f9f0]" :
              pendiente ? "border border-[#f5a623]/40 bg-[#f5a623]/10" :
              "border border-ink/15 bg-mist",
            ].join(" ")}>
              {ok && !pendiente ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#1d9e75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
              ) : pendiente ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#b8860b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  className="text-ink/40" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-body text-sm font-medium">{label}</p>
              <p className={[
                "font-body text-xs",
                pendiente ? "text-[#b8860b]" : "text-ink/45",
              ].join(" ")}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Aviso de proceso */}
      <div className="flex items-start gap-2.5 rounded-lg border border-[#f5a623]/25 bg-[#f5a623]/8 px-4 py-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#b8860b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          className="mt-0.5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4m0 4h.01" />
        </svg>
        <p className="font-body text-xs leading-5 text-amber-800">
          Mientras tu cuenta está en revisión puedes explorar la app. Te
          notificaremos por correo y SMS cuando quedes habilitado para solicitar traslados.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-signal px-5 py-3 font-display text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-signal/90 focus-visible:outline-route-dark"
      >
        Ir al inicio
      </Link>

      <Link
        href={destino}
        className="text-center font-body text-xs text-ink/45 underline-offset-4 hover:text-ink/70 hover:underline"
      >
        Intentar solicitar traslado de todos modos
      </Link>
    </div>
  );
}

interface Props {
  destino: string;
}

export function VerificacionForm({ destino }: Props) {
  const router = useRouter();

  /* Domicilio — campos individuales que coinciden con la tabla usuarios (migración 0039) */
  const [codigoPostal, setCodigoPostal] = useState("");
  const [estadoMx, setEstadoMx] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [colonia, setColonia] = useState("");
  const [coloniasCp, setColoniasCp] = useState<string[]>([]);
  const [ciudadesCp, setCiudadesCp] = useState<string[]>([]);
  const [calle, setCalle] = useState("");
  const [numero, setNumero] = useState("");
  const [referencias, setReferencias] = useState("");
  const [cpConsultando, setCpConsultando] = useState(false);
  const [cpAviso, setCpAviso] = useState<string | null>(null);

  /* Identificación */
  const [documento, setDocumento] = useState<File | null>(null);
  const [docAviso, setDocAviso] = useState<string | null>(null);

  /* Estado envío */
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* FIX: en lugar de redirigir a donde el gate bloquea,
     mostrar pantalla de confirmación en la misma ruta */
  const [enviado, setEnviado] = useState(false);

  async function consultarCP(valor: string) {
    const cp = soloDigitos(valor, 5);
    setCodigoPostal(cp);
    if (cp.length !== 5) {
      setCpAviso(null);
      setCiudadesCp([]);
      setColoniasCp([]);
      return;
    }
    setCpConsultando(true);
    setCpAviso(null);
    try {
      const datos = await consultarCodigoPostalMx(cp);
      if (!datos) throw new Error("CP no encontrado");
      setEstadoMx(datos.estado);
      setCiudadesCp(datos.ciudades ?? []);
      setCiudad(datos.ciudades?.[0] ?? "");
      setColoniasCp(datos.colonias ?? []);
      setColonia(datos.colonias?.[0] ?? "");
      setCpAviso(null);
    } catch {
      setCpAviso("No encontramos ese código postal. Verifica o escríbelo manualmente.");
    } finally {
      setCpConsultando(false);
    }
  }

  function manejarDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const extension = extensionArchivo(archivo.name);
    const formatoSoportado = TIPOS_ACEPTADOS.includes(archivo.type) || EXTENSIONES_ACEPTADAS.includes(extension);

    if (!formatoSoportado) {
      setDocumento(null);
      setDocAviso("Formato no soportado. Acción: usa un archivo JPG o PNG.");
      e.target.value = "";
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      setDocumento(null);
      setDocAviso(`Archivo muy grande. Acción: comprime el archivo hasta que pese máximo ${TAMANO_MAXIMO_MB} MB.`);
      e.target.value = "";
      return;
    }
    setDocAviso(null);
    setDocumento(archivo);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    if (!documento) {
      setError("Adjunta tu identificación oficial para continuar.");
      return;
    }
    if (!calle.trim() || !codigoPostal || !colonia) {
      setError("Completa tu domicilio antes de continuar.");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();

      const direccionPrincipal = [
        [calle.trim(), numero.trim()].filter(Boolean).join(" "),
        colonia ? `Col. ${colonia}` : "",
        codigoPostal ? `CP ${codigoPostal}` : "",
        ciudad,
        estadoMx,
      ]
        .filter(Boolean)
        .join(", ");

      await actualizarPerfilUsuario(cliente, {
        pais: "México",
        estado: estadoMx,
        codigo_postal: codigoPostal,
        ciudad,
        colonia,
        calle: calle.trim(),
        numero: numero.trim() || null,
        referencias: referencias.trim() || null,
        direccion_principal: direccionPrincipal,
      } as PerfilUsuarioActualizable);

      await subirDocumentoIdentidad(cliente, documento);

      /* FIX: no redirigir a destino — el gate de traslados/nuevo
         bloquea todo estado distinto de "verificado" y la verificación
         solo la aprueba un admin. Mostrar confirmación de espera en su lugar. */
      setEnviado(true);
      router.refresh();
    } catch (err) {
      setError(
        esErrorRed(err)
          ? "Error de red. Acción: revisa tu conexión y reintenta la carga."
          : err instanceof Error ? err.message : "Error al guardar. Intenta de nuevo."
      );
    } finally {
      setEnviando(false);
    }
  }

  /* Mostrar confirmación tras envío exitoso */
  if (enviado) {
    return <ConfirmacionEnRevision destino={destino} />;
  }

  const campoBase =
    "w-full rounded-lg border border-app-border-strong bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none transition focus:border-app-focus focus:ring-2 focus:ring-app-focus-ring";

  return (
    <form onSubmit={enviar} className="grid gap-6">
      {/* ── Domicilio ── */}
      <fieldset className="grid gap-4">
        <legend className="font-body text-xs font-semibold uppercase tracking-wide text-ink/40">
          Domicilio
        </legend>

        <label className="flex flex-col gap-1.5">
          <span className="font-body text-xs font-medium text-ink/70">Código postal</span>
          <input
            type="text"
            inputMode="numeric"
            value={codigoPostal}
            onChange={(e) => consultarCP(e.target.value)}
            placeholder="06600"
            maxLength={5}
            required
            className={campoBase}
          />
          {cpConsultando && (
            <span className="font-body text-[11px] text-ink/45">Buscando…</span>
          )}
          {cpAviso && (
            <span className="font-body text-[11px] text-amber-700">{cpAviso}</span>
          )}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-xs font-medium text-ink/70">Estado</span>
            <input
              type="text"
              value={estadoMx}
              onChange={(e) => setEstadoMx(e.target.value)}
              placeholder="CDMX"
              required
              className={campoBase}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-xs font-medium text-ink/70">Ciudad</span>
            {ciudadesCp.length > 1 ? (
              <select
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className={campoBase}
              >
                {ciudadesCp.map((c) => <option key={c}>{c}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Ciudad de México"
                required
                className={campoBase}
              />
            )}
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-body text-xs font-medium text-ink/70">Colonia</span>
          {coloniasCp.length > 1 ? (
            <select
              value={colonia}
              onChange={(e) => setColonia(e.target.value)}
              className={campoBase}
            >
              {coloniasCp.map((c) => <option key={c}>{c}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={colonia}
              onChange={(e) => setColonia(e.target.value)}
              placeholder="Juárez"
              required
              className={campoBase}
            />
          )}
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="font-body text-xs font-medium text-ink/70">Calle</span>
            <input
              type="text"
              value={calle}
              onChange={(e) => setCalle(e.target.value)}
              placeholder="Av. Insurgentes"
              required
              className={campoBase}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-xs font-medium text-ink/70">Núm.</span>
            <input
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="123"
              className={campoBase}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-body text-xs font-medium text-ink/70">
            Referencias <span className="text-ink/35">(opcional)</span>
          </span>
          <textarea
            value={referencias}
            onChange={(e) => setReferencias(e.target.value)}
            placeholder="Entre calles, color de fachada, etc."
            className={`${campoBase} min-h-[72px] resize-none`}
            maxLength={300}
            aria-label="Referencias del domicilio"
          />
          <span className="text-right font-body text-[11px] text-ink/40">{referencias.length}/300</span>
        </label>
      </fieldset>

      {/* ── Identificación oficial ── */}
      <fieldset className="grid gap-3">
        <legend className="font-body text-xs font-semibold uppercase tracking-wide text-ink/40">
          Identificación oficial
        </legend>
        <p className="font-body text-xs text-ink/55">
          INE, pasaporte vigente o licencia de conducir.
        </p>
        <p className="font-body text-xs font-medium text-ink/70">
          Acepta: JPG, PNG, HEIC, PDF. Tamaño máximo: {TAMANO_MAXIMO_MB} MB.
        </p>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink/15 px-4 py-6 transition hover:border-route/40 hover:bg-mist">
          {documento ? (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                className="text-green-600" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="font-body text-sm font-medium text-ink">{documento.name}</span>
              <span className="font-body text-xs text-ink/45">Toca para cambiar el archivo</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                className="text-ink/40" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="font-body text-sm text-ink/60">
                Toca para seleccionar tu identificación
              </span>
            </>
          )}
          <input
            type="file"
            accept={[...TIPOS_ACEPTADOS, ...EXTENSIONES_ACEPTADAS].join(",")}
            onChange={manejarDocumento}
            className="sr-only"
            aria-label="Subir identificación oficial"
          />
        </label>
        {docAviso && (
          <p className="font-body text-[11px] text-red-600" role="alert" aria-live="assertive">
            {docAviso}
          </p>
        )}
      </fieldset>

      {error && (
        <div role="alert" aria-live="assertive">
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-signal px-5 py-3 font-display text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-signal/90 focus-visible:outline-route-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? "Verificando…" : "Completar verificación"}
      </button>
    </form>
  );
}
