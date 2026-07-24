import type { WorkspaceView } from "./contracts";

export type WorkspaceTone = "ready" | "idle" | "warning" | "error";

export interface WorkspacePresentation {
  label: string;
  detail: string;
  icon: string;
  tone: WorkspaceTone;
}

export function presentWorkspace(
  workspace: WorkspaceView,
): WorkspacePresentation {
  switch (workspace.status) {
    case "running":
      return {
        label: "Running",
        detail: `${workspace.name} is ready in Linux`,
        icon: "vm-active",
        tone: "ready",
      };
    case "absent":
      return {
        label: "Not started",
        detail: "Start a Linux Workspace when you need it",
        icon: "circle-outline",
        tone: "idle",
      };
    case "exited":
    case "stopped":
      return {
        label: "Stopped",
        detail: `${workspace.name} can be started again`,
        icon: "debug-stop",
        tone: "warning",
      };
    default:
      return {
        label: workspace.status || "Unknown",
        detail: `Elyro reported ${workspace.status || "an unknown state"}`,
        icon: "warning",
        tone: "warning",
      };
  }
}

export function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
