import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceView } from "../contracts";
import { humanize, presentWorkspace } from "../presentation";

test("presents running and absent workspaces clearly", () => {
  assert.deepEqual(presentWorkspace(workspace("running")), {
    label: "Running",
    detail: "sample is ready in Linux",
    icon: "vm-active",
    tone: "ready",
  });
  assert.equal(presentWorkspace(workspace("absent")).label, "Not started");
});

test("keeps an unknown Elyro state visible", () => {
  const presentation = presentWorkspace(workspace("paused"));
  assert.equal(presentation.label, "paused");
  assert.equal(presentation.tone, "warning");
});

test("humanizes Elyro enum values", () => {
  assert.equal(
    humanize("runtime_environment_changed"),
    "Runtime Environment Changed",
  );
});

function workspace(status: string): WorkspaceView {
  return {
    id: "abc123",
    name: "sample",
    project_dir: "/projects/sample",
    mount_dir: "/home/elyro/sample",
    status,
    published_ports: [],
  };
}
