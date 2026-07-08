import { AvisoSinSesion, LayoutCuenta, SeccionPerfil, obtenerCuenta } from "../cuenta-ui";

export default async function PaginaPerfilCuenta() {
  const cuenta = await obtenerCuenta();

  if (!cuenta) return <AvisoSinSesion />;

  return (
    <LayoutCuenta cuenta={cuenta}>
      <SeccionPerfil usuario={cuenta.usuario} />
    </LayoutCuenta>
  );
}
