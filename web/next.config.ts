import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Cabeceras que endurecen el navegador sin CSP estricto (CSP con nonces requeriria
 * tocar el layout y el riesgo de romper hidratacion / estilos si no se hace completo).
 */
const baseSecurityHeaders: { key: string; value: string }[] = [
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  /** App interna: no indexar en buscadores bien comportados. */
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const hstsHeaders: { key: string; value: string }[] = isProd
  ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
  : [];

const nextConfig: NextConfig = {
  /** Menos huella de fingerprinting (no afecta funcionalidad). */
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...hstsHeaders, ...baseSecurityHeaders],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
