import type { NextConfig } from "next";

// App 100 % cliente (sesión y datos en el iPad, vía la API): sin Cache Components.
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
