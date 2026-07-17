export interface BannerDemoProps {
  hrefLogin?: string;
}

export function BannerDemo({ hrefLogin = "/login" }: BannerDemoProps) {
  return (
    <div className="mx-auto mt-4 max-w-5xl px-6">
      <div
        role="status"
        className="rounded-xl border border-route-action bg-route-soft px-4 py-3 font-body text-sm leading-5 text-route-action shadow-1"
      >
        Estás viendo datos de ejemplo.{" "}
        <a href={hrefLogin} className="font-semibold underline">
          Inicia sesión
        </a>{" "}
        para ver los tuyos.
      </div>
    </div>
  );
}
