import type {
  DeliveryRequirement,
  NonEmptyRequirement,
  PlaybookToolPolicy,
  ProcessIr,
  RuntimePipelineStep,
  RuntimePlaybook,
  SandboxPolicy,
} from "./types.js";

function uniqueNonEmpty(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values ?? []) {
    const normalized = String(value ?? "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeSandbox(policy: SandboxPolicy | undefined): Required<SandboxPolicy> {
  return {
    exec: {
      allowCommands: uniqueNonEmpty(policy?.exec?.allowCommands),
      timeoutMs: Math.max(1, Number(policy?.exec?.timeoutMs ?? 60_000)),
    },
    http: {
      allowHosts: uniqueNonEmpty(policy?.http?.allowHosts),
      timeoutMs: Math.max(1, Number(policy?.http?.timeoutMs ?? 30_000)),
    },
  };
}

function getTaskDataFields(requirements: DeliveryRequirement[] | undefined): string[] {
  const fields: string[] = [];
  for (const requirement of requirements ?? []) {
    if (requirement.kind !== "nonEmpty") continue;
    const field = parseTaskDataField(requirement);
    if (field) fields.push(field);
  }
  return uniqueNonEmpty(fields);
}

function parseTaskDataField(requirement: NonEmptyRequirement): string | undefined {
  const prefix = "task.data.";
  if (!requirement.path.startsWith(prefix)) {
    return undefined;
  }
  const field = requirement.path.slice(prefix.length).trim();
  return field || undefined;
}

function hasTaskCommentRequirement(requirements: DeliveryRequirement[] | undefined): boolean {
  return (requirements ?? []).some(
    (requirement) => requirement.kind === "nonEmpty" && requirement.path === "task.comment",
  );
}

function hasTaskActualResultRequirement(requirements: DeliveryRequirement[] | undefined): boolean {
  return (requirements ?? []).some(
    (requirement) => requirement.kind === "nonEmpty" && requirement.path === "task.data.actualResult",
  );
}

function getArtifactTypes(requirements: DeliveryRequirement[] | undefined): string[] {
  return uniqueNonEmpty(
    (requirements ?? [])
      .filter((requirement) => requirement.kind === "artifact")
      .map((requirement) => requirement.type),
  );
}

function getDeliveryMode(requirements: DeliveryRequirement[] | undefined): "none" | "comment" | "scm.review" {
  const artifactTypes = getArtifactTypes(requirements);
  if (artifactTypes.includes("scm.review")) {
    return "scm.review";
  }
  if (hasTaskCommentRequirement(requirements) || artifactTypes.length > 0) {
    return "comment";
  }
  return "none";
}

function buildRecipes(ir: ProcessIr): Record<string, RuntimePipelineStep[]> {
  const on: Record<string, RuntimePipelineStep[]> = {};
  const doneSteps: RuntimePipelineStep[] = [];

  const startedComment = String(ir.recipes?.onStartedComment ?? "").trim();
  if (startedComment && ir.entityType === "task") {
    on["workItem.started"] = [
      {
        id: "start-comment",
        type: "task.addComment",
        comment: startedComment,
        mode: "always",
      },
    ];
  }

  const doneComment = String(ir.recipes?.onDoneComment ?? "").trim();
  if (doneComment && ir.entityType === "task") {
    doneSteps.push({
      id: "done-comment",
      type: "task.addComment",
      comment: doneComment,
      mode: ir.recipes?.onDoneCommentMode ?? "fallback",
    });
  }

  if (ir.entityType === "task") {
    const statusId = String(ir.writes?.task?.setStatusOnDone ?? "").trim();
    if (statusId) {
      doneSteps.push({
        id: "done-status",
        type: "task.setStatus",
        statusId,
      });
    }
  }

  if (ir.entityType === "project") {
    const statusId = String(ir.writes?.project?.setStatusOnDone ?? "").trim();
    if (statusId) {
      doneSteps.push({
        id: "done-status",
        type: "project.setStatus",
        statusId,
      });
    }
  }

  if (doneSteps.length) {
    on["workItem.done"] = doneSteps;
  }

  return on;
}

export function compileProcessIr(ir: ProcessIr): RuntimePlaybook {
  const requirements = ir.definitionOfDone?.requirements ?? [];
  const taskWriteFields = uniqueNonEmpty(ir.writes?.task?.updateFields);
  const inferredTaskFields = getTaskDataFields(requirements);
  const effectiveTaskFields = uniqueNonEmpty([...taskWriteFields, ...inferredTaskFields]);
  const artifactTypes = uniqueNonEmpty([
    ...(ir.writes?.task?.attachArtifactTypes ?? []),
    ...getArtifactTypes(requirements),
  ]);

  const readableObjects = uniqueNonEmpty([
    "domain",
    ir.entityType,
    ...(ir.context?.useTaskContext && ir.entityType === "task" ? ["agreement"] : []),
  ]);

  const writableObjects = uniqueNonEmpty([
    ...(ir.writes?.task ? ["task"] : []),
    ...(ir.writes?.project ? ["project"] : []),
  ]);

  const tools = uniqueNonEmpty([
    ...(ir.context?.useTaskContext && ir.entityType === "task" ? ["task.context.get"] : []),
    ...(effectiveTaskFields.length ? ["task.update"] : []),
    ...(ir.entityType === "task" &&
    (ir.writes?.task?.addComment || hasTaskCommentRequirement(requirements) || ir.recipes?.onDoneComment || ir.recipes?.onStartedComment)
      ? ["task.addComment"]
      : []),
    ...(artifactTypes.length ? ["task.attachArtifactRef"] : []),
    ...(String(ir.writes?.task?.setStatusOnDone ?? "").trim() ? ["task.setStatus"] : []),
    ...(String(ir.writes?.project?.setStatusOnDone ?? "").trim() ? ["project.setStatus"] : []),
  ]);

  const toolPolicies: Record<string, PlaybookToolPolicy> = {};
  if (effectiveTaskFields.length) {
    toolPolicies["task.update"] = {
      allowFields: effectiveTaskFields,
    };
  }

  return {
    version: "v1",
    workQueue: {
      taskRules:
        ir.entityType === "task"
          ? [{ pipelineId: ir.pipelineId, statusIds: uniqueNonEmpty(ir.entry.statusIds) }]
          : [],
      projectRules:
        ir.entityType === "project"
          ? [{ pipelineId: ir.pipelineId, statusIds: uniqueNonEmpty(ir.entry.statusIds) }]
          : [],
    },
    governance: {
      connections: uniqueNonEmpty(ir.safety?.connections),
      agentSkills: uniqueNonEmpty(ir.safety?.agentSkills),
      sandbox: normalizeSandbox(ir.safety?.sandbox),
      envelope: {
        readableObjects,
        writableObjects,
        tools,
        toolPolicies,
      },
    },
    delivery: {
      mode: getDeliveryMode(requirements),
      ...(hasTaskCommentRequirement(requirements) ? { requireTaskComment: true } : {}),
      ...(hasTaskActualResultRequirement(requirements) ? { requireTaskActualResult: true } : {}),
      requirements,
    },
    recipes: {
      v2: {
        pipelines: {
          [ir.pipelineId]: {
            ...(ir.title ? { meta: { title: ir.title } } : {}),
            on: buildRecipes(ir),
          },
        },
      },
    },
  };
}
