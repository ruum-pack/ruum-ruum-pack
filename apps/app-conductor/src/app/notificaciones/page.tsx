"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Button, Card } from "@ruum/ui";
import { crearClienteNavegador } from "../../lib/supabase-browser";

type Notificacion = {
  id: string; tipo: string; titulo: string; cuerpo: string; destino: string;
  entidad_tipo: string | null; entidad_id: string | null; leida_en: string | null;
  estado: string; creado_en: string;
};

export default function CentroNotificaciones() {
  const [items, setItems] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();

  const cargar = useCallback(async () => {
    const cliente = crearClienteNavegador();
    const { data, error } = await (cliente as any).from("notificaciones_conductor").select("id,tipo,titulo,cuerpo,destino,entidad_tipo,entidad_id,leida_en,estado,creado_en").order("creado_en", { ascending: false }).limit(100);
    if (!error) setItems((data ?? []) as Notificacion[]);
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
    const actualizar = () => void cargar();
    window.addEventListener("ruum:notificaciones-actualizar", actualizar);
    return () => window.removeEventListener("ruum:notificaciones-actualizar", actualizar);
  }, [cargar]);

  async function abrir(item: Notificacion) {
    const cliente = crearClienteNavegador();
    await (cliente as any).rpc("marcar_notificacion_leida", { p_notificacion_id: item.id });
    setItems((actuales) => actuales.map((n) => n.id === item.id ? { ...n, leida_en: n.leida_en ?? new Date().toISOString() } : n));
    router.push(item.destino);
  }

  const noLeidas = items.filter((item) => !item.leida_en);
  const leidas = items.filter((item) => item.leida_en);

  function grupo(titulo: string, grupoItems: Notificacion[]) {
    return <section className="grid gap-3">
      <h2 className="font-display text-lg font-bold">{titulo} <span className="text-text-tertiary">({grupoItems.length})</span></h2>
      {grupoItems.length === 0 ? <Aviso tono="info">No hay notificaciones en esta sección.</Aviso> : grupoItems.map((item) => (
        <Card key={item.id} className={!item.leida_en ? "border-route-action" : ""}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">{item.tipo.replaceAll("_", " ")} · {new Date(item.creado_en).toLocaleString("es-MX")}</p>
              <h3 className="mt-1 font-display text-base font-bold">{item.titulo}</h3>
              <p className="mt-2 font-body text-sm text-text-secondary">{item.cuerpo}</p>
              {item.entidad_tipo && <p className="mt-2 font-mono text-xs text-text-tertiary">{item.entidad_tipo}{item.entidad_id ? ` · ${item.entidad_id.slice(0, 8)}` : ""}</p>}
            </div>
            {!item.leida_en && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-signal" aria-label="No leída" />}
          </div>
          <div className="mt-4"><Button variant="secondary" onClick={() => void abrir(item)}>Abrir</Button></div>
        </Card>
      ))}
    </section>;
  }

  return <div className="mx-auto grid w-full max-w-3xl gap-8 px-6 py-10 sm:py-14">
    <header><p className="font-body text-sm font-semibold text-route-action">Comunicación operativa</p><h1 className="mt-1 font-display text-3xl font-extrabold">Notificaciones</h1><p className="mt-2 text-text-secondary">Aquí permanecen los avisos aunque descartes la notificación del sistema.</p></header>
    {cargando ? <p>Cargando notificaciones...</p> : <>{grupo("No leídas", noLeidas)}{grupo("Leídas", leidas)}</>}
  </div>;
}
