"use client";
import { useEffect } from "react";
import { useLiveRegion } from "../components/LiveRegionProvider";
import { recordOperationalEvent } from "../lib/observability";

const POLITE_EVENTS: Record<string,string> = {
  "ruum:viaje-aceptado":"Viaje aceptado.", "ruum:estado-viaje-actualizado":"Estado del viaje actualizado.",
  "ruum:evidencia-pendiente":"Evidencia agregada. Pendiente de sincronizar.", "ruum:evidencia-sincronizada":"Evidencia sincronizada.",
  "ruum:rechazo-deshacer":"Rechazo deshecho.", "ruum:permiso-requerido":"Se requiere un permiso para continuar."
};
export function OperationalAccessibilityBridge(){
  const live=useLiveRegion();
  useEffect(()=>{
    const handlers=Object.entries(POLITE_EVENTS).map(([name,message])=>{const h=()=>live.announce(message); window.addEventListener(name,h); return [name,h] as const;});
    const offline=()=>live.alert("Sin conexión. Conservaremos los cambios pendientes.");
    const online=()=>live.announce("Conexión restablecida. Sincronizando cambios pendientes.");
    const rejected=(event: PromiseRejectionEvent)=>void recordOperationalEvent("startup_failure",{reason:event.reason instanceof Error?event.reason.name:"unhandled_rejection"});
    window.addEventListener("offline",offline); window.addEventListener("online",online); window.addEventListener("unhandledrejection",rejected);
    return()=>{handlers.forEach(([n,h])=>window.removeEventListener(n,h)); window.removeEventListener("offline",offline); window.removeEventListener("online",online); window.removeEventListener("unhandledrejection",rejected);};
  },[live]);
  return null;
}
