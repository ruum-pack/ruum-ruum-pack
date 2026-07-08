import { AvisoSinSesion, LayoutCuenta, SeccionVehiculos, obtenerCuenta } from "../cuenta-ui";

export default async function PaginaVehiculosCuenta() {
  const cuenta = await obtenerCuenta();

  if (!cuenta) return <AvisoSinSesion />;

  return (
    <LayoutCuenta cuenta={cuenta}>
      <SeccionVehiculos vehiculos={cuenta.vehiculos} />
    </LayoutCuenta>
  );
}
