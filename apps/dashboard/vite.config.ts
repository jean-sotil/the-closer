import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 5173,
    open: true,
    // Security headers
    headers: {
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mailgun.net",
        "frame-src 'none'",
        "object-src 'none'",
      ].join("; "),
    },
    // CORS configuration
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        process.env.VITE_APP_URL,
      ].filter(Boolean) as string[],
      credentials: true,
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Target modern browsers for smaller bundles
    target: "es2020",
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React dependencies
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // UI libraries
          "vendor-ui": ["@headlessui/react", "lucide-react"],
          // Data fetching
          "vendor-query": ["@tanstack/react-query"],
          // Charting library (heavy)
          "vendor-charts": ["recharts"],
          // Supabase client
          "vendor-supabase": ["@supabase/supabase-js"],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 500,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@headlessui/react",
      "lucide-react",
      "@tanstack/react-query",
      "recharts",
      "@supabase/supabase-js",
    ],
  },
});
