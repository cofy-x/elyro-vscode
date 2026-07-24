import assert from "node:assert/strict";
import test from "node:test";
import { compareVersions } from "../version";

test("compares Elyro release versions numerically", () => {
  assert.equal(compareVersions("0.1.5", "0.1.5"), 0);
  assert.equal(compareVersions("0.1.10", "0.1.5"), 5);
  assert.equal(compareVersions("0.2.0", "0.1.99"), 1);
  assert.equal(compareVersions("0.1.4", "0.1.5"), -1);
});
