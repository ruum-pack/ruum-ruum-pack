import { LoginCliente } from "./LoginCliente";

interface PaginaLoginProps {
  searchParams: Promise<{
    next?: string;
    reason?: string;
  }>;
}

function destinoSeguro(next: string | undefined) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function PaginaLogin({ searchParams }: PaginaLoginProps) {
  const params = await searchParams;

  return (
    <LoginCliente
      motivo={params.reason ?? null}
      siguiente={destinoSeguro(params.next)}
    />
  );
}
