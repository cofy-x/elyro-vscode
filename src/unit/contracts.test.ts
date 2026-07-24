import assert from "node:assert/strict";
import test from "node:test";
import {
  isDoctorPayload,
  isVersionPayload,
  isWorkspacePayload,
  isWorkspacePlan,
} from "../contracts";

test("accepts the Elyro workspace status schema", () => {
  assert.equal(
    isWorkspacePayload({
      schema_version: 1,
      kind: "workspace",
      workspace: {
        id: "abc123",
        name: "sample",
        project_dir: "/projects/sample",
        mount_dir: "/home/elyro/sample",
        status: "running",
        published_ports: ["3000:3000"],
      },
    }),
    true,
  );
});

test("rejects a workspace payload with a changed schema", () => {
  assert.equal(
    isWorkspacePayload({
      schema_version: 2,
      kind: "workspace",
      workspace: {},
    }),
    false,
  );
});

test("accepts the up plan current_status schema", () => {
  assert.equal(
    isWorkspacePlan({
      schema_version: 1,
      kind: "workspace_plan",
      operation: "up",
      action: "create",
      reasons: ["workspace_absent"],
      project: { root: "/projects/sample", source: "git" },
      image: {
        reference: "ghcr.io/cofy-x/elyro/workspace-node:v0.1.5",
        status: "available",
      },
      workspace: {
        id: "abc123",
        name: "sample",
        project_dir: "/projects/sample",
        mount_dir: "/home/elyro/sample",
        current_status: "absent",
        environment: "node",
        toolchain: "node",
        platform: "linux/arm64",
        hostname: "sample",
        published_ports: [],
      },
    }),
    true,
  );
});

test("accepts the down plan status schema", () => {
  assert.equal(
    isWorkspacePlan({
      schema_version: 1,
      kind: "workspace_plan",
      operation: "down",
      action: "none",
      project: { root: "/projects/sample", source: "git" },
      workspace: {
        id: "abc123",
        name: "sample",
        project_dir: "/projects/sample",
        mount_dir: "/home/elyro/sample",
        status: "absent",
        published_ports: [],
      },
      removes: [],
      preserves: ["project_files"],
    }),
    true,
  );
});

test("accepts doctor schema 2 and version output", () => {
  assert.equal(
    isDoctorPayload({
      schema_version: 2,
      kind: "doctor",
      healthy: false,
      checks: [
        {
          scope: "system",
          name: "docker",
          status: "fail",
          message: "not ready",
        },
      ],
    }),
    true,
  );
  assert.equal(
    isVersionPayload({
      version: "v0.1.5",
      commit: "abc",
      build_date: "2026-07-20T00:00:00Z",
    }),
    true,
  );
});
