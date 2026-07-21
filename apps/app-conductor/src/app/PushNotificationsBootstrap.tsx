"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { inicializarPush } from "../lib/push-notifications";

export function PushNotificationsBootstrap() {
  const router = useRouter();
  useEffect(() => {
    let dispose = () => {};
    void inicializarPush((destino) => router.push(destino)).then((fn) => { dispose = fn; });
    return () => dispose();
  }, [router]);
  return null;
}
