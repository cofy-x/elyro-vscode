import assert from "node:assert/strict";
import test from "node:test";
import {
  doctorArgs,
  downArgs,
  downPlanArgs,
  openArgs,
  shellArgs,
  statusArgs,
  upArgs,
  upPlanArgs,
  versionArgs,
} from "../commands";

const project = "/Users/example/My Project";

test("builds exact read-only command arguments", () => {
  assert.deepEqual(statusArgs(project), [
    "status",
    "--project-dir",
    project,
    "--json",
  ]);
  assert.deepEqual(doctorArgs(project), [
    "doctor",
    "--project-dir",
    project,
    "--json",
  ]);
  assert.deepEqual(versionArgs(), ["version", "--json"]);
});

test("builds exact lifecycle plan and mutation arguments", () => {
  assert.deepEqual(upPlanArgs(project), [
    "up",
    "--project-dir",
    project,
    "--dry-run",
    "--json",
  ]);
  assert.deepEqual(upArgs(project), ["up", "--project-dir", project, "--json"]);
  assert.deepEqual(downPlanArgs(project), [
    "down",
    "--project-dir",
    project,
    "--dry-run",
    "--json",
  ]);
  assert.deepEqual(downArgs(project), [
    "down",
    "--project-dir",
    project,
    "--json",
  ]);
});

test("builds direct editor and terminal arguments without shell quoting", () => {
  assert.deepEqual(openArgs(project, "cursor"), [
    "open",
    "--project-dir",
    project,
    "--editor",
    "cursor",
  ]);
  assert.deepEqual(shellArgs(project), ["shell", "--project-dir", project]);
});
