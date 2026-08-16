"use client";

import { ConfirmDialog } from "../../../components/ConfirmDialog";

import { useEffect, useState } from "react";
import { Aviso, Button, Field, FinancialCard } from "@ruum/ui";
import { guardarDatosBancariosConductor, obtenerGananciasConductor } from "@ruum/api/services";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { CuentaHeader } from "../CuentaHeader";
import { cargarConductorCuenta } from "../cuenta-utils";
import { DatosSensiblesInfo, DatosSensiblesTooltip, enmascararUltimos } from "../datos-sensibles";

type DatosBancarios = Database["public"]["Tables"]["datos_bancarios_conductor"]["Row"];

const ETIQUETA_DATOS_BANCARIOS: Record<Database["public"]["Enums"]["estado_datos_bancarios_conductor"], string> = {
  en_revision: "Datos en revisión",
  verificada: "Datos verificados",
  rechazada: "Datos rechazados"
};

// Catálogo estándar de códigos SPEI para detección automática de banco en México
const CATALOGO_BANCOS_SPEI: Record<string, string> = {
  "002": "Citibanamex",
  "012": "BBVA México",
  "014": "Santander",
  "021": "HSBC",
  "030": "BanBajío",
  "036": "Inbursa",
  "044": "Scotiabank",
  "058": "Banregio",
  "062": "Afirme",
  "072": "Banorte",
  "127": "Banco Azteca",
  "130": "Compartamos",
  "137": "Banregio",
  "638": "Klar",
  "646": "STP (Sistema de Transferencias y Pagos)",
  "659": "Nu México"
};

function obtenerBancoPorClabe(clabe: string): string | null {
  const digitos = clabe.replace(/\D/g, "");
  if (digitos.length >= 3) {
    const codigo = digitos.slice(0, 3);
    return CATALOGO_BANCOS_SPEI[codigo] ?? null;
  }
  return null;
}

function formatearClabe(clabe: string): string {
  const digitos = clabe.replace(/\D/g, "").slice(0, 18);
  if (!digitos) return "";
  const partes = digitos.match(/.{1,4}/g) ?? [];
  return partes.join(" ");
}

function formatearTarjeta(tarjeta: string): string {
  const digitos = tarjeta.replace(/\D/g, "").slice(0, 16);
  if (!digitos) return "";
  const partes = digitos.match(/.{1,4}/g) ?? [];
  return partes.join(" ");
}

