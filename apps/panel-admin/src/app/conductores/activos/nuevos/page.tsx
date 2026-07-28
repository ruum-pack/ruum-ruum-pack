import { redirect } from "next/navigation";

export default function RedireccionNuevoConductor() {
  redirect("/conductores/activos/nuevo");
}
