"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapboxToken = exports.stripeSecret = exports.resendKey = void 0;
exports.stripPemHeader = stripPemHeader;
// Clean source code accessing environment variables properly (Negative Test Fixture)
exports.resendKey = process.env.RESEND_API_KEY;
exports.stripeSecret = process.env.STRIPE_SECRET_KEY;
exports.mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
function stripPemHeader(pem) {
    return pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, "").trim();
}
