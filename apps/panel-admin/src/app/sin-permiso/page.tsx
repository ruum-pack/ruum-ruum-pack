import Link from "next/link";

export default function SinPermisoPage() {
  return (
    <main style={{ maxWidth: 640, margin: "72px auto", padding: "0 24px" }}>
      <p style={{ fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Acceso restringido</p>
      <h1>No tienes permiso para abrir esta sección</h1>
      <p>Tu sesión es válida, pero el rol administrativo asignado no incluye esta operación.</p>
      <Link href="/">Volver al panel</Link>
    </main>
  );
}
