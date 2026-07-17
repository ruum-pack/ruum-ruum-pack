"use client";

import { ChangeEvent, useEffect, useState, useTransition } from "react";
import { Aviso, Button, Card } from "@ruum/ui";
import { actualizarPerfilConductor, subirFotoPerfilConductor } from "@ruum/api/services";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { CuentaHeader } from "../CuentaHeader";
import { cargarConductorCuenta, telefonoE164, type ConductorCuenta } from "../cuenta-utils";
import { DatosSensiblesInfo, enmascararUltimos } from "../datos-sensibles";

const PERFIL_DEFAULT = {
  nombre: "",
  telefono: "",
  curp: "",
  licencia_numero: "",
  licencia_tipo: "",
  licencia_vigencia: "",
  codigo_postal: "",
  estado_residencia: "",
  ciudad_municipio: "",
  colonia: "",
  calle: "",
  numero: "",
  referencias: "",
  contacto_emergencia_nombre: "",
  contacto_emergencia_telefono: ""
};

type CampoPerfil = keyof typeof PERFIL_DEFAULT;
type CampoSensiblePerfil = "curp" | "licencia_numero" | "contacto_emergencia_nombre" | "contacto_emergencia_telefono";

const CAMPOS: { clave: CampoPerfil; etiqueta: string; tipo?: string; colSpan?: string }[] = [
  { clave: "nombre", etiqueta: "Nombre completo" },
  { clave: "telefono", etiqueta: "Teléfono" },
  { clave: "curp", etiqueta: "CURP" },
  { clave: "licencia_numero", etiqueta: "Número de licencia" },
  { clave: "licencia_tipo", etiqueta: "Tipo de licencia" },
  { clave: "licencia_vigencia", etiqueta: "Vigencia de licencia", tipo: "date" },
  { clave: "codigo_postal", etiqueta: "Código postal" },
  { clave: "estado_residencia", etiqueta: "Estado" },
  { clave: "ciudad_municipio", etiqueta: "Ciudad o municipio" },
  { clave: "colonia", etiqueta: "Colonia" },
  { clave: "calle", etiqueta: "Calle" },
  { clave: "numero", etiqueta: "Número" },
  { clave: "referencias", etiqueta: "Referencias", colSpan: "sm:col-span-2" },
  { clave: "contacto_emergencia_nombre", etiqueta: "Contacto de emergencia" },
  { clave: "contacto_emergencia_telefono", etiqueta: "Teléfono de emergencia" }
];

const CAMPOS_SENSIBLES = new Set<CampoPerfil>(["curp", "licencia_numero", "contacto_emergencia_nombre", "contacto_emergencia_telefono"]);

function perfilDesdeConductor(conductor: ConductorCuenta | null) {
  return {
    nombre: conductor?.nombre ?? "",
    telefono: conductor?.telefono ?? "",
    curp: conductor?.curp ?? "",
    licencia_numero: conductor?.licencia_numero ?? "",
    licencia_tipo: conductor?.licencia_tipo ?? "",
    licencia_vigencia: conductor?.licencia_vigencia ?? "",
    codigo_postal: conductor?.codigo_postal ?? "",
    estado_residencia: conductor?.estado_residencia ?? "",
    ciudad_municipio: conductor?.ciudad_municipio ?? "",
    colonia: conductor?.colonia ?? "",
    calle: conductor?.calle ?? "",
    numero: conductor?.numero ?? "",
    referencias: conductor?.referencias ?? "",
    contacto_emergencia_nombre: conductor?.contacto_emergencia_nombre ?? "",
    contacto_emergencia_telefono: conductor?.contacto_emergencia_telefono ?? ""
  };
}

