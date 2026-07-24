import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import Mocha from "mocha";

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true, timeout: 20_000 });
  const root = dirname(__filename);
  for (const file of await readdir(root)) {
    if (file.endsWith(".test.js")) {
      mocha.addFile(resolve(root, file));
    }
  }
  await new Promise<void>((resolveRun, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} extension integration test(s) failed.`));
      } else {
        resolveRun();
      }
    });
  });
}
