/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // react-leaflet ships ESM; transpile it so it plays nice with Next's compiler.
  transpilePackages: ["react-leaflet", "@react-leaflet/core"],
};

export default nextConfig;