export default function PaginaPerfilCuenta() {
  const [conductor, setConductor] = useState<ConductorCuenta | null>(null);
  const [perfil, setPerfil] = useState(PERFIL_DEFAULT);
  const [sensiblesEditados, setSensiblesEditados] = useState<Set<CampoSensiblePerfil>>(new Set());
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  async function cargar() {
    const actual = await cargarConductorCuenta();
    setConductor(actual);
    const siguiente = perfilDesdeConductor(actual);
    siguiente.curp = "";
    siguiente.licencia_numero = "";
    siguiente.contacto_emergencia_nombre = "";
    siguiente.contacto_emergencia_telefono = "";
    setPerfil(siguiente);
    setSensiblesEditados(new Set());
    setCargando(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function guardarPerfil() {
    if (!conductor) return;
    if (sensiblesEditados.size > 0) {
      const confirmado = window.confirm("Vas a cambiar datos sensibles de tu expediente. Operación podría revisarlos nuevamente. ¿Quieres guardar?");
      if (!confirmado) return;
    }
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        const perfilParaGuardar = {
          ...perfil,
          curp: sensiblesEditados.has("curp") ? perfil.curp : conductor.curp ?? "",
          licencia_numero: sensiblesEditados.has("licencia_numero") ? perfil.licencia_numero : conductor.licencia_numero ?? "",
          contacto_emergencia_nombre: sensiblesEditados.has("contacto_emergencia_nombre") ? perfil.contacto_emergencia_nombre : conductor.contacto_emergencia_nombre ?? "",
          contacto_emergencia_telefono: sensiblesEditados.has("contacto_emergencia_telefono") ? perfil.contacto_emergencia_telefono : conductor.contacto_emergencia_telefono ?? ""
        };
        await actualizarPerfilConductor(cliente, conductor.id, {
          ...perfilParaGuardar,
          telefono: telefonoE164(perfilParaGuardar.telefono),
          contacto_emergencia_telefono: telefonoE164(perfilParaGuardar.contacto_emergencia_telefono)
        });
        setMensaje("Perfil actualizado.");
        await cargar();
      } catch (error) {
        setMensaje(traducirErrorOperativo(error, "No se pudo actualizar el perfil."));
      }
    });
  }

  async function subirFotoPerfil(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo || !conductor) return;
    setMensaje(null);
    setSubiendoFoto(true);
    try {
      const cliente = crearClienteNavegador();
      const fotoUrl = await subirFotoPerfilConductor(cliente, conductor.id, archivo);
      setConductor({ ...conductor, foto_perfil_url: fotoUrl });
      setMensaje("Fotografía de perfil actualizada.");
    } catch (error) {
      setMensaje(traducirErrorOperativo(error, "No pudimos actualizar la fotografía de perfil."));
    } finally {
      setSubiendoFoto(false);
      evento.target.value = "";
    }
  }

  function placeholderSensible(campo: CampoPerfil) {
    if (!conductor) return "";
    if (campo === "curp") return conductor.curp ? `Registrado: ${enmascararUltimos(conductor.curp)}` : "";
    if (campo === "licencia_numero") return conductor.licencia_numero ? `Registrado: ${enmascararUltimos(conductor.licencia_numero)}` : "";
    if (campo === "contacto_emergencia_nombre") return conductor.contacto_emergencia_nombre ? "Contacto registrado" : "";
    if (campo === "contacto_emergencia_telefono") return conductor.contacto_emergencia_telefono ? `Registrado: ${enmascararUltimos(conductor.contacto_emergencia_telefono)}` : "";
    return "";
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <CuentaHeader titulo="Perfil" descripcion="Actualiza tus datos personales y de contacto operativo." />
      {mensaje && <div className="mt-5"><Aviso tono="info">{mensaje}</Aviso></div>}
      <Card className="mt-6">
        {cargando ? <p className="font-body text-sm text-text-secondary">Cargando perfil...</p> : (
          <div className="grid gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-signal-soft font-display text-3xl font-semibold text-text-primary">
                {conductor?.foto_perfil_url ? <img src={conductor.foto_perfil_url} alt="" className="h-full w-full object-cover" /> : (perfil.nombre || "CD").slice(0, 2).toUpperCase()}
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 font-body text-sm font-semibold text-text-secondary hover:border-signal">
                {subiendoFoto ? "Subiendo..." : "Subir o actualizar foto"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={subirFotoPerfil} disabled={!conductor || subiendoFoto} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {CAMPOS.map((campo) => (
                <label key={campo.clave} className={`grid gap-1 font-body text-sm font-semibold text-text-tertiary ${campo.colSpan ?? ""}`}>
                  {campo.etiqueta}
                  <input
                    type={campo.tipo ?? "text"}
                    value={perfil[campo.clave]}
                    placeholder={CAMPOS_SENSIBLES.has(campo.clave) ? placeholderSensible(campo.clave) : undefined}
                    onChange={(event) => {
                      if (CAMPOS_SENSIBLES.has(campo.clave)) {
                        setSensiblesEditados((actual) => new Set(actual).add(campo.clave as CampoSensiblePerfil));
                      }
                      setPerfil({ ...perfil, [campo.clave]: event.target.value });
                    }}
                    className="rounded-lg border border-border bg-surface px-3 py-2 font-body text-base normal-case tracking-normal text-text-primary"
                  />
                  {CAMPOS_SENSIBLES.has(campo.clave) && (
                    <span className="font-body text-sm normal-case tracking-normal text-text-secondary">Se muestra enmascarado. Escribe un valor nuevo solo si necesitas cambiarlo.</span>
                  )}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <DatosSensiblesInfo tipo="curp" compacto />
              <DatosSensiblesInfo tipo="licencia" compacto />
              <DatosSensiblesInfo tipo="contacto_emergencia" compacto />
            </div>
            <Button variant="secondary" onClick={guardarPerfil} disabled={!conductor || pendiente}>
              {pendiente ? "Guardando..." : "Guardar perfil"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
