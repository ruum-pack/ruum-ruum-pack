import { EstadoError } from "./EstadoError";

export default function PaginaNoEncontradaConductor() {
  return (
    <EstadoError
      codigo="404"
      titulo="Página no encontrada"
      descripcion="La sección que buscas no existe. Revisa tus viajes o vuelve al panel."
      acciones={[
        { etiqueta: "Ver mis viajes", href: "/viajes", variant: "primary" },
        { etiqueta: "Volver al panel", href: "/", variant: "quiet" }
      ]}
    />
  );
}
