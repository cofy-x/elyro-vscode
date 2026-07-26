import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import yauzl from "yauzl";

const manifest = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const packagePath = resolve(
  process.argv[2] ?? `artifacts/elyro-${manifest.version}.vsix`,
);
await verifyBrandAssets();
const entries = (await listEntries(packagePath)).map((entry) =>
  entry.toLowerCase(),
);
const required = [
  "extension/package.json",
  "extension/dist/extension.js",
  "extension/media/elyro.svg",
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

async function verifyBrandAssets() {
  const icon = await readFile(resolve("media/icon.png"));
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (
    !icon.subarray(0, 8).equals(pngSignature) ||
    icon.readUInt32BE(16) !== 512 ||
    icon.readUInt32BE(20) !== 512 ||
    icon[25] !== 2
  ) {
    throw new Error("media/icon.png must be a 512×512 RGB PNG");
  }

  const activityIcon = await readFile(resolve("media/elyro.svg"), "utf8");
  const expectedGeometry = [
    'viewBox="88 124 336 264"',
    'fill="currentColor"',
    'x="104" y="140" width="304" height="60" rx="30"',
    'x="156" y="226" width="252" height="60" rx="30"',
    'x="104" y="312" width="304" height="60" rx="30"',
  ];
  if (
    expectedGeometry.some((fragment) => !activityIcon.includes(fragment)) ||
    /gradient|filter|shadow|<text/i.test(activityIcon)
  ) {
    throw new Error("media/elyro.svg does not match the Shift icon geometry");
  }
}

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
