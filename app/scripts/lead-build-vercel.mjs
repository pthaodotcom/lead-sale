import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicUrl = new URL(
  process.env.LEAD_PUBLIC_URL || "https://ahamove-lead.vercel.app",
);
const env = {
  ...process.env,
  VITE_DRIVER_INTAKE_URL: `${publicUrl.origin}/#/dang-ky-tai-xe`,
};
for (const args of [
  ["node_modules/typescript/bin/tsc", "--noEmit", "--project", "tsconfig.app.json"],
  ["node_modules/vite/bin/vite.js", "build"],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

// Vercel receives only compiled public assets, never local account/server files.
const output = path.join(root, ".vercel-deploy/ahamove-lead/.vercel/output");
const staticDirectory = path.resolve(output, "static");
const deploymentDirectory = path.resolve(root, ".vercel-deploy/ahamove-lead");
if (!staticDirectory.startsWith(deploymentDirectory + path.sep))
  throw new Error("Vercel output must stay inside the deployment directory.");
await rm(staticDirectory, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "dist"), staticDirectory, { recursive: true });
await writeFile(
  path.join(output, "config.json"),
  JSON.stringify({
    version: 3,
    routes: [{ handle: "filesystem" }, { src: "/.*", dest: "/index.html" }],
  }, null, 2) + "\n",
);
const packageJson = JSON.parse(await readFile(path.join(root, "package.json")));
await writeFile(
  path.resolve(output, "../../package.json"),
  JSON.stringify({ name: "ahamove-lead", private: true, version: packageJson.version }, null, 2) + "\n",
);
console.log(`Vercel prebuilt output: ${output}`);
