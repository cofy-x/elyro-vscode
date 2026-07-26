import type { DoctorPayload, WorkspaceView } from "./contracts";

export type WorkspaceTone = "ready" | "idle" | "warning" | "error";

export interface WorkspacePresentation {
  label: string;
  detail: string;
  icon: string;
  tone: WorkspaceTone;
}

export interface DoctorPresentation {
  title: string;
  summary: string;
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

export function presentDoctor(report: DoctorPayload): DoctorPresentation {
  const passed = report.checks.filter((check) => check.status === "ok").length;
  const advisories = report.checks.filter(
    (check) => check.status === "warn",
  ).length;
  const failures = report.checks.filter(
    (check) => check.status === "fail",
  ).length;
  const counts = [
    countLabel(passed, "check passed", "checks passed"),
    advisories > 0
      ? countLabel(advisories, "advisory", "advisories")
      : undefined,
    failures > 0 ? countLabel(failures, "failure", "failures") : undefined,
  ].filter((value): value is string => value !== undefined);

  return {
    title: report.healthy
      ? advisories > 0
        ? `Elyro Doctor · Ready with ${advisories === 1 ? "advisory" : "advisories"}`
        : "Elyro Doctor · Ready"
      : "Elyro Doctor · Attention needed",
    summary: counts.join(" · "),
  };
}

export function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
