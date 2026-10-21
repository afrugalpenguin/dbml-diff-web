import dbmlDiffPackage from 'dbml-diff/package.json' with { type: 'json' }

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_DBML_DIFF_VERSION: dbmlDiffPackage.version,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
