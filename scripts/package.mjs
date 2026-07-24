import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createVSIX } from "@vscode/vsce";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDirectory = resolve(root, "artifacts");
const manifest = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
await mkdir(artifactDirectory, { recursive: true });
await createVSIX({
  cwd: root,
  packagePath: resolve(artifactDirectory, `elyro-${manifest.version}.vsix`),
  dependencies: false,
});
