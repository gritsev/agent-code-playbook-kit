export type IrEntityType = "task" | "project";

export type NonEmptyRequirement = {
  kind: "nonEmpty";
  path: string;
};

export type ArtifactRequirement = {
  kind: "artifact";
  type: string;
  minCount?: number;
};

export type DeliveryRequirement = NonEmptyRequirement | ArtifactRequirement;

export type SandboxPolicy = {
  exec?: {
    allowCommands?: string[];
    timeoutMs?: number;
  };
  http?: {
    allowHosts?: string[];
    timeoutMs?: number;
  };
};

export type TaskWrites = {
  updateFields?: string[];
  addComment?: boolean;
  attachArtifactTypes?: string[];
  setStatusOnDone?: string;
};

export type ProjectWrites = {
  addComment?: boolean;
  setStatusOnDone?: string;
};

export type ProcessIr = {
  version: "ir.v0";
  pipelineId: string;
  title?: string;
  entityType: IrEntityType;
  entry: {
    statusIds: string[];
  };
  context?: {
    useTaskContext?: boolean;
  };
  writes?: {
    task?: TaskWrites;
    project?: ProjectWrites;
  };
  definitionOfDone?: {
    requirements?: DeliveryRequirement[];
  };
  recipes?: {
    onStartedComment?: string;
    onDoneComment?: string;
    onDoneCommentMode?: "always" | "fallback";
  };
  safety?: {
    agentSkills?: string[];
    connections?: string[];
    sandbox?: SandboxPolicy;
  };
};

export type PlaybookToolPolicy = {
  allowFields: string[];
};

export type RuntimePlaybook = {
  version: "v1";
  workQueue: {
    taskRules: Array<{ pipelineId: string; statusIds: string[] }>;
    projectRules: Array<{ pipelineId: string; statusIds: string[] }>;
  };
  governance: {
    connections: string[];
    agentSkills: string[];
    sandbox: Required<SandboxPolicy>;
    envelope: {
      readableObjects: string[];
      writableObjects: string[];
      tools: string[];
      toolPolicies: Record<string, PlaybookToolPolicy>;
    };
  };
  delivery: {
    mode: "none" | "comment" | "scm.review";
    requireTaskComment?: boolean;
    requireTaskActualResult?: boolean;
    requirements: DeliveryRequirement[];
  };
  recipes: {
    v2: {
      pipelines: Record<
        string,
        {
          meta?: { title?: string };
          on: Record<string, RuntimePipelineStep[]>;
        }
      >;
    };
  };
};

export type RuntimePipelineStep =
  | {
      id: string;
      type: "task.addComment";
      comment: string;
      mode?: "always" | "fallback";
    }
  | {
      id: string;
      type: "task.setStatus";
      statusId: string;
    }
  | {
      id: string;
      type: "project.setStatus";
      statusId: string;
    };

export type LintIssue = {
  level: "error" | "warning";
  message: string;
};

export type LintResult = {
  ok: boolean;
  issues: LintIssue[];
};
