import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the headless-Chromium stack out of the compiled server chunks — it
  // is only needed by the proposal-PDF route (which also imports it lazily)
  // and bundling it inflates every cold start of the shared SSR function.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  /**
   * OAuth discovery documents live at fixed /.well-known/ paths that the spec
   * dictates, but the handlers belong with the rest of the API. Rewriting keeps
   * both true without depending on how the App Router treats a directory whose
   * name starts with a dot.
   *
   * Each document is matched twice because the well-known URL is built by
   * inserting the path component: RFC 9728 turns the resource
   * https://host/api/mcp into /.well-known/oauth-protected-resource/api/mcp,
   * and clients probe the bare form too. Serving both costs nothing and saves a
   * failed discovery round-trip.
   */
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/protected-resource",
      },
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: "/api/oauth/protected-resource",
      },
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/authorization-server",
      },
      {
        source: "/.well-known/oauth-authorization-server/:path*",
        destination: "/api/oauth/authorization-server",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  experimental: {
    // Tree-shake heavy barrel-export packages. lucide-react is the biggest
    // win — without this every icon imported from the package pulls the
    // entire icon barrel into the chunk. Tiptap and dnd-kit also have wide
    // re-export surfaces.
    optimizePackageImports: [
      "lucide-react",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
  },
};

export default nextConfig;
