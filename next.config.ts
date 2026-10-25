import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Excel files for the admin import can be a few MB
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    // v1 images are pasted links from the Excel file, shown with a plain <img>.
    unoptimized: true,
  },
};

export default nextConfig;
