import assert from "node:assert/strict";
import * as vscode from "vscode";

suite("Elyro extension", () => {
  test("activates and registers the public command surface", async () => {
    const extension = vscode.extensions.getExtension("cofy-x.elyro");
    assert.ok(
      extension,
      "extension should be installed in the development host",
    );
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    for (const command of [
      "elyro.openMenu",
      "elyro.showStatus",
      "elyro.start",
      "elyro.startAndOpen",
      "elyro.open",
      "elyro.openShell",
      "elyro.runDoctor",
      "elyro.stop",
      "elyro.refresh",
      "elyro.showOutput",
      "elyro.openDocumentation",
    ]) {
      assert.ok(commands.includes(command), `${command} should be registered`);
    }

    const manifest = extension.packageJSON as {
      contributes?: {
        viewsContainers?: { activitybar?: Array<{ id?: string }> };
        views?: Record<string, Array<{ id?: string }>>;
      };
    };
    assert.equal(
      manifest.contributes?.viewsContainers?.activitybar?.[0]?.id,
      "elyro",
    );
    assert.equal(manifest.contributes?.views?.elyro?.[0]?.id, "elyro.projects");
  });

  test("refreshes the open project without failing", async () => {
    await vscode.commands.executeCommand("elyro.refresh");
  });
});
