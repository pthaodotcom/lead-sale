// Build the public form only, then prepare a separate, static Sites checkout.
// Site credentials and application server settings are never copied.
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const site = resolve("../.sites/driver-intake");
const build = resolve(".playwright-mcp/driver-intake-build");
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "build",
    "--config",
    "vite.intake.config.ts",
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir(site, { recursive: true });
await cp(build, resolve(site, "dist"), { recursive: true });
await rename(
  resolve(site, "dist/driver-intake.html"),
  resolve(site, "dist/index.html"),
);
for (const file of ["ahamove-logo.png", "ahamove-mark.png"])
  await cp(resolve("public", file), resolve(site, "dist", file));
await writeFile(resolve(site, ".gitignore"), "node_modules/\n.env*\n");
await writeFile(
  resolve(site, "README.md"),
  "# Form tài xế tự đăng ký\n\nStatic public form exported from Lead Sale. No CRM pages or server credentials are included.\n\nRebuild from the Lead Sale app checkout with `node scripts/lead-build-intake.mjs`, then use the Sites workflow to sync and publish this directory.\n",
);
// Keep the editable form sources with the static distribution for inspection.
await mkdir(resolve(site, "source"), { recursive: true });
for (const file of [
  "PublicIntake.tsx",
  "public-intake.ts",
  "public-intake.css",
  "VoiceReceiver.tsx",
  "voice.ts",
  "useVoice.ts",
  "voice.css",
])
  await writeFile(
    resolve(site, "source", file),
    await readFile(resolve("src/components/lead-sale", file)),
  );
console.log("Public form ready at " + resolve(site, "dist"));
