"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { crearClienteNavegador } from "../../lib/supabase-browser";
import {
  subirDocumentoIdentidad,
  subirFotoPerfil,
  actualizarPerfilUsuario,
  iniciarVerificacionDiditUsuario,
  obtenerEstadoVerificacionDiditUsuario,
  obtenerUsuarioActual,
  type PerfilUsuarioActualizable
} from "@ruum/api/services";
import { consultarCodigoPostalMx } from "../../lib/codigos-postales";
import { DiditVerificationModal } from "./DiditVerificationModal";

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "application/pdf", "image/heic", "image/heif"];
const EXTENSIONES_ACEPTADAS = [".jpg", ".jpeg", ".png", ".pdf", ".heic", ".heif"];
const TAMANO_MAXIMO_MB = 10;
const TAMANO_MAXIMO_RETRATO_DIDIT_MB = 2;

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

/* ── Pantalla de confirmación tras envío manual ── */
function ConfirmacionEnRevision() {
  return (
    <div className="grid gap-5">
      <div className="flex justify-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#e6f9f0]">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1d9e75"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <h2 className="font-display text-xl font-semibold">Documentación enviada</h2>
        <p className="mt-2 font-body text-sm leading-6 text-ink/60">
          Recibimos tu identificación y domicilio. El equipo de Ruum revisará
          tu información en un plazo de <strong className="text-ink">24 a 48 horas hábiles</strong>.
        </p>
      </div>

      <div className="app-card grid gap-4 px-5 py-5">
        {[
          { label: "Cuenta creada", sub: "Correo y contraseña", ok: true },
          { label: "Teléfono registrado", sub: "Para notificaciones del traslado", ok: true },
          { label: "Domicilio", sub: "Guardado correctamente", ok: true },
          { label: "Identificación oficial", sub: "Recibida — en revisión", ok: true },
          { label: "Verificación de cuenta", sub: "Pendiente de aprobación por el equipo", ok: false, pendiente: true },
        ].map(({ label, sub, ok, pendiente }) => (
          <div key={label} className="flex items-center gap-3">
            <div
              className={[
                "flex size-8 items-center justify-center rounded-full",
                ok && !pendiente
                  ? "bg-[#e6f9f0]"
                  : pendiente
                  ? "border border-[#f5a623]/40 bg-[#f5a623]/10"
                  : "border border-ink/15 bg-mist",
              ].join(" ")}
            >
              {ok && !pendiente ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1d9e75"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : pendiente ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#b8860b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-ink/40"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-body text-sm font-medium">{label}</p>
              <p
                className={[
                  "font-body text-xs",
                  pendiente ? "text-[#b8860b]" : "text-ink/45",
                ].join(" ")}
              >
                {sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-[#f5a623]/25 bg-[#f5a623]/8 px-4 py-3">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#b8860b"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        >
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
    </div>
  );
}

interface VerificacionFormProps {
  fotoPerfilInicial?: string | null;
  /** En revisión documental se ofrece Didit sin repetir el formulario manual. */
  soloDidit?: boolean;
}

export function VerificacionForm({ fotoPerfilInicial, soloDidit = false }: VerificacionFormProps = {}) {
  const router = useRouter();

  /* Didit Verification State */
  const [mostrarDiditModal, setMostrarDiditModal] = useState(false);
  const [urlDidit, setUrlDidit] = useState<string | null>(null);
  const [sessionIdDidit, setSessionIdDidit] = useState<string | null>(null);
  const [cargandoDidit, setCargandoDidit] = useState(false);
  const [errorDidit, setErrorDidit] = useState<string | null>(null);
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState(fotoPerfilInicial ?? "");
  const [subiendoFotoPerfil, setSubiendoFotoPerfil] = useState(false);
  const [verificacionCompletada, setVerificacionCompletada] = useState(false);

  /* Manual Verification Form State */
  const [mostrarFormularioManual, setMostrarFormularioManual] = useState(false);
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
  const [documento, setDocumento] = useState<File | null>(null);
  const [docAviso, setDocAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  /* Funciones Didit */
  async function iniciarDidit() {
    if (cargandoDidit) return;
    setCargandoDidit(true);
    setErrorDidit(null);
    setUrlDidit(null);
    setSessionIdDidit(null);
    setMostrarDiditModal(true);
    try {
      const cliente = crearClienteNavegador();
      const { url, sessionId } = await iniciarVerificacionDiditUsuario(cliente);
      setUrlDidit(url);
      setSessionIdDidit(sessionId ?? null);
    } catch (err) {
      setErrorDidit(
        err instanceof Error ? err.message : "No fue posible conectar con el servicio de verificación de Didit."
      );
    } finally {
      setCargandoDidit(false);
    }
  }

  function cerrarDidit() {
    setMostrarDiditModal(false);
    setUrlDidit(null);
    setSessionIdDidit(null);
    setErrorDidit(null);
  }

  async function cargarFotoPerfilDidit(archivo: File | undefined) {
    if (!archivo) return;
    setErrorDidit(null);
    if (!archivo.type.startsWith("image/")) {
      setErrorDidit("Selecciona una fotografía en formato JPG, PNG o WEBP.");
      return;
    }
    // A-12: si supera 2 MB, intentar compresión cliente antes de rechazar; si falla, guiar
    let archivoAEnviar = archivo;
    if (archivo.size > TAMANO_MAXIMO_RETRATO_DIDIT_MB * 1024 * 1024) {
      const sizeMB = (archivo.size / 1024 / 1024).toFixed(1);
      // Intentar compresión vía canvas para imágenes grandes (evita obligar al usuario a buscar herramienta externa)
      try {
        const comprimido = await comprimirImagenCliente(archivo, TAMANO_MAXIMO_RETRATO_DIDIT_MB);
        if (comprimido && comprimido.size <= TAMANO_MAXIMO_RETRATO_DIDIT_MB * 1024 * 1024) {
          archivoAEnviar = comprimido;
        } else {
          setErrorDidit(
            `La foto pesa ${sizeMB} MB y supera el límite de ${TAMANO_MAXIMO_RETRATO_DIDIT_MB} MB. Se intentó comprimir sin éxito. Prueba: envía la foto por WhatsApp a ti mismo y descárgala (se comprime a JPG), o usa tinypng.com / fotos.google.com para reducirla, o toma la foto con resolución menor.`
          );
          return;
        }
      } catch {
        setErrorDidit(
          `La foto pesa ${sizeMB} MB y supera ${TAMANO_MAXIMO_RETRATO_DIDIT_MB} MB. Comprime la imagen antes de subirla: en iPhone Fotos > Compartir > Guardar en Archivos reduce calidad, o usa tinypng.com.`
        );
        return;
      }
    }

    setSubiendoFotoPerfil(true);
    try {
      const url = await subirFotoPerfil(crearClienteNavegador(), archivoAEnviar);
      setFotoPerfilUrl(url);
    } catch (err) {
      setErrorDidit(err instanceof Error ? err.message : "No pudimos guardar tu fotografía de perfil.");
    } finally {
      setSubiendoFotoPerfil(false);
    }
  }

  async function comprimirImagenCliente(archivo: File, maxMB: number): Promise<File | null> {
    // Solo imágenes
    if (!archivo.type.startsWith("image/")) return null;
    try {
      const bitmap = await createImageBitmap(archivo);
      const maxDim = 1024;
      let { width, height } = bitmap;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
      if (!blob) return null;
      if (blob.size > maxMB * 1024 * 1024) return null;
      return new File([blob], archivo.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
    } catch {
      return null;
    }
  }

  async function finalizarDidit() {
    if (cargandoDidit) return;
    setCargandoDidit(true);
    setErrorDidit(null);
    try {
      const cliente = crearClienteNavegador();
      let resultado: "verificado" | "rechazado" | "pendiente" = "pendiente";

      // El mensaje del iframe sólo indica que Didit terminó. El webhook puede
      // tardar unos segundos; esperar la actualización canónica evita mostrar
      // éxito mientras la cuenta todavía sigue pendiente.
      for (let intento = 0; intento < 12; intento += 1) {
        const [usuario, verificacion] = await Promise.all([
          obtenerUsuarioActual(cliente),
          obtenerEstadoVerificacionDiditUsuario(cliente, sessionIdDidit ?? undefined),
        ]);

        if (usuario?.estado_verificacion === "verificado") {
          resultado = "verificado";
          break;
        }
        if (["rechazado", "error", "expirado", "cancelado"].includes(verificacion?.estado ?? "")) {
          resultado = "rechazado";
          break;
        }
        if (intento < 11) await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }

      if (resultado === "verificado") {
        setMostrarDiditModal(false);
        setUrlDidit(null);
        setSessionIdDidit(null);
        setVerificacionCompletada(true);
      } else if (resultado === "rechazado") {
        setErrorDidit("La verificación no pudo confirmarse. Puedes reintentar o usar la opción manual.");
      } else {
        setErrorDidit("Recibimos tu verificación, pero todavía estamos procesando el resultado. Actualiza en unos segundos.");
      }
      router.refresh();
    } catch (err) {
      setErrorDidit(err instanceof Error ? err.message : "No pudimos consultar el resultado de Didit.");
      router.refresh();
    } finally {
      setCargandoDidit(false);
    }
  }

  /* Consultar Código Postal */
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
    const esHeic =
      ["image/heic", "image/heif"].includes(archivo.type.toLowerCase()) ||
      [".heic", ".heif"].includes(extension);
    const formatoSoportado =
      TIPOS_ACEPTADOS.includes(archivo.type) || EXTENSIONES_ACEPTADAS.includes(extension);

    // C-04: HEIC — no borrar selección; conservar archivo y ofrecer guía de conversión. iOS 17+ default HEIC.
    if (esHeic) {
      setDocumento(archivo);
      setDocAviso(
        "Detectamos formato HEIC (iPhone). Lo conservamos para que no pierdas la selección, pero para máxima compatibilidad conviértelo a JPG: en iPhone ve a Ajustes › Cámara › Formatos › Más compatible y vuelve a tomar la foto, o usa un conversor a JPG/PDF. Puedes intentar enviarlo; si el servidor lo rechaza, conviértelo e intenta de nuevo."
      );
      // No limpiar e.target.value para no perder archivo si el usuario decide reintentar tras convertir
      return;
    }
    if (!formatoSoportado) {
      setDocumento(null);
      setDocAviso("Formato no soportado. Selecciona un archivo JPG, PNG, PDF o HEIC (recomendado JPG).");
      e.target.value = "";
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      setDocumento(null);
      setDocAviso(`Archivo muy grande (${(archivo.size / 1024 / 1024).toFixed(1)} MB). Comprime o reduce la resolución hasta máximo ${TAMANO_MAXIMO_MB} MB. En iPhone, envía la foto por WhatsApp a ti mismo y descárgala — se comprime a JPG.`);
      e.target.value = "";
      return;
    }
    // Advertencia para HEIC que llegó por tipo genérico pero con extensión permitida extendida
    if (esHeic) {
      setDocAviso(
        "Archivo HEIC conservado. Si el envío falla, conviértelo a JPG antes de reintentar."
      );
    } else {
      setDocAviso(null);
    }
    setDocumento(archivo);
  }

  async function enviarManual(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;

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
    setDocAviso("Validando el contenido y enviando de forma segura…");

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
      setDocAviso("Identificación recibida correctamente y enviada a revisión.");
      setEnviado(true);
      router.refresh();
    } catch (err) {
      setDocAviso("La carga no se completó. Tu archivo sigue seleccionado para que puedas reintentar.");
      setError(
        esErrorRed(err)
          ? "Error de red. Acción: revisa tu conexión y reintenta la carga."
          : err instanceof Error
          ? err.message
          : "Error al guardar. Intenta de nuevo."
      );
    } finally {
      setEnviando(false);
    }
  }

  if (verificacionCompletada) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-[#064e3b]/20 p-6 text-center space-y-4 shadow-xl">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-3xl font-bold">
          ✓
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-white">¡Identidad Verificada con Éxito!</h2>
          <p className="mt-2 font-body text-sm leading-6 text-[#94a3b8]">
            Tu cuenta ha sido aprobada de manera inmediata mediante Didit. Ya tienes acceso total para solicitar traslados y rastrearlos con el Pasaporte Digital.
          </p>
        </div>
        <Link
          href="/traslados/nuevo"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#FFC400] px-5 py-3 font-display text-sm font-extrabold text-[#151515] shadow-[0_10px_28px_rgba(255,196,0,0.24)] transition hover:bg-[#e0ac00]"
        >
          Solicitar mi primer traslado
        </Link>
      </div>
    );
  }

  if (enviado) {
    return <ConfirmacionEnRevision />;
  }

  const campoBase =
    "w-full rounded-lg border border-app-border-strong bg-mist px-3.5 py-2.5 font-body text-sm text-ink outline-none transition focus:border-app-focus focus:ring-2 focus:ring-app-focus-ring";

  return (
    <div className="grid gap-6">
      {/* ── Opción 1: Didit Verificación Biométrica Instantánea ── */}
      <div className="rounded-2xl border border-[#FFC400]/40 bg-[#FFC400]/5 p-5 shadow-lg space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-display text-sm font-bold text-[#FFC400]">
              Verificación instantánea (recomendada)
            </span>
          </div>
          <span className="rounded-full bg-[#FFC400]/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#FFC400] border border-[#FFC400]/40">
            &lt; 2 MIN
          </span>
        </div>

        <p className="font-body text-xs leading-5 text-ink/75">
          Valida tu INE, pasaporte o licencia con reconocimiento biométrico oficial y prueba de vida en tiempo real a través de Didit. Tu cuenta quedará aprobada inmediatamente sin tiempos de espera.
        </p>

        {!mostrarDiditModal && errorDidit && <Aviso tono="danger">{errorDidit}</Aviso>}

        {!fotoPerfilUrl && (
          <div className="rounded-xl border border-[#f5a623]/30 bg-[#f5a623]/10 p-3.5">
            <p className="font-body text-xs leading-5 text-amber-900">
              Este flujo usa coincidencia facial. Sube primero una fotografía clara de tu rostro para que Didit pueda compararla con la prueba de vida.
            </p>
            <label className="mt-3 flex flex-col gap-1.5">
              <span className="font-display text-xs font-semibold text-amber-950">Fotografía de referencia</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void cargarFotoPerfilDidit(e.target.files?.[0])}
                disabled={subiendoFotoPerfil || cargandoDidit}
                className="w-full rounded-lg border border-amber-900/20 bg-white/70 px-3 py-2 font-body text-xs text-ink file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-mist"
              />
              <span className="font-body text-[11px] text-amber-900/75">
                {subiendoFotoPerfil ? "Guardando fotografía…" : "Máximo 2 MB. Si tu foto pesa más, la comprimimos automáticamente o puedes usar tinypng.com."}
              </span>
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={iniciarDidit}
          disabled={cargandoDidit || subiendoFotoPerfil || !fotoPerfilUrl}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#FFC400] px-5 py-3 font-display text-sm font-extrabold text-[#151515] shadow-[0_10px_28px_rgba(255,196,0,0.24)] transition hover:bg-[#e0ac00] active:scale-[0.99] cursor-pointer"
        >
          <span>🪪</span> {fotoPerfilUrl ? "Iniciar verificación con Didit" : "Sube tu fotografía para continuar"}
        </button>
      </div>

      {/* Modal Didit */}
      <DiditVerificationModal
        isOpen={mostrarDiditModal}
        url={urlDidit}
        cargando={cargandoDidit}
        error={errorDidit}
        onCerrar={cerrarDidit}
        onReintentar={iniciarDidit}
        onFinalizar={finalizarDidit}
      />

      {!soloDidit && (
        <>
          {/* ── Separador / Opción 2: Verificación Tradicional Manual ── */}
          <div className="relative my-2 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-ink/15" />
            </div>
            <div className="relative flex justify-center">
              <button
                type="button"
                onClick={() => setMostrarFormularioManual(!mostrarFormularioManual)}
                className="rounded-full bg-surface px-4 py-1 text-xs font-medium text-ink/60 border border-ink/15 hover:text-ink transition cursor-pointer"
              >
                {mostrarFormularioManual ? "▲ Ocultar verificación manual" : "▼ O prefiero subir mis documentos manualmente (24-48h)"}
              </button>
            </div>
          </div>

          {mostrarFormularioManual && (
        <form onSubmit={enviarManual} className="grid gap-6 animate-fadeIn">
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
              {cpConsultando && <span className="font-body text-xs text-ink/45">Buscando…</span>}
              {cpAviso && <span className="font-body text-xs text-amber-700">{cpAviso}</span>}
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
                    {ciudadesCp.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
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
                  {coloniasCp.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
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
              <span className="text-right font-body text-xs text-ink/40">{referencias.length}/300</span>
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
              Formatos aceptados: JPG, PNG, PDF y HEIC (iPhone — se recomienda convertir a JPG). Tamaño máximo: {TAMANO_MAXIMO_MB} MB.
            </p>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink/15 px-4 py-6 transition hover:border-route/40 hover:bg-mist">
              {documento ? (
                <>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-green-600"
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="font-body text-sm font-medium text-ink">{documento.name}</span>
                  <span className="font-body text-xs text-ink/45">Toca para cambiar el archivo</span>
                </>
              ) : (
                <>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-ink/40"
                    aria-hidden="true"
                  >
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
                id="input-documento-identidad"
                type="file"
                accept={[...TIPOS_ACEPTADOS, ...EXTENSIONES_ACEPTADAS].join(",")}
                onChange={manejarDocumento}
                disabled={enviando}
                className="sr-only"
                aria-label="Subir identificación oficial"
                aria-describedby={docAviso ? "doc-aviso" : undefined}
                aria-invalid={Boolean(docAviso && !documento)}
              />
            </label>
            {docAviso && (
              <p id="doc-aviso" className="font-body text-xs text-red-600" role="alert" aria-live="assertive">
                {docAviso}
              </p>
            )}
          </fieldset>

          {error && (
            <div role="alert" aria-live="assertive">
              <Aviso tono="danger">{error}</Aviso>
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-signal px-5 py-3 font-display text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-signal/90 focus-visible:outline-route-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Enviar para revisión manual"}
          </button>
          </form>
          )}
        </>
      )}
    </div>
  );
}
