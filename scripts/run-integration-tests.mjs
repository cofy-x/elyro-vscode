import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const macOSVSCode =
  "/Applications/Visual Studio Code.app/Contents/MacOS/Electron";
const vscodeExecutablePath =
  process.env.VSCODE_EXECUTABLE_PATH ??
  (process.platform === "darwin" && existsSync(macOSVSCode)
    ? macOSVSCode
    : await downloadAndUnzipVSCode("1.99.3"));

const testProfile = await mkdtemp(join(tmpdir(), "elyro-vscode-test-"));
try {
  await runTests({
    vscodeExecutablePath,
    extensionDevelopmentPath: root,
    extensionTestsPath: resolve(root, "out-test/test/suite/index.js"),
    launchArgs: [
      root,
      "--disable-extensions",
      "--disable-gpu",
      `--user-data-dir=${join(testProfile, "user-data")}`,
      `--extensions-dir=${join(testProfile, "extensions")}`,
    ],
  });
} finally {
  await rm(testProfile, { force: true, recursive: true });
}
