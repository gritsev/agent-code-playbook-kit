import test from "node:test";
import assert from "node:assert/strict";

import { lintProcessIr } from "../src/lint.js";
import type { ProcessIr } from "../src/types.js";

test("lintProcessIr warns when DoD implies write permissions", () => {
  const ir: ProcessIr = {
    version: "ir.v0",
    pipelineId: "content.draft",
    entityType: "task",
    entry: { statusIds: ["status-for-agent"] },
    writes: {
      task: {},
    },
    definitionOfDone: {
      requirements: [
        { kind: "nonEmpty", path: "task.data.actualResult" },
        { kind: "nonEmpty", path: "task.comment" },
      ],
    },
  };

  const result = lintProcessIr(ir);

  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 2);
  assert.equal(result.issues[0]?.level, "warning");
});
