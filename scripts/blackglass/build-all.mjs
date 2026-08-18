import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
function run(file) {
  const result = spawnSync(process.execPath, [path.join(dir, file)], { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("generate-manifest.mjs");
run("prepare-references.mjs");
run("generate-reference-assets.mjs");
run("generate-scenes.mjs");
run("compose-cards.mjs");
run("verify-cards.mjs");
