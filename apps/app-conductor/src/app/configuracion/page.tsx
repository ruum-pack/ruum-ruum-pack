"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import {
  actualizarPerfilConductor,
  guardarPreferenciasConductor,
  obtenerConductorActual,
  obtenerConfiguracionConductor,
  subirDocumentoConductor,
  subirFotoPerfilConductor,
  type TipoDocumentoConductor
} from "@ruum/api/services";
import { limpiarBorradorRegistroLocal } from "../../lib/borrador-registro";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

type Bloque = "cuenta" | "documentos" | "preferencias" | "soporte";
type Conductor = Database["public"]["Tables"]["conductores"]["Row"];
type Documento = Database["public"]["Tables"]["documentos_conductor"]["Row"];
type Preferencias = Database["public"]["Tables"]["preferencias_conductor"]["Row"];

const BLOQUES: { id: Bloque; titulo: string; descripcion: string }[] = [
  { id: "cuenta", titulo: "Cuenta", descripcion: "Perfil, seguridad y validación operativa." },
  { id: "documentos", titulo: "Documentos", descripcion: "Expediente operativo, vigencias y carga desde celular." },
  { id: "preferencias", titulo: "Preferencias", descripcion: "Notificaciones y tipos de viaje que quieres recibir." },
  { id: "soporte", titulo: "Soporte", descripcion: "Ayuda, reportes, cierre de sesión y eliminación de cuenta." }
];

const PREFS_DEFAULT = {
  notificaciones_push: true,
  modo_no_molestar: false,
  alertas_viaje: true,
  alertas_pago: true,
  alertas_documentos: true,
  alertas_admin: false,
  viajes_locales: true,
  viajes_foraneos: true,
  viajes_nocturnos: false,
  viajes_empresariales: true,
  viajes_personales: true
};

const ESTADO_DOCUMENTO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente de carga", clase: "border-ink/15 bg-ink/[0.04] text-ink/60" },
  en_revision: { texto: "En revisión", clase: "border-route/30 bg-route-soft text-route-dark" },
  aprobado: { texto: "Aprobado", clase: "border-control/30 bg-control-soft text-control" },
  rechazado: { texto: "Rechazado", clase: "border-danger/25 bg-danger-soft text-danger" },
  reemplazado: { texto: "Reemplazado", clase: "border-ink/15 bg-ink/[0.04] text-ink/55" },
  vencido: { texto: "Vencido", clase: "border-danger/25 bg-danger-soft text-danger" },
};

const TIPOS_DOCUMENTO: { valor: TipoDocumentoConductor; etiqueta: string }[] = [
  { valor: "licencia_frente", etiqueta: "Licencia - frente" },
  { valor: "licencia_reverso", etiqueta: "Licencia - reverso" },
  { valor: "identificacion_oficial", etiqueta: "Identificación oficial" },
  { valor: "documento_operativo", etiqueta: "Documento operativo adicional" }
];

const WHATSAPP_SOPORTE = "https://wa.me/525500004911?text=Hola%20Ruum%20Ruum%2C%20necesito%20soporte%20como%20conductor.";

const SOPORTE = [
  { etiqueta: "Preguntas frecuentes", href: "#preguntas-frecuentes" },
  { etiqueta: "Contactar por WhatsApp", href: WHATSAPP_SOPORTE },
  { etiqueta: "Llamar a soporte", href: "tel:+525500004911" },
  { etiqueta: "Reportar problema", href: "/viajes" },
  { etiqueta: "Ayuda con pagos y documentos", href: "mailto:soporte-conductores@ruumruum.mx?subject=Ayuda%20con%20pagos%20o%20documentos" },
  { etiqueta: "Términos y aviso de privacidad", href: "https://ruumruum.mx/legal" }
];

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

const CAMPOS_PERFIL: { clave: CampoPerfil; etiqueta: string; tipo?: string; colSpan?: string }[] = [
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

function dato(label: string, valor: string | number | null | undefined) {
  return (
    <div>
      <dt className="font-body text-xs uppercase tracking-wide text-ink/45">{label}</dt>
      <dd className="mt-1 font-body text-sm font-medium">{valor ?? "Sin dato"}</dd>
    </div>
  );
}

function fecha(fechaIso: string | null | undefined) {
  if (!fechaIso) return "Pendiente";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(fechaIso));
}

function telefonoE164(valor: string) {
  const normalizado = valor.trim();
  if (!normalizado) return normalizado;
  return (normalizado.startsWith("+") ? normalizado : `+${normalizado}`).replace(/\s+/g, "");
}

