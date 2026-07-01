"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Aviso } from "@ruum/ui";
import { subirDocumentoIdentidad } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/heic", "application/pdf"];
const TAMANO_MAXIMO_MB = 10;

export default function PaginaVerificacion() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextHref, setNextHref] = useState("/");

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) setNextHref(next);
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
          <span className="text-2xl">✓</span>
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
          <Link href={nextHref}>
            <Button variant="secundario">Continuar</Button>
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
        <Aviso tono="info">
          Sube una fotografía o escaneo legible de tu identificación oficial vigente: INE, pasaporte o licencia de
          conducir. El documento solo lo verá el equipo interno de Ruum Ruum.
        </Aviso>

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
          {subiendo ? "Subiendo…" : "Enviar identificación"}
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
