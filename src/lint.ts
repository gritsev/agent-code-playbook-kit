import type { LintIssue, LintResult, NonEmptyRequirement, ProcessIr } from "./types.js";

function parseTaskDataField(requirement: NonEmptyRequirement): string | undefined {
  const prefix = "task.data.";
  if (!requirement.path.startsWith(prefix)) {
    return undefined;
  }
  const field = requirement.path.slice(prefix.length).trim();
  return field || undefined;
}

export function lintProcessIr(ir: ProcessIr): LintResult {
  const issues: LintIssue[] = [];

  if (ir.version !== "ir.v0") {
    issues.push({ level: "error", message: `unsupported version '${String(ir.version)}'` });
  }

  if (!String(ir.pipelineId ?? "").trim()) {
    issues.push({ level: "error", message: "pipelineId is required" });
  }

  if (!(ir.entry?.statusIds ?? []).some((value) => String(value ?? "").trim())) {
    issues.push({ level: "error", message: "at least one entry statusId is required" });
  }

  if (ir.entityType === "task" && ir.writes?.project) {
    issues.push({ level: "error", message: "project writes are not valid for task processes" });
  }

  if (ir.entityType === "project" && ir.writes?.task) {
    issues.push({ level: "error", message: "task writes are not valid for project processes" });
  }

  const updateFields = new Set((ir.writes?.task?.updateFields ?? []).map((value) => String(value ?? "").trim()).filter(Boolean));

  for (const requirement of ir.definitionOfDone?.requirements ?? []) {
    if (requirement.kind === "nonEmpty") {
      const taskField = parseTaskDataField(requirement);
      if (taskField && !updateFields.has(taskField)) {
        issues.push({
          level: "warning",
          message: `definitionOfDone references task.data.${taskField}; compiler will infer task.update allowFields`,
        });
      }

      if (requirement.path === "task.comment" && !ir.writes?.task?.addComment) {
        issues.push({
          level: "warning",
          message: "definitionOfDone requires task.comment; compiler will still enable task.addComment",
        });
      }
    }

    if (requirement.kind === "artifact" && !String(requirement.type ?? "").trim()) {
      issues.push({ level: "error", message: "artifact requirements need a non-empty type" });
    }
  }

  return {
    ok: !issues.some((issue) => issue.level === "error"),
    issues,
  };
}
