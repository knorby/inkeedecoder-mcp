import { defineConfig } from "tsup";

// ESM-only: MCP servers run on Node through the `bin` entry, and the SDK is
// ESM-native — there is no CJS consumer to support.
//
// Declaration files are emitted by `tsc --emitDeclarationOnly` (see the
// "build" script in package.json), NOT by tsup's `dts: true`. tsup's dts
// generation is incompatible with TypeScript 7: it emits extensionless
// relative imports in .d.ts output, which breaks Node16-style resolution
// ("relative import paths need explicit file extensions"). Keep the split
// build unless that upstream issue is resolved.
export default defineConfig({
  // index.ts is the stdio entrypoint (`bin`); server.ts is the library export
  // (`exports["."]`), so the factory can be reused in tests and composed into
  // other servers.
  entry: ["src/index.ts", "src/server.ts"],
  format: ["esm"],
  splitting: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "es2022",
});
