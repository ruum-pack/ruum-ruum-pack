import { AvisoSinSesion, LayoutCuenta, SeccionLegal, obtenerCuenta } from "../cuenta-ui";

export default async function PaginaLegalCuenta() {
  const cuenta = await obtenerCuenta();

  if (!cuenta) return <AvisoSinSesion />;

  return (
    <LayoutCuenta cuenta={cuenta}>
      <SeccionLegal />
    </LayoutCuenta>
  );
}
