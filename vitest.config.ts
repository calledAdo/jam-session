import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  test: {
    env: { DATABASE_URL: "pglite:memory" },
    // The recorder harness imports ../../video/record.mjs outside this app.
    // Keep the app suite self-contained; run recorder tests in its own project.
    include: ["{app,actions,server,shared}/**/*.{test,spec}.{ts,tsx,js,mjs}"],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/.react-router/**",
    ],
  },
});
