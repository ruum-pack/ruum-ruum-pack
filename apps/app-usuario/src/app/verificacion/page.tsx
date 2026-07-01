"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Aviso } from "@ruum/ui";
import { obtenerUsuarioActual, subirDocumentoIdentidad } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/heic", "application/pdf"];
const TAMANO_MAXIMO_MB = 10;
type EstadoCuenta = "cargando" | "sin_sesion" | "pendiente" | "en_revision" | "verificado" | "rechazado";

export default function PaginaVerificacion() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextHref, setNextHref] = useState("/");
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuenta>(tieneSupabaseConfigurado() ? "cargando" : "pendiente");
  const [documentoSubido, setDocumentoSubido] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) setNextHref(next);

    async function cargarEstado() {
      if (!tieneSupabaseConfigurado()) return;

      try {
        const cliente = crearClienteNavegador();
        const usuario = await obtenerUsuarioActual(cliente);
        if (!usuario) {
          setEstadoCuenta("sin_sesion");
          return;
        }
        setEstadoCuenta(usuario.estado_verificacion);
        setDocumentoSubido(Boolean(usuario.doc_identidad_url));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No pudimos consultar el estado de verificación.");
        setEstadoCuenta("sin_sesion");
      }
    }

    cargarEstado();
  }, []);

  function seleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!TIPOS_ACEPTADOS.includes(f.type)) {
      setError("Solo se aceptan imágenes (JPG, PNG, HEIC) o PDF.");
      setArchivo(null);
      return;
    }

    if (f.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      setError(`El archivo no puede superar ${TAMANO_MAXIMO_MB} MB.`);
      setArchivo(null);
      return;
    }

    setError(null);
    setArchivo(f);
  }

  async function subir() {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);

    if (!tieneSupabaseConfigurado()) {
      await new Promise((r) => setTimeout(r, 600));
      setExito(true);
      setSubiendo(false);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await subirDocumentoIdentidad(cliente, archivo);
      setEstadoCuenta("en_revision");
      setDocumentoSubido(true);
      setArchivo(null);
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos subir el archivo. Intenta de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  if (exito) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-control-soft">
          <span className="text-2xl">OK</span>
        </div>
        <h1 className="font-display text-2xl font-semibold">Documento enviado</h1>
        <p className="mt-3 font-body text-sm text-ink/60">
          El equipo de Ruum Ruum revisará tu identificación en menos de 2 horas hábiles. Te avisaremos cuando tu
          cuenta esté verificada.
        </p>
        <p className="mt-6 font-body text-xs text-ink/35">
          Mientras tanto puedes explorar la app. No podrás solicitar traslados hasta que tu cuenta sea aprobada.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button variant="secundario">Ir al inicio</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (estadoCuenta === "cargando") {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Validando cuenta</h1>
        <p className="mt-3 font-body text-sm text-ink/60">Estamos consultando el estado de tu verificación.</p>
      </main>
    );
  }

  if (estadoCuenta === "sin_sesion") {
    const loginNext = `/verificacion?next=${encodeURIComponent(nextHref)}`;
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Inicia sesión para verificarte</h1>
        <p className="mt-3 font-body text-sm text-ink/60">
          Necesitamos una sesión activa para asociar tu identificación con tu cuenta.
        </p>
        <div className="mt-6">
          <Link href={`/login?next=${encodeURIComponent(loginNext)}`}>
            <Button>Iniciar sesión</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (estadoCuenta === "verificado") {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Cuenta verificada</h1>
        <p className="mt-3 font-body text-sm text-ink/60">
          Tu cuenta ya fue aprobada por el equipo de Ruum Ruum.
        </p>
        <div className="mt-6">
          <Link href={nextHref}>
            <Button>Continuar</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Verifica tu identidad</h1>
      <p className="mt-2 font-body text-sm text-ink/60">
        Para proteger a todos los usuarios de la plataforma, necesitamos confirmar tu identidad antes de que puedas
        solicitar un traslado.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {estadoCuenta === "en_revision" && documentoSubido ? (
          <Aviso tono="info">
            Tu documento ya está en revisión. El equipo administrativo debe aprobar la cuenta antes de que puedas
            solicitar traslados.
          </Aviso>
        ) : estadoCuenta === "rechazado" ? (
          <Aviso tono="peligro">
            Tu verificación fue rechazada. Sube una identificación legible y vigente para enviarla nuevamente a revisión.
          </Aviso>
        ) : (
          <Aviso tono="info">
            Sube una fotografía o escaneo legible de tu identificación oficial vigente: INE, pasaporte o licencia de
            conducir. El documento solo lo verá el equipo interno de Ruum Ruum.
          </Aviso>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink/15 bg-mist px-6 py-10 transition-colors hover:border-route/40 hover:bg-route-soft"
        >
          <span className="text-3xl">Documento</span>
          <span className="font-body text-sm text-ink/55">
            {archivo ? archivo.name : "Toca aquí para seleccionar el archivo"}
          </span>
          <span className="font-mono-ruum text-xs text-ink/30">JPG · PNG · HEIC · PDF · máx. 10 MB</span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={TIPOS_ACEPTADOS.join(",")}
          className="hidden"
          onChange={seleccionarArchivo}
        />

        {error && <Aviso tono="peligro">{error}</Aviso>}

        <Button onClick={subir} disabled={!archivo || subiendo}>
          {subiendo ? "Subiendo…" : documentoSubido ? "Reemplazar identificación" : "Enviar identificación"}
        </Button>

        <p className="text-center font-body text-xs text-ink/35">
          Tus datos se tratan conforme a nuestro{" "}
          <a href="/soporte#privacidad" className="underline-offset-2 hover:underline">
            Aviso de privacidad
          </a>
          .
        </p>
      </div>
    </main>
  );
}
