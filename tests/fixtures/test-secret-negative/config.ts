// Clean source code accessing environment variables properly (Negative Test Fixture)
export const resendKey = process.env.RESEND_API_KEY;
export const stripeSecret = process.env.STRIPE_SECRET_KEY;
export const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export function stripPemHeader(pem: string): string {
  return pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, "").trim();
}
