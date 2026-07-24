export interface WorkspaceView {
  id: string;
  name: string;
  project_dir: string;
  mount_dir: string;
  status: string;
  published_ports: string[];
}

export interface WorkspacePayload {
  schema_version: 1;
  kind: "workspace";
  workspace: WorkspaceView;
  action?: string;
  reasons?: string[];
  duration_ms?: number;
  removed?: boolean;
}

export interface WorkspacePlan {
  schema_version: 1;
  kind: "workspace_plan";
  operation: "up" | "down";
  action: string;
  reasons?: string[];
  project: {
    root: string;
    source: string;
  };
  workspace: {
    id: string;
    name: string;
    project_dir: string;
    mount_dir: string;
    published_ports: string[];
    status?: string;
    current_status?: string;
    environment?: string;
    toolchain?: string;
    platform?: string;
    hostname?: string;
  };
  image?: {
    reference: string;
    status: string;
  };
  removes?: string[];
  preserves?: string[];
}

export interface DoctorCheck {
  scope: string;
  name: string;
  status: "ok" | "warn" | "fail";
  message: string;
}

export interface DoctorPayload {
  schema_version: 2;
  kind: "doctor";
  healthy: boolean;
  project?: {
    root: string;
    source: string;
    config_path?: string;
    environment?: string;
    toolchain?: string;
    image?: string;
    platform?: string;
    workspace_status?: string;
  };
  checks: DoctorCheck[];
}

export interface VersionPayload {
  version: string;
  commit: string;
  build_date: string;
}

export function isWorkspacePayload(value: unknown): value is WorkspacePayload {
  if (
    !isRecord(value) ||
    value.schema_version !== 1 ||
    value.kind !== "workspace"
  ) {
    return false;
  }
  return isWorkspaceView(value.workspace);
}

export function isWorkspacePlan(value: unknown): value is WorkspacePlan {
  return (
    isRecord(value) &&
    value.schema_version === 1 &&
    value.kind === "workspace_plan" &&
    (value.operation === "up" || value.operation === "down") &&
    typeof value.action === "string" &&
    isWorkspacePlanView(value.workspace)
  );
}

export function isDoctorPayload(value: unknown): value is DoctorPayload {
  return (
    isRecord(value) &&
    value.schema_version === 2 &&
    value.kind === "doctor" &&
    typeof value.healthy === "boolean" &&
    Array.isArray(value.checks) &&
    value.checks.every(isDoctorCheck)
  );
}

export function isVersionPayload(value: unknown): value is VersionPayload {
  return (
    isRecord(value) &&
    typeof value.version === "string" &&
    typeof value.commit === "string" &&
    typeof value.build_date === "string"
  );
}

function isWorkspaceView(value: unknown): value is WorkspaceView {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.project_dir === "string" &&
    typeof value.mount_dir === "string" &&
    typeof value.status === "string" &&
    Array.isArray(value.published_ports) &&
    value.published_ports.every((port) => typeof port === "string")
  );
}

function isWorkspacePlanView(
  value: unknown,
): value is WorkspacePlan["workspace"] {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.project_dir === "string" &&
    typeof value.mount_dir === "string" &&
    (typeof value.status === "string" ||
      typeof value.current_status === "string") &&
    Array.isArray(value.published_ports) &&
    value.published_ports.every((port) => typeof port === "string")
  );
}

function isDoctorCheck(value: unknown): value is DoctorCheck {
  return (
    isRecord(value) &&
    typeof value.scope === "string" &&
    typeof value.name === "string" &&
    (value.status === "ok" ||
      value.status === "warn" ||
      value.status === "fail") &&
    typeof value.message === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
