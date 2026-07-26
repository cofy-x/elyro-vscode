import assert from "node:assert/strict";
import test from "node:test";
import type { DoctorPayload, WorkspaceView } from "../contracts";
import { humanize, presentDoctor, presentWorkspace } from "../presentation";

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

test("summarizes Doctor advisories without contradicting the report", () => {
  const presentation = presentDoctor(doctor(true, ["ok", "ok", "warn"]));

  assert.equal(presentation.title, "Elyro Doctor · Ready with advisory");
  assert.equal(presentation.summary, "2 checks passed · 1 advisory");
});

test("counts Doctor failures that need attention", () => {
  const presentation = presentDoctor(doctor(false, ["ok", "warn", "fail"]));

  assert.equal(presentation.title, "Elyro Doctor · Attention needed");
  assert.equal(presentation.summary, "1 check passed · 1 advisory · 1 failure");
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

function doctor(
  healthy: boolean,
  statuses: Array<"ok" | "warn" | "fail">,
): DoctorPayload {
  return {
    schema_version: 2,
    kind: "doctor",
    healthy,
    checks: statuses.map((status, index) => ({
      scope: "project",
      name: `check_${index}`,
      status,
      message: `Check ${index}`,
    })),
  };
}
