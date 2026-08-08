import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// Bundle analyzer is opt-in via ANALYZE=true. Wrapping unconditionally is
// safe -- it's a no-op when disabled.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  images: {
    // Only hosts we serve images from. Adding a new provider means adding
    // its origin here first, or next/image will refuse to optimize it.
    remotePatterns: [
      { protocol: "https", hostname: "flagcdn.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      // Supabase Storage — public assets (avatars, book covers, article
      // images). Path pattern is /storage/v1/object/public/**.
      { protocol: "https", hostname: "xzxfsznyrrtunnbfxgww.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
