import { InicioUsuario } from "../InicioUsuario";
import { NavegacionUsuario } from "../NavegacionUsuario";
import { MisViajesCliente } from "../mis-viajes/MisViajesCliente";
import type { Database } from "@ruum/shared/types";

type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];

const DEMO_PASAPORTE = {
  traslado_id: "demo-traslado",
  vehiculo_marca: "General Motors",
  vehiculo_modelo: "Beat 2026",
  vehiculo_anio: 2026,
  vehiculo_tipo: "sedan",
  vehiculo_placas: "436PM",
  estado: "pendiente_de_conductor",
  conductor_nombre: null,
  precio_final: 0,
  precio_cotizado: 0,
  creado_en: "2025-05-20T16:36:00.000Z",
  origen_ciudad: "Benito Juárez",
  origen_direccion: "Insurgentes, 2326, Del Valle Centro, 03100, Ciudad de México",
  destino_ciudad: "Culiacán",
  destino_direccion: "Calle Real, 23, Bugambilias, 80145, Sinaloa",
} as unknown as Pasaporte;

const DEMO_TRASLADO = {
  id: "demo-traslado",
  origen_ciudad: "Benito Juárez",
  origen_direccion: "Insurgentes, 2326, Del Valle Centro, 03100, Ciudad de México",
  destino_ciudad: "Culiacán",
  destino_direccion: "Calle Real, 23, Bugambilias, 80145, Sinaloa",
  fecha_hora_programada: "2025-05-20T16:36:00.000Z",
};

export default async function UiV2Preview({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  const { screen } = await searchParams;
  const esMisTraslados = screen === "mis-viajes";

  return (
    <main className="user-v2-scope user-v2-page">
      <NavegacionUsuario variante="claro" />
      <div className="user-v2-content">
        {esMisTraslados ? (
          <MisViajesCliente
            pestanaInicial="programados"
            viajes={[{ pasaporte: DEMO_PASAPORTE, traslado: DEMO_TRASLADO }]}
          />
        ) : (
          <InicioUsuario usuario={null} traslados={[]} />
        )}
      </div>
    </main>
  );
}
