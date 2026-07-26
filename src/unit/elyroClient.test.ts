import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ElyroCancellationError,
  ElyroClient,
  ElyroCommandError,
  type CancellationLike,
} from "../elyroClient";

test("executes Elyro with direct argv and decodes JSON", async (context) => {
  const fixture = await createFixture(context);
  const logs: string[] = [];
  const client = new ElyroClient(fixture, (line) => logs.push(line));
  const result = await client.runJson(
    ["echo", "argument with spaces"],
    tmpdir(),
    (value): value is { args: string[] } =>
      typeof value === "object" &&
      value !== null &&
      "args" in value &&
      Array.isArray(value.args),
  );

  assert.deepEqual(result.data.args, ["argument with spaces"]);
  assert.equal(result.exitCode, 0);
  assert.match(logs[0]!, /"argument with spaces"/);
});

test("preserves valid JSON from a non-zero command", async (context) => {
  const fixture = await createFixture(context);
  const client = new ElyroClient(fixture, () => undefined);
  const result = await client.runJson(
    ["doctor-failure"],
    tmpdir(),
    (value): value is { healthy: boolean } =>
      typeof value === "object" && value !== null && "healthy" in value,
  );

  assert.equal(result.exitCode, 1);
  assert.equal(result.data.healthy, false);
});

test("rejects invalid JSON with command context", async (context) => {
  const fixture = await createFixture(context);
  const client = new ElyroClient(fixture, () => undefined);

  await assert.rejects(
    client.runJson(
      ["invalid"],
      tmpdir(),
      (value): value is object => typeof value === "object" && value !== null,
    ),
    (error: unknown) =>
      error instanceof ElyroCommandError &&
      error.message === "Elyro returned invalid JSON.",
  );
});

test("cancels a running command", async (context) => {
  const fixture = await createFixture(context);
  const cancellation = new TestCancellation();
  const client = new ElyroClient(fixture, () => undefined);
  const pending = client.run(["wait"], tmpdir(), cancellation);
  setTimeout(() => cancellation.cancel(), 50);

  await assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof ElyroCancellationError &&
      error.message === "Elyro command was cancelled.",
  );
});

async function createFixture(context: test.TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "elyro-vscode-test-"));
  const fixture = join(directory, "fake-elyro");
  await writeFile(
    fixture,
    `#!/usr/bin/env node
const [command, ...args] = process.argv.slice(2);
if (command === "echo") console.log(JSON.stringify({ args }));
else if (command === "doctor-failure") { console.log(JSON.stringify({ healthy: false })); process.exitCode = 1; }
else if (command === "invalid") console.log("not-json");
else if (command === "wait") setTimeout(() => console.log("done"), 10000);
`,
    "utf8",
  );
  await chmod(fixture, 0o755);
  context.after(async () => rm(directory, { recursive: true, force: true }));
  return fixture;
}

class TestCancellation implements CancellationLike {
  isCancellationRequested = false;
  private listeners: Array<() => void> = [];

  onCancellationRequested(listener: () => void): { dispose(): void } {
    this.listeners.push(listener);
    return {
      dispose: () => {
        this.listeners = this.listeners.filter(
          (candidate) => candidate !== listener,
        );
      },
    };
  }

  cancel(): void {
    this.isCancellationRequested = true;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