export default function PaginaConfiguracion() {
  const [bloque, setBloque] = useState<Bloque>("cuenta");
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [prefs, setPrefs] = useState(PREFS_DEFAULT);
  const [perfil, setPerfil] = useState(PERFIL_DEFAULT);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoConductor>("documento_operativo");
  const [subiendoDocumento, setSubiendoDocumento] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const panelDebeEnfocarseRef = useRef(false);
  const router = useRouter();

  async function cargar() {
    if (!tieneSupabaseConfigurado()) {
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const actual = await obtenerConductorActual(cliente);
      if (!actual) {
        setCargando(false);
        return;
      }
      const datos = await obtenerConfiguracionConductor(cliente, actual.id);
      setConductor(datos.conductor);
      setPerfil({
        nombre: datos.conductor.nombre ?? "",
        telefono: datos.conductor.telefono ?? "",
        curp: datos.conductor.curp ?? "",
        licencia_numero: datos.conductor.licencia_numero ?? "",
        licencia_tipo: datos.conductor.licencia_tipo ?? "",
        licencia_vigencia: datos.conductor.licencia_vigencia ?? "",
        codigo_postal: datos.conductor.codigo_postal ?? "",
        estado_residencia: datos.conductor.estado_residencia ?? "",
        ciudad_municipio: datos.conductor.ciudad_municipio ?? "",
        colonia: datos.conductor.colonia ?? "",
        calle: datos.conductor.calle ?? "",
        numero: datos.conductor.numero ?? "",
        referencias: datos.conductor.referencias ?? "",
        contacto_emergencia_nombre: datos.conductor.contacto_emergencia_nombre ?? "",
        contacto_emergencia_telefono: datos.conductor.contacto_emergencia_telefono ?? ""
      });
      setDocumentos(datos.documentos);
      setPrefs({ ...PREFS_DEFAULT, ...(datos.preferencias as Preferencias | null ?? {}) });
    } catch {
      setMensaje("No se pudo cargar la configuración real. Revisa tu sesión.");
    } finally {
      setCargando(false);
    }
  }

 useEffect(() => {
  const timer = setTimeout(() => { void cargar(); }, 0);
  return () => clearTimeout(timer);
}, []);

  useEffect(() => {
    if (!panelDebeEnfocarseRef.current || cargando) return;
    panelDebeEnfocarseRef.current = false;
    window.requestAnimationFrame(() => {
      document.getElementById(`panel-${bloque}`)?.focus();
    });
  }, [bloque, cargando]);

  const preferenciasActivas = useMemo(
    () =>
      [
        prefs.viajes_locales && "Viajes locales",
        prefs.viajes_foraneos && "Viajes foráneos",
        prefs.viajes_nocturnos && "Nocturnos con autorización",
        prefs.viajes_empresariales && "Empresariales",
        prefs.viajes_personales && "Personales"
      ].filter(Boolean) as string[],
    [prefs]
  );

  function guardarPerfil() {
    if (!conductor) return;
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await actualizarPerfilConductor(cliente, conductor.id, {
          nombre: perfil.nombre,
          telefono: telefonoE164(perfil.telefono),
          curp: perfil.curp,
          licencia_numero: perfil.licencia_numero,
          licencia_tipo: perfil.licencia_tipo,
          licencia_vigencia: perfil.licencia_vigencia,
          codigo_postal: perfil.codigo_postal,
          estado_residencia: perfil.estado_residencia,
          ciudad_municipio: perfil.ciudad_municipio,
          colonia: perfil.colonia,
          calle: perfil.calle,
          numero: perfil.numero,
          referencias: perfil.referencias,
          contacto_emergencia_nombre: perfil.contacto_emergencia_nombre,
          contacto_emergencia_telefono: telefonoE164(perfil.contacto_emergencia_telefono)
        });
        setMensaje("Perfil actualizado.");
        await cargar();
      } catch (error) {
        setMensaje(traducirErrorOperativo(error,"No se pudo actualizar el perfil."));
      }
    });
  }

  function guardarPrefs() {
    if (!conductor) return;
    setMensaje(null);
    startTransition(async () => {
      try {
        const cliente = crearClienteNavegador();
        await guardarPreferenciasConductor(cliente, conductor.id, prefs);
        setMensaje("Preferencias guardadas.");
      } catch (error) {
        setMensaje(traducirErrorOperativo(error,"No se pudieron guardar las preferencias."));
      }
    });
  }

  async function subirDocumento(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo || !conductor) return;
    setMensaje(null);
    setSubiendoDocumento(true);
    try {
      const cliente = crearClienteNavegador();
      await subirDocumentoConductor(cliente, conductor.id, tipoDocumento, archivo);
      setMensaje("Documento cargado y enviado a revisión.");
      await cargar();
    } catch (error) {
      setMensaje(traducirErrorOperativo(error,"No pudimos registrar uno de tus documentos."));
    } finally {
      setSubiendoDocumento(false);
      evento.target.value = "";
    }
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

  async function cerrarSesion() {
    if (!tieneSupabaseConfigurado()) return;
    setCerrandoSesion(true);
    try {
      const cliente = crearClienteNavegador();
      await cliente.auth.signOut();
      limpiarBorradorRegistroLocal();
      router.push("/onboarding");
      router.refresh();
    } catch {
      setCerrandoSesion(false);
    }
  }

  function seleccionarBloque(id: Bloque) {
    panelDebeEnfocarseRef.current = true;
    setBloque(id);
  }

  function navegarTabs(evento: KeyboardEvent<HTMLButtonElement>, idActual: Bloque) {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      seleccionarBloque(idActual);
      return;
    }

    if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;

    evento.preventDefault();
    const indiceActual = BLOQUES.findIndex((item) => item.id === idActual);
    const desplazamiento = evento.key === "ArrowRight" ? 1 : -1;
    const indiceSiguiente = (indiceActual + desplazamiento + BLOQUES.length) % BLOQUES.length;
    const siguienteBloque = BLOQUES[indiceSiguiente].id;

    seleccionarBloque(siguienteBloque);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/panel" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">Panel</Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">Configuración de Ruum Ruum Conductor</h1>
          <p className="mt-2 font-body text-sm text-ink/60">Administra cuenta, documentos, preferencias y soporte operativo.</p>
        </div>
        <Link href="/viajes"><Button variant="secundario">Volver a viajes</Button></Link>
      </header>

      {mensaje && <div className="mt-5"><Aviso tono="info">{mensaje}</Aviso></div>}
      {!conductor && !cargando && tieneSupabaseConfigurado() && (
        <div className="mt-5"><Aviso tono="info">Inicia sesión para gestionar tu configuración real.</Aviso></div>
      )}

      <nav role="tablist" className="mt-6 grid gap-2 sm:grid-cols-4" aria-label="Bloques de configuración">
        {BLOQUES.map((item) => (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            role="tab"
            aria-selected={bloque === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={bloque === item.id ? 0 : -1}
            onClick={() => seleccionarBloque(item.id)}
            onKeyDown={(evento) => navegarTabs(evento, item.id)}
            className={[
              "rounded-lg border px-4 py-3 text-left transition-colors",
              bloque === item.id ? "border-signal bg-signal-soft text-ink" : "border-ink/10 bg-mist text-ink/65 hover:border-ink/25"
            ].join(" ")}
          >
            <span className="block font-body text-sm font-semibold">{item.titulo}</span>
            <span className="mt-1 block font-body text-xs leading-5">{item.descripcion}</span>
          </button>
        ))}
      </nav>

      {cargando ? (
        <p className="mt-8 font-body text-sm text-ink/50">Cargando configuración...</p>
      ) : bloque === "cuenta" ? (
        <section
          role="tabpanel"
          id="panel-cuenta"
          aria-labelledby="tab-cuenta"
          tabIndex={0}
          className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]"
        >
          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Perfil del conductor</p>
            <div className="mt-4 flex flex-col gap-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-signal-soft font-display text-3xl font-semibold text-ink">
                  {conductor?.foto_perfil_url ? (
                    <img src={conductor.foto_perfil_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (perfil.nombre || "CD").slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="grid gap-2">
                  <label
                    aria-disabled={!conductor || subiendoFoto}
                    className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-ink/15 bg-mist px-4 py-2 font-body text-sm font-semibold text-ink/70 hover:border-signal aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  >
                    {subiendoFoto ? "Subiendo..." : "Subir o actualizar foto"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={subirFotoPerfil}
                      disabled={!conductor || subiendoFoto}
                    />
                  </label>
                  <p className="font-body text-xs text-ink/50">JPG, PNG o WEBP. Tamaño máximo: 5 MB.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {CAMPOS_PERFIL.map((campo) => (
                  <label key={campo.clave} className={`grid gap-1 font-body text-xs uppercase tracking-wide text-ink/45 ${campo.colSpan ?? ""}`}>
                    {campo.etiqueta}
                    <input
                      type={campo.tipo ?? "text"}
                      value={perfil[campo.clave]}
                      onChange={(e) => setPerfil({ ...perfil, [campo.clave]: e.target.value })}
                      className="rounded-lg border border-ink/20 bg-mist px-3 py-2 font-body text-sm normal-case tracking-normal text-ink"
                    />
                  </label>
                ))}
              </div>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {dato("Estado operativo", conductor?.estado ?? "Sin datos")}
              {dato("Nivel CONCER", conductor?.nivel_operativo_vigente ?? "Básico")}
              {dato("Calificación", conductor?.calificacion_promedio ?? 5)}
              {dato("Traslados completados", conductor?.traslados_completados ?? 0)}
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secundario" onClick={guardarPerfil} disabled={!conductor || pendiente}>{pendiente ? "Guardando..." : "Guardar perfil"}</Button>
              <Link href="/recuperar-password"><Button variant="fantasma">Cambiar contraseña</Button></Link>
            </div>
          </PassportCard>

          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Validación operativa</p>
            <dl className="mt-4 grid gap-4">
              {dato("Documentos vigentes", conductor?.documentos_vigentes ? "Sí" : "No")}
              {dato("No presentaciones 6m", conductor?.no_presentaciones_6m ?? 0)}
              {dato("Suspensiones activas", conductor?.suspensiones_activas ?? 0)}
              {dato("Alta", conductor ? fecha(conductor.creado_en) : "Sin datos")}
            </dl>
            <Aviso tono="atencion">La validación final de documentos y bancos la realiza operación.</Aviso>
          </PassportCard>
        </section>
      ) : bloque === "documentos" ? (
        <section
          role="tabpanel"
          id="panel-documentos"
          aria-labelledby="tab-documentos"
          tabIndex={0}
          className="mt-6"
        >
          <PassportCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-ink/45">Documentos principales</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Expediente del conductor</h2>
              </div>
              <div className="grid gap-2 sm:min-w-72">
                <label className="grid gap-1 font-body text-xs uppercase tracking-wide text-ink/45">
                  Tipo de documento
                  <select
                    value={tipoDocumento}
                    onChange={(e) => setTipoDocumento(e.target.value as TipoDocumentoConductor)}
                    disabled={!conductor || subiendoDocumento}
                    className="rounded-lg border border-ink/20 bg-mist px-3 py-2 font-body text-sm normal-case tracking-normal text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {TIPOS_DOCUMENTO.map((tipo) => (
                      <option key={tipo.valor} value={tipo.valor}>{tipo.etiqueta}</option>
                    ))}
                  </select>
                </label>
                <label
                  aria-disabled={!conductor || subiendoDocumento}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-signal bg-signal px-4 py-2 font-body text-sm font-semibold text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                >
                  {subiendoDocumento ? "Subiendo..." : "Subir archivo o fotografía"}
                  <input type="file" accept="image/*,.pdf" className="sr-only" onChange={subirDocumento} disabled={!conductor || subiendoDocumento} />
                </label>
                <p className="font-body text-xs text-ink/50">Formatos permitidos: imagen o PDF. Tamaño máximo: 10 MB.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {documentos.length === 0 && <p className="font-body text-sm text-ink/55">Aún no hay documentos cargados.</p>}
              {documentos.map((doc) => {
                const estado = ESTADO_DOCUMENTO[doc.estado] ?? ESTADO_DOCUMENTO.en_revision;
                return (
                  <div key={doc.id} className="rounded-lg border border-ink/10 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-body text-sm font-semibold">{doc.nombre_archivo}</p>
                        <p className="mt-1 font-body text-xs text-ink/50">{doc.tipo} · cargado {fecha(doc.creado_en)}</p>
                        <p className="mt-2 font-body text-sm text-ink/60">{doc.notas_admin ?? "Operación revisará el archivo."}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1.5 text-center font-body text-xs font-semibold ${estado.clase}`}>{estado.texto}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </PassportCard>
        </section>
      ) : bloque === "preferencias" ? (
        <section
          role="tabpanel"
          id="panel-preferencias"
          aria-labelledby="tab-preferencias"
          tabIndex={0}
          className="mt-6 grid gap-6 lg:grid-cols-2"
        >
          <PassportCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-ink/45">Notificaciones</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Canales y alertas</h2>
              </div>
              <Button variant="secundario" onClick={guardarPrefs} disabled={!conductor || pendiente}>Guardar</Button>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ["Push", "notificaciones_push"],
                ["Modo no molestar 22:00 - 07:00", "modo_no_molestar"],
                ["Alertas de nuevos viajes", "alertas_viaje"],
                ["Pagos", "alertas_pago"],
                ["Documentos", "alertas_documentos"],
                ["Administrativas", "alertas_admin"]
              ].map(([label, clave]) => (
                <label key={clave} className="flex items-center justify-between gap-4 rounded-lg border border-ink/10 px-4 py-3">
                  <span className="font-body text-sm font-medium">{label}</span>
                  <input type="checkbox" checked={Boolean(prefs[clave as keyof typeof prefs])} onChange={(event) => setPrefs({ ...prefs, [clave]: event.target.checked })} className="h-5 w-5 accent-signal" />
                </label>
              ))}
            </div>
          </PassportCard>

          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Preferencias de viaje</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Asignación inteligente</h2>
            <div className="mt-5 grid gap-3">
              {[
                ["Viajes locales", "viajes_locales"],
                ["Viajes foráneos", "viajes_foraneos"],
                ["Nocturnos", "viajes_nocturnos"],
                ["Empresariales", "viajes_empresariales"],
                ["Personales", "viajes_personales"]
              ].map(([label, clave]) => (
                <label key={clave} className="flex items-center justify-between gap-4 rounded-lg border border-ink/10 px-4 py-3">
                  <span className="font-body text-sm font-medium">{label}</span>
                  <input type="checkbox" checked={Boolean(prefs[clave as keyof typeof prefs])} onChange={(event) => setPrefs({ ...prefs, [clave]: event.target.checked })} className="h-5 w-5 accent-signal" />
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {preferenciasActivas.map((preferencia) => (
                <span key={preferencia} className="rounded-full border border-ink/10 bg-ink/[0.03] px-3 py-1.5 font-body text-xs font-medium text-ink/65">{preferencia}</span>
              ))}
            </div>
          </PassportCard>
        </section>
      ) : (
        <section
          role="tabpanel"
          id="panel-soporte"
          aria-labelledby="tab-soporte"
          tabIndex={0}
          className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]"
        >
          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Soporte</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Ayuda operativa</h2>
            <div className="mt-5 grid gap-3">
              {SOPORTE.map((opcion) => (
                <a
                  key={opcion.etiqueta}
                  href={opcion.href}
                  target={opcion.href.startsWith("http") ? "_blank" : undefined}
                  rel={opcion.href.startsWith("http") ? "noreferrer" : undefined}
                  className="rounded-lg border border-ink/10 px-4 py-3 text-left font-body text-sm font-medium text-ink/70 hover:border-ink/25"
                >
                  {opcion.etiqueta}
                </a>
              ))}
            </div>
            <div id="preguntas-frecuentes" className="mt-5 rounded-lg border border-ink/10 px-4 py-3">
              <p className="font-body text-sm font-semibold">Preguntas frecuentes</p>
              <p className="mt-1 font-body text-sm text-ink/60">Para urgencias operativas usa WhatsApp o llamada. Para emergencias reales, usa el botón Emergencia / 911 dentro del viaje activo.</p>
            </div>
          </PassportCard>

          <PassportCard>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Acceso y cuenta</p>
            <div className="mt-4 grid gap-3">
              {tieneSupabaseConfigurado() ? (
                <Button variant="secundario" onClick={cerrarSesion} disabled={cerrandoSesion}>{cerrandoSesion ? "Cerrando sesión..." : "Cerrar sesión"}</Button>
              ) : (
                <div className="rounded-lg border border-ink/10 px-4 py-3"><p className="font-body text-sm text-ink/55">Conecta Supabase para gestionar tu sesión.</p></div>
              )}
              <div className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-4">
                <p className="font-body text-sm font-semibold text-danger">Eliminar cuenta</p>
                <p className="mt-2 font-body text-sm text-ink/65">Solicita a soporte la baja operativa y validación de identidad antes de desactivar el acceso.</p>
                <div className="mt-4"><a href="mailto:soporte-conductores@ruumruum.mx?subject=Baja%20de%20cuenta"><Button variant="fantasma">Solicitar baja</Button></a></div>
              </div>
            </div>
          </PassportCard>
        </section>
      )}
    </div>
  );
}
