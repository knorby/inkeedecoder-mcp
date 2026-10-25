import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov", "html"],
      include: ["src/**"],
      // The stdio entrypoint wires the transport at import time and only runs
      // as a spawned child process (tests/stdio.test.ts); in-process V8
      // coverage cannot attribute child-process execution to it.
      exclude: ["node_modules/**", "dist/**", "tests/**", "src/index.ts"],
      // Ratchet just below achieved coverage. The remaining branches are text
      // rendering for page states the captured fixtures do not contain (empty
      // known-amount lists, absent descriptions, truncation inside every tool);
      // raise these as fixtures grow.
      thresholds: {
        statements: 99,
        branches: 90,
        functions: 100,
        lines: 99,
      },
    },
  },
});
