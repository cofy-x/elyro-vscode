import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

await runTests({
  vscodeExecutablePath,
  extensionDevelopmentPath: root,
  extensionTestsPath: resolve(root, "out-test/test/suite/index.js"),
  launchArgs: [root, "--disable-extensions", "--disable-gpu"],
});
