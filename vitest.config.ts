import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    server: {
      deps: {
        external: ["node:sqlite"],
      },
    },
  },
  ssr: {
    external: ["node:sqlite"],
  },
});
