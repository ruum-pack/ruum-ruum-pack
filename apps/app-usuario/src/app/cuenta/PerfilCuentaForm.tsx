"use client";

import Image from "next/image";

import { useEffect, useState } from "react";
import { Aviso, Button, Field } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { actualizarPerfilUsuario, subirFotoPerfil } from "@ruum/api/services";
import { consultarCodigoPostalMx } from "../../lib/codigos-postales";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];

function soloDigitos(valor: string, maximo?: number) {
  const limpio = valor.replace(/\D/g, "");
  return maximo ? limpio.slice(0, maximo) : limpio;
}

function telefonoLocalMx(valor: string | null) {
  const limpio = soloDigitos(valor ?? "");
  const sinCodigoPais = limpio.length > 10 && limpio.startsWith("52") ? limpio.slice(2) : limpio;
  return sinCodigoPais.slice(0, 10);
}

function telefonoMx(diezDigitos: string) {
  const telefono = soloDigitos(diezDigitos, 10);
  return telefono ? `+52${telefono}` : "";
}

function separarNombreApellido(nombreCompleto: string | null) {
  const partes = (nombreCompleto ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { nombre: partes[0] ?? "", apellido: "" };
  return {
    nombre: partes.slice(0, -1).join(" "),
    apellido: partes.at(-1) ?? ""
  };
}

function nombreCompleto(nombre: string, apellido: string) {
  return [nombre.trim(), apellido.trim()].filter(Boolean).join(" ");
}

function iniciales(nombre: string, apellido: string) {
  return [nombre, apellido]
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.trim()[0]?.toUpperCase())
    .join("") || "RR";
}

function domicilioCompleto({
  calle,
  numero,
  colonia,
  codigoPostal,
  ciudad,
  estado,
  referencias
}: {
  calle: string;
  numero: string;
  colonia: string;
  codigoPostal: string;
  ciudad: string;
  estado: string;
  referencias: string;
}) {
  return [
    [calle.trim(), numero.trim()].filter(Boolean).join(" "),
    colonia.trim() ? `Col. ${colonia.trim()}` : "",
    codigoPostal.trim() ? `CP ${codigoPostal.trim()}` : "",
    ciudad.trim(),
    estado.trim(),
    referencias.trim() ? `Ref. ${referencias.trim()}` : ""
  ]
    .filter(Boolean)
    .join(", ");
}

