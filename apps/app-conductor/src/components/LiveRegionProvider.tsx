"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type LiveApi = { announce: (message: string) => void; alert: (message: string) => void };
const LiveContext = createContext<LiveApi>({ announce: () => undefined, alert: () => undefined });
export function useLiveRegion() { return useContext(LiveContext); }
export function LiveRegionProvider({ children }: { children: React.ReactNode }) {
  const [polite, setPolite] = useState(""); const [urgent, setUrgent] = useState("");
  const pulse = useCallback((setter: (v: string) => void, message: string) => { setter(""); window.setTimeout(() => setter(message), 20); }, []);
  const value = useMemo(() => ({ announce: (m: string) => pulse(setPolite, m), alert: (m: string) => pulse(setUrgent, m) }), [pulse]);
  return <LiveContext.Provider value={value}>{children}<div className="sr-only" aria-live="polite" aria-atomic="true">{polite}</div><div className="sr-only" role="alert" aria-atomic="true">{urgent}</div></LiveContext.Provider>;
}
