import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist-lambda");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "server/lambda.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  outfile: join(dist, "index.js"),
  format: "cjs",
  packages: "bundle",
  external: [],
});

cpSync(join(root, "data/seed.json"), join(dist, "data/seed.json"));
cpSync(join(root, "web"), join(dist, "web"), { recursive: true });
writeFileSync(
  join(dist, "package.json"),
  JSON.stringify({ main: "index.js" }, null, 2)
);

const zipPath = join(root, "dist-lambda.zip");
rmSync(zipPath, { force: true });
// PowerShell Compress-Archive from dist contents
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${dist}\\*' -DestinationPath '${zipPath}' -Force"`,
  { stdio: "inherit" }
);
console.log("Built", zipPath, "bytes", readFileSync(zipPath).length);
