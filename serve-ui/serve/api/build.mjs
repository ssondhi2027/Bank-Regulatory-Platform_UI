import { build } from "esbuild";
import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/index.mjs"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.mjs",
  banner: {
    // google-auth-library and several transitive deps still reach for CJS globals.
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "const require = __cr(import.meta.url);",
      "import { fileURLToPath as __ftp } from 'node:url';",
      "import { dirname as __dn } from 'node:path';",
      "const __filename = __ftp(import.meta.url);",
      "const __dirname = __dn(__filename);",
    ].join("\n"),
  },
  minify: true,
  sourcemap: "linked",
  logLevel: "info",
});
