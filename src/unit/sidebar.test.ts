import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceView } from "../contracts";
import {
  projectActions,
  shouldShowGlobalSetup,
  summarizeProject,
  type ProjectSnapshot,
} from "../sidebar";

test("keeps projects without a running Workspace neutral", () => {
  const idle = readyWorkspace("absent");

  assert.deepEqual(summarizeProject(idle), {
    label: "Ready to start",
    detail: "Start a Linux Workspace when you need it",
    icon: "circle-outline",
    contextValue: "elyro.project.idle",
  });
  assert.deepEqual(
    projectActions(idle).map((action) => action.command),
    [
      "elyro.startAndOpen",
      "elyro.start",
      "elyro.showStatus",
      "elyro.runDoctor",
    ],
  );
});

test("offers the running project lifecycle from the sidebar", () => {
  const running = readyWorkspace("running");

  assert.equal(summarizeProject(running).contextValue, "elyro.project.running");
  assert.deepEqual(
    projectActions(running).map((action) => action.command),
    [
      "elyro.open",
      "elyro.openShell",
      "elyro.showStatus",
      "elyro.runDoctor",
      "elyro.stop",
    ],
  );
});

test("presents missing Elyro as setup rather than an error", () => {
  const setup: ProjectSnapshot = {
    phase: "setup",
    message: "Install Elyro to manage Linux workspaces.",
  };

  const summary = summarizeProject(setup);
  assert.equal(summary.label, "Set up Elyro");
  assert.equal(summary.icon, "circle-outline");
  assert.equal(summary.contextValue, "elyro.project.setup");
  assert.deepEqual(
    projectActions(setup).map((action) => action.command),
    ["elyro.openDocumentation", "elyro.refresh", "elyro.showOutput"],
  );
});

test("routes project-specific setup failures to Doctor without red UI", () => {
  const attention: ProjectSnapshot = {
    phase: "attention",
    message: "Run Doctor for guided setup checks.",
  };

  const summary = summarizeProject(attention);
  assert.equal(summary.label, "Needs setup");
  assert.equal(summary.icon, "circle-outline");
  assert.deepEqual(
    projectActions(attention).map((action) => action.command),
    ["elyro.runDoctor", "elyro.refresh", "elyro.showOutput"],
  );
});

test("collapses a machine-level Elyro setup state across projects", () => {
  const setup: ProjectSnapshot = { phase: "setup" };

  assert.equal(shouldShowGlobalSetup([setup, setup]), true);
  assert.equal(shouldShowGlobalSetup([setup, { phase: "attention" }]), false);
  assert.equal(shouldShowGlobalSetup([]), false);
});

function readyWorkspace(status: string): ProjectSnapshot {
  const workspace: WorkspaceView = {
    id: "abc123",
    name: "sample",
    project_dir: "/projects/sample",
    mount_dir: "/home/elyro/sample",
    status,
    published_ports: [],
  };
  return { phase: "ready", workspace };
}
