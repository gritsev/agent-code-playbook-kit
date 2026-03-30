import test from "node:test";
import assert from "node:assert/strict";

import { compileProcessIr } from "../src/compile.js";
import type { ProcessIr } from "../src/types.js";

test("compileProcessIr builds task playbook with inferred runtime contracts", () => {
  const ir: ProcessIr = {
    version: "ir.v0",
    pipelineId: "content.draft",
    entityType: "task",
    entry: { statusIds: ["status-for-agent"] },
    context: { useTaskContext: true },
    writes: {
      task: {
        updateFields: ["actualResult"],
        addComment: true,
        attachArtifactTypes: ["source"],
        setStatusOnDone: "status-in-review",
      },
    },
    definitionOfDone: {
      requirements: [
        { kind: "nonEmpty", path: "task.data.actualResult" },
        { kind: "nonEmpty", path: "task.comment" },
        { kind: "artifact", type: "source", minCount: 1 },
      ],
    },
    recipes: {
      onStartedComment: "Taking it",
      onDoneComment: "Done",
      onDoneCommentMode: "fallback",
    },
  };

  const playbook = compileProcessIr(ir);

  assert.deepEqual(playbook.workQueue.taskRules, [
    { pipelineId: "content.draft", statusIds: ["status-for-agent"] },
  ]);
  assert.ok(playbook.governance.envelope.tools.includes("task.context.get"));
  assert.ok(playbook.governance.envelope.tools.includes("task.update"));
  assert.ok(playbook.governance.envelope.tools.includes("task.addComment"));
  assert.ok(playbook.governance.envelope.tools.includes("task.attachArtifactRef"));
  assert.ok(playbook.governance.envelope.tools.includes("task.setStatus"));
  assert.deepEqual(playbook.governance.envelope.toolPolicies["task.update"], {
    allowFields: ["actualResult"],
  });
  assert.equal(playbook.delivery.mode, "comment");
  assert.equal(playbook.delivery.requireTaskComment, true);
  assert.equal(playbook.delivery.requireTaskActualResult, true);
  assert.equal(playbook.recipes.v2.pipelines["content.draft"].on["workItem.done"].length, 2);
});