export function PerfilCuentaForm({ usuario }: { usuario: Usuario }) {
  const nombreInicial = separarNombreApellido(usuario.nombre);
  const [nombre, setNombre] = useState(nombreInicial.nombre);
  const [apellido, setApellido] = useState(nombreInicial.apellido);
  const [fotoUrl, setFotoUrl] = useState(usuario.foto_url ?? "");
  const [telefono, setTelefono] = useState(telefonoLocalMx(usuario.telefono));
  const [pais, setPais] = useState(usuario.pais ?? "México");
  const [estado, setEstado] = useState(usuario.estado ?? "");
  const [codigoPostal, setCodigoPostal] = useState(usuario.codigo_postal ?? "");
  const [ciudad, setCiudad] = useState(usuario.ciudad ?? "");
  const [colonia, setColonia] = useState(usuario.colonia ?? "");
  const [calle, setCalle] = useState(usuario.calle ?? "");
  const [numero, setNumero] = useState(usuario.numero ?? "");
  const [referencias, setReferencias] = useState(usuario.referencias ?? "");
  const [correoFacturacion, setCorreoFacturacion] = useState(usuario.correo_facturacion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "peligro"; texto: string } | null>(null);
  const [cpConsultando, setCpConsultando] = useState(false);
  const [cpAviso, setCpAviso] = useState<string | null>(null);
  const [ciudadesCp, setCiudadesCp] = useState<string[]>(usuario.ciudad ? [usuario.ciudad] : []);
  const [coloniasCp, setColoniasCp] = useState<string[]>(usuario.colonia ? [usuario.colonia] : []);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  useEffect(() => {
    if (codigoPostal.length === 5) void consultarCodigoPostal(codigoPostal);
    // Solo precarga las listas del CP inicial al montar el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function consultarCodigoPostal(valor: string) {
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
      const datosCp = await consultarCodigoPostalMx(cp);
      if (!datosCp) throw new Error("CP no encontrado");

      setEstado(datosCp.estado);
      setCiudadesCp(datosCp.ciudades);
      setColoniasCp(datosCp.colonias);
      setCiudad(datosCp.ciudades[0] ?? "");
      setColonia(datosCp.colonias[0] ?? "");
      if (datosCp.ciudades.length > 1 || datosCp.colonias.length > 1) {
        setCpAviso("Selecciona la ciudad o municipio y la colonia que correspondan al CP.");
      } else if (!datosCp.ciudades.length || !datosCp.colonias.length) {
        setCpAviso("Captura manualmente los campos que no se prellenaron con el CP.");
      }
    } catch {
      setCiudadesCp([]);
      setColoniasCp([]);
      setCpAviso("No pudimos encontrar ese CP. Captura estado, ciudad y colonia manualmente.");
    } finally {
      setCpConsultando(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);

    if (telefono.length !== 10) {
      setMensaje({ tono: "peligro", texto: "El teléfono debe tener 10 dígitos; el prefijo +52 ya está aplicado." });
      return;
    }

    if (
      !nombre.trim() ||
      !apellido.trim() ||
      codigoPostal.length !== 5 ||
      !estado.trim() ||
      !ciudad.trim() ||
      !colonia.trim() ||
      !calle.trim() ||
      !numero.trim()
    ) {
      setMensaje({ tono: "peligro", texto: "Completa nombre, apellido, teléfono y domicilio antes de guardar." });
      return;
    }

    if (!tieneSupabaseConfigurado()) {
      setMensaje({ tono: "peligro", texto: "Supabase no está configurado. No se pueden guardar cambios." });
      return;
    }

    setGuardando(true);
    try {
      await actualizarPerfilUsuario(crearClienteNavegador(), {
        nombre: nombreCompleto(nombre, apellido),
        foto_url: fotoUrl.trim() || null,
        telefono: telefonoMx(telefono),
        pais: pais.trim() || "México",
        estado: estado.trim(),
        codigo_postal: codigoPostal,
        ciudad: ciudad.trim(),
        colonia: colonia.trim(),
        calle: calle.trim(),
        numero: numero.trim(),
        referencias: referencias.trim() || null,
        direccion_principal: domicilioCompleto({ calle, numero, colonia, codigoPostal, ciudad, estado, referencias }),
        correo_facturacion: correoFacturacion.trim() || null
      });
      setMensaje({ tono: "info", texto: "Datos de cuenta actualizados." });
    } catch (err) {
      setMensaje({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos guardar los cambios." });
    } finally {
      setGuardando(false);
    }
  }

  async function cargarFoto(archivo: File | undefined) {
    if (!archivo) return;
    setMensaje(null);

    if (!archivo.type.startsWith("image/")) {
      setMensaje({ tono: "peligro", texto: "Selecciona una imagen para la fotografía de perfil." });
      return;
    }

    if (!tieneSupabaseConfigurado()) {
      setMensaje({ tono: "peligro", texto: "Supabase no está configurado. No se puede subir la fotografía." });
      return;
    }

    setSubiendoFoto(true);
    try {
      const nuevaFotoUrl = await subirFotoPerfil(crearClienteNavegador(), archivo);
      setFotoUrl(nuevaFotoUrl);
      setMensaje({ tono: "info", texto: "Fotografía actualizada." });
    } catch (err) {
      setMensaje({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos subir la fotografía." });
    } finally {
      setSubiendoFoto(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={guardar}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <Field etiqueta="Apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-sm font-medium">Tipo de cuenta</span>
          <input
            value={usuario.tipo_cuenta === "empresa" ? "Empresa" : "Personal"}
            disabled
            className="w-full rounded-lg border border-ink/20 bg-ink/[0.03] px-3.5 py-2.5 font-body text-sm text-ink/65"
          />
        </label>
      </div>
      <div className="grid gap-3 rounded-lg border border-ink/10 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <Image src={fotoUrl} alt="Fotografía de perfil" width={80} height={80} className="size-20 rounded-full object-cover" />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-full bg-ink font-display text-xl text-mist">
            {iniciales(nombre, apellido)}
          </div>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-sm font-medium">Fotografía</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => void cargarFoto(e.target.files?.[0])}
            disabled={subiendoFoto}
            className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
          />
          <span className="font-body text-xs text-ink/65">
            {subiendoFoto ? "Subiendo fotografía..." : "Puedes subir una imagen nueva cuando quieras."}
          </span>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="font-body text-sm font-medium">Teléfono</span>
        <div className="flex overflow-hidden rounded-lg border border-ink/50 bg-mist">
          <span className="flex items-center border-r border-ink/10 px-3.5 font-body text-sm font-semibold text-ink/70">+52</span>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(telefonoLocalMx(e.target.value))}
            inputMode="numeric"
            maxLength={10}
            required
            autoComplete="tel-national"
            className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
            placeholder="10 dígitos"
          />
        </div>
      </label>
      <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
        <p className="font-body text-sm font-semibold">Domicilio</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field etiqueta="País" value={pais} onChange={(e) => setPais(e.target.value)} required />
          <Field
            etiqueta="Código Postal"
            value={codigoPostal}
            onChange={(e) => void consultarCodigoPostal(e.target.value)}
            onBlur={(e) => consultarCodigoPostal(e.target.value)}
            inputMode="numeric"
            maxLength={5}
            required
            ayuda={cpConsultando ? "Consultando CP..." : cpAviso}
          />
          <Field etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} required />
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium">Ciudad o municipio</span>
            {ciudadesCp.length > 0 ? (
              <select
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                required
                className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
              >
                {ciudadesCp.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                required
                className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
              />
            )}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium">Colonia</span>
            {coloniasCp.length > 0 ? (
              <select
                value={colonia}
                onChange={(e) => setColonia(e.target.value)}
                required
                className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
              >
                {coloniasCp.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={colonia}
                onChange={(e) => setColonia(e.target.value)}
                required
                className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark"
              />
            )}
          </label>
          <Field etiqueta="Calle" value={calle} onChange={(e) => setCalle(e.target.value)} required />
          <Field etiqueta="Número" value={numero} onChange={(e) => setNumero(e.target.value)} required />
          <Field etiqueta="Correo para facturación" type="email" value={correoFacturacion} onChange={(e) => setCorreoFacturacion(e.target.value)} />
        </div>
        <Field
          etiqueta="Referencias"
          value={referencias}
          onChange={(e) => setReferencias(e.target.value)}
          placeholder="Entre calles, color de fachada, acceso, piso, etc."
        />
      </div>

      {mensaje && (
        <div role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        </div>
      )}

      <div>
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
