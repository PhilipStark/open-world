import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config) => config, // explicit webpack (avoids Turbopack issues with unicode paths)
}

export default nextConfig
