"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchVersionPolicy, type VersionPolicy } from "../lib/app-version";
export function VersionGate(){ const router=useRouter(); const path=usePathname(); const [policy,setPolicy]=useState<VersionPolicy|null>(null); useEffect(()=>{void fetchVersionPolicy().then((p)=>{setPolicy(p); if(p?.mandatory && path!=="/actualizacion-requerida") router.replace("/actualizacion-requerida");});},[path,router]); if(!policy || policy.mandatory || policy.current===policy.recommended) return null; return <aside className="mx-auto mt-3 w-[min(100%-24px,1120px)] rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning" aria-live="polite">Hay una actualización recomendada de Ruum Ruum Conductor.</aside>; }
