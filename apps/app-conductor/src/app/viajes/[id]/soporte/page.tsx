import { redirect } from "next/navigation";
export default async function SoporteViaje({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/cuenta/soporte?traslado=${encodeURIComponent(id)}`);
}
