import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const built = resolve("dist/server/wrangler.json");
let config;
try {
  config = JSON.parse(readFileSync(built, "utf8"));
} catch {
  console.error("Run npm run build before applying local migrations.");
  process.exit(1);
}
config.main = resolve("dist/server", config.main);
if (config.assets)
  config.assets.directory = resolve("dist/server", config.assets.directory);
for (const binding of config.d1_databases ?? [])
  binding.migrations_dir = resolve("drizzle");
mkdirSync(".sites-runtime", { recursive: true });
const target = resolve(".sites-runtime/migrations.json");
writeFileSync(target, JSON.stringify(config));
const child = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    target,
    "--persist-to",
    ".wrangler/state",
  ],
  { stdio: "inherit", env: { ...process.env, CI: "true" } },
);
process.exit(child.status ?? 1);
