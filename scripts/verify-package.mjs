import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import yauzl from "yauzl";

const manifest = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const packagePath = resolve(
  process.argv[2] ?? `artifacts/elyro-${manifest.version}.vsix`,
);
const entries = (await listEntries(packagePath)).map((entry) =>
  entry.toLowerCase(),
);
const required = [
  "extension/package.json",
  "extension/dist/extension.js",
  "extension/media/icon.png",
  "extension/readme.md",
  "extension/license.txt",
  "extension/changelog.md",
];
for (const entry of required) {
  if (!entries.includes(entry)) {
    throw new Error(`VSIX is missing ${entry}`);
  }
}
for (const entry of entries) {
  if (
    entry.startsWith("extension/src/") ||
    entry.startsWith("extension/node_modules/") ||
    entry.startsWith("extension/.github/") ||
    entry.endsWith(".vsix")
  ) {
    throw new Error(`VSIX contains a forbidden entry: ${entry}`);
  }
}
console.log(`verified ${entries.length} VSIX entries in ${packagePath}`);

function listEntries(path) {
  return new Promise((resolveEntries, reject) => {
    yauzl.open(path, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError ?? new Error(`Unable to open ${path}`));
        return;
      }
      const names = [];
      zipFile.on("error", reject);
      zipFile.on("entry", (entry) => {
        names.push(entry.fileName);
        zipFile.readEntry();
      });
      zipFile.on("end", () => resolveEntries(names));
      zipFile.readEntry();
    });
  });
}
