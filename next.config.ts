import type { NextConfig } from "next";

function getConfiguredDistDir(): string | undefined {
  const raw = process.env.NEXT_DIST_DIR?.trim();
  if (!raw || raw === ".next") {
    return undefined;
  }

  if (raw.startsWith("/")) {
    throw new Error("NEXT_DIST_DIR must be a relative path");
  }

  return raw;
}

const configuredDistDir = getConfiguredDistDir();

const nextConfig: NextConfig = {
  // Required for better-sqlite3 native module to work in API routes.
  serverExternalPackages: ["better-sqlite3"],
  ...(configuredDistDir ? { distDir: configuredDistDir } : {}),
};

export default nextConfig;
