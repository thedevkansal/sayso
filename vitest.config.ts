import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: process.argv.some((a) => a.includes("tests/live")) ? [] : ["tests/live/**"],
    testTimeout: 60_000,
    alias: { "server-only": new URL("./tests/server-only-stub.ts", import.meta.url).pathname },
  },
});