export default function PaginaDatosBancarios() {
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);
  const [datosBancarios, setDatosBancarios] = useState<DatosBancarios | null>(null);
  const [formulario, setFormulario] = useState({ titularCuenta: "", banco: "", clabe: "", numeroTarjeta: "" });
  const [edicionAutorizada, setEdicionAutorizada] = useState(false);
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmandoSesion, setConfirmandoSesion] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [bancoDetectadoAuto, setBancoDetectadoAuto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const conductor = await cargarConductorCuenta();
        if (!conductor) {
          setCargando(false);
          return;
        }
       const cliente = crearClienteNavegador();
       const ganancias = await obtenerGananciasConductor(cliente, conductor.id);
       const datos = ganancias.datosBancarios;
       setDatosBancarios(datos);
       if (datos) {
         setFormulario({
           titularCuenta: datos.titular_cuenta,
           banco: datos.banco,
           clabe: datos.clabe,
           numeroTarjeta: datos.numero_tarjeta
         });
         const detectado = obtenerBancoPorClabe(datos.clabe);
         setBancoDetectadoAuto(detectado);
       }
       setErrorCarga(null);
     } catch {
       setErrorCarga("No se pudieron cargar los datos bancarios. Inténtalo de nuevo.");
     } finally {
       setCargando(false);
     }
   }
   void cargar();
  }, []);

  function actualizarCampo(campo: keyof typeof formulario, valorRaw: string) {
    if (campo === "clabe") {
      const digitos = valorRaw.replace(/\D/g, "").slice(0, 18);
      const bancoDetectado = obtenerBancoPorClabe(digitos);
      setBancoDetectadoAuto(bancoDetectado);
      setFormulario((actual) => ({
        ...actual,
        clabe: digitos,
        banco: bancoDetectado ?? actual.banco
      }));
    } else if (campo === "numeroTarjeta") {
      const digitos = valorRaw.replace(/\D/g, "").slice(0, 16);
      setFormulario((actual) => ({ ...actual, numeroTarjeta: digitos }));
    } else {
      setFormulario((actual) => ({ ...actual, [campo]: valorRaw }));
    }
  }

  async function confirmarSesion() {
    setConfirmandoSesion(true);
    setMensaje(null);
    try {
      const cliente = crearClienteNavegador();
      const { data: sesion } = await cliente.auth.getUser();
      const email = sesion.user?.email;
      if (!email) throw new Error("Inicia sesión de nuevo para editar tus datos bancarios.");
      const { error } = await cliente.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setEdicionAutorizada(true);
      setPassword("");
      setMensaje("Sesión confirmada correctamente. Puedes editar tus datos bancarios para depósito.");
    } catch (error) {
      setMensaje(traducirErrorOperativo(error, "No pudimos confirmar tu sesión. Verifica tu contraseña."));
    } finally {
      setConfirmandoSesion(false);
    }
  }

  async function guardar() {
    if (!edicionAutorizada) {
      setMensaje("Confirma tu sesión antes de editar datos bancarios.");
      return;
    }
    if (!confirmacionAbierta) {
      setConfirmacionAbierta(true);
      return;
    }
    setConfirmacionAbierta(false);
    setGuardando(true);
    setMensaje(null);
    try {
      const cliente = crearClienteNavegador();
      const guardado = await guardarDatosBancariosConductor(cliente, formulario);
      setDatosBancarios(guardado);
      setEdicionAutorizada(false);
      setMensaje("Datos bancarios guardados. El equipo de operación revisará la cuenta antes de programar depósitos.");
    } catch (error) {
      setMensaje(traducirErrorOperativo(error, "No pudimos guardar tus datos bancarios."));
    } finally {
      setGuardando(false);
    }
  }

  const passwordListo = password.length >= 8;

  return (
    <>
      <ConfirmDialog
        open={confirmacionAbierta}
        title="Actualizar cuenta para depósitos"
        consequence="La cuenta quedará pendiente de revisión operativa y se utilizará para transferencias una vez aprobada."
        maskedData={[
          formulario.clabe ? `CLABE terminación ${formulario.clabe.slice(-4)}` : "CLABE no capturada",
          formulario.numeroTarjeta ? `Tarjeta terminación ${formulario.numeroTarjeta.slice(-4)}` : "Tarjeta no capturada"
        ]}
        confirmLabel="Guardar y enviar a revisión"
        busy={guardando}
        onCancel={() => setConfirmacionAbierta(false)}
        onConfirm={() => void guardar()}
      />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <CuentaHeader
          titulo="Datos bancarios"
          descripcion="Protegemos esta sección con confirmación de sesión porque determina el depósito de tus ganancias."
        />

        {mensaje && (
          <div className="mt-5">
            <Aviso tono="info">{mensaje}</Aviso>
          </div>
        )}

        <FinancialCard className="mt-6">
          {cargando ? (
            <div className="py-8 text-center font-body text-sm text-text-secondary">
              Cargando datos bancarios...
            </div>
          ) : errorCarga ? (
            <div className="py-8 text-center">
              <Aviso tono="danger">{errorCarga}</Aviso>
            </div>
          ) : (
            <div className="grid gap-6">
              {/* Encabezado con Tooltip e Insignia de Estado */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
                    Cuenta para transferencias
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-text-primary">
                      Información sensible de depósito
                    </h2>
                    <DatosSensiblesTooltip tipo="cuenta_bancaria" align="start" />
                  </div>
                  <p className="mt-1 font-body text-xs text-text-tertiary">
                    Cualquier modificación vuelve a revisión operativa por seguridad financiera.
                  </p>
                </div>

                {datosBancarios && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-body text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ✓ {ETIQUETA_DATOS_BANCARIOS[datosBancarios.estado]}
                  </span>
                )}
              </div>

              {/* 2. Reducción de Texto: Acordeón explicativo desplegable */}
              <details className="group rounded-xl border border-border/60 bg-surface-elevated/40 p-3.5 transition hover:border-border">
                <summary className="flex cursor-pointer items-center justify-between font-display text-xs font-bold text-route-action select-none">
                  <span className="flex items-center gap-2">
                    🔒 Conoce las medidas de protección para tus datos bancarios
                  </span>
                  <span className="text-sm transition-transform duration-200 group-open:rotate-180">▼</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-border/30">
                  <DatosSensiblesInfo tipo="cuenta_bancaria" compacto />
                </div>
              </details>

              {datosBancarios?.motivo_rechazo && (
                <Aviso tono="atencion">
                  Motivo de rechazo previo: {datosBancarios.motivo_rechazo}
                </Aviso>
              )}

              {/* 1. Muro de Seguridad (Security Gate) */}
              {!edicionAutorizada ? (
                <div className="grid gap-5 rounded-2xl border border-border/80 bg-surface-elevated/40 p-5 shadow-xs">
                  {/* 2. Estado vacío libre de confusión */}
                  {!datosBancarios && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 font-body text-xs font-semibold text-amber-900 dark:text-amber-200">
                      ⚠️ Aún no has registrado tus datos bancarios para depósito. Confirma tu sesión a continuación para capturarlos.
                    </div>
                  )}

                  <div className="grid gap-3">
                    <p className="font-display text-xs font-bold uppercase tracking-wider text-text-tertiary">
                      Estado actual de datos
                    </p>

                    <dl className="grid gap-3.5 font-body text-sm sm:grid-cols-2 rounded-xl border border-border/40 bg-surface p-4">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Titular de la cuenta</dt>
                        <dd className="mt-1 font-display text-sm font-bold text-text-primary">
                          {datosBancarios ? "Registrado (Protegido)" : <span className="italic text-text-tertiary/70">— Sin registrar</span>}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Banco emisor</dt>
                        <dd className="mt-1 font-display text-sm font-bold text-text-primary">
                          {formulario.banco || <span className="italic text-text-tertiary/70">— Sin registrar</span>}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">CLABE Interbancaria</dt>
                        <dd className="mt-1 font-mono text-sm font-bold text-text-primary">
                          {formulario.clabe ? enmascararUltimos(formulario.clabe) : <span className="italic font-body text-text-tertiary/70">— Sin registrar</span>}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Número de Tarjeta</dt>
                        <dd className="mt-1 font-mono text-sm font-bold text-text-primary">
                          {formulario.numeroTarjeta ? enmascararUltimos(formulario.numeroTarjeta) : <span className="italic font-body text-text-tertiary/70">— Sin registrar</span>}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Campo Contraseña con Revelar/Ocultar y Botón Sólido */}
                  <div className="grid gap-3 pt-2 border-t border-border/40">
                    <div className="relative flex flex-col gap-1.5">
                      <label htmlFor="gate-password" className="font-body text-sm font-semibold text-text-primary">
                        Confirma tu contraseña para desbloquear edición
                      </label>

                      <div className="relative flex items-center">
                        <input
                          id="gate-password"
                          type={mostrarPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Ingresa tu contraseña actual"
                          autoComplete="current-password"
                          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 pr-11 font-body text-base text-text-primary outline-none focus:border-signal"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarPassword((v) => !v)}
                          aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          className="absolute right-3 text-lg text-text-tertiary hover:text-text-primary focus:outline-none"
                        >
                          {mostrarPassword ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </div>

                    {/* 1. Botón Sólido cuando el password está listo + Spinner */}
                    <button
                      type="button"
                      onClick={() => void confirmarSesion()}
                      disabled={confirmandoSesion || !passwordListo}
                      className={[
                        "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-display text-sm font-bold leading-5 transition-all duration-150 shadow-sm",
                        passwordListo
                          ? "bg-signal text-text-primary hover:bg-signal/90 hover:-translate-y-0.5 active:translate-y-0 shadow-md cursor-pointer"
                          : "border border-border/80 bg-surface-elevated text-text-tertiary/60 cursor-not-allowed opacity-75"
                      ].join(" ")}
                    >
                      {confirmandoSesion ? (
                        <>
                          <span className="size-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                          Verificando contraseña...
                        </>
                      ) : (
                        "Confirmar sesión y editar datos"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Formulario de Edición Desbloqueado */
                <div className="grid gap-5">
                  <Aviso tono="atencion">
                    Estás editando datos bancarios sensibles. Confirma que la cuenta pertenezca al titular registrado antes de guardar.
                  </Aviso>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      etiqueta="Titular de la cuenta"
                      value={formulario.titularCuenta}
                      onChange={(e) => actualizarCampo("titularCuenta", e.target.value)}
                      placeholder="Nombre tal como aparece en el banco"
                    />

                    <div className="grid gap-1">
                      <Field
                        etiqueta="Banco emisor"
                        value={formulario.banco}
                        onChange={(e) => actualizarCampo("banco", e.target.value)}
                        placeholder="Ej. Citibanamex, BBVA, Nu"
                      />
                      {/* 3. Detección automática del Banco SPEI */}
                      {bancoDetectadoAuto && (
                        <span className="font-body text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ Banco detectado por código SPEI ({bancoDetectadoAuto})
                        </span>
                      )}
                    </div>

                    {/* 3. Máscara de Entrada CLABE en bloques */}
                    <div className="grid gap-1">
                      <Field
                        etiqueta="CLABE Interbancaria (18 dígitos)"
                        value={formatearClabe(formulario.clabe)}
                        onChange={(e) => actualizarCampo("clabe", e.target.value)}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={22}
                        placeholder="1234 5678 9012 3456 78"
                      />
                      <span className="font-body text-xs text-text-tertiary">
                        {formulario.clabe.length}/18 dígitos capturados
                      </span>
                    </div>

                    {/* 3. Máscara de Entrada Tarjeta en bloques de 4 */}
                    <div className="grid gap-1">
                      <Field
                        etiqueta="Número de tarjeta de débito (16 dígitos)"
                        value={formatearTarjeta(formulario.numeroTarjeta)}
                        onChange={(e) => actualizarCampo("numeroTarjeta", e.target.value)}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={19}
                        placeholder="1234 5678 9012 3456"
                      />
                      <span className="font-body text-xs text-text-tertiary">
                        {formulario.numeroTarjeta.length}/16 dígitos capturados
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => void guardar()}
                    loading={guardando}
                    disabled={
                      guardando ||
                      formulario.titularCuenta.trim().length < 3 ||
                      formulario.banco.trim().length < 2 ||
                      formulario.clabe.length !== 18 ||
                      formulario.numeroTarjeta.length < 16
                    }
                    className="w-full sm:w-auto"
                  >
                    {guardando ? "Guardando datos bancarios..." : "Guardar datos bancarios"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </FinancialCard>
      </div>
    </>
  );
}
