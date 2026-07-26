import type { WorkspaceView } from "./contracts";

export type ProjectPhase = "attention" | "loading" | "ready" | "setup";

export interface ProjectSnapshot {
  phase: ProjectPhase;
  workspace?: WorkspaceView;
  message?: string;
}

export interface ProjectAction {
  command: string;
  label: string;
  description: string;
  icon: string;
}

export interface ProjectSummary {
  label: string;
  detail: string;
  icon: string;
  contextValue: string;
}

export function summarizeProject(snapshot: ProjectSnapshot): ProjectSummary {
  if (snapshot.phase === "loading") {
    return {
      label: "Checking…",
      detail: "Reading the current Elyro Workspace state",
      icon: "loading~spin",
      contextValue: "elyro.project.loading",
    };
  }

  if (snapshot.phase === "attention") {
    return {
      label: "Needs setup",
      detail: snapshot.message ?? "Run Doctor for guided setup checks",
      icon: "circle-outline",
      contextValue: "elyro.project.attention",
    };
  }

  if (snapshot.phase === "setup" || !snapshot.workspace) {
    return {
      label: "Set up Elyro",
      detail: snapshot.message ?? "Elyro is ready when this project needs it",
      icon: "circle-outline",
      contextValue: "elyro.project.setup",
    };
  }

  switch (snapshot.workspace.status) {
    case "running":
      return {
        label: "Running",
        detail: "The Linux Workspace is ready",
        icon: "vm-active",
        contextValue: "elyro.project.running",
      };
    case "absent":
      return {
        label: "Ready to start",
        detail: "Start a Linux Workspace when you need it",
        icon: "circle-outline",
        contextValue: "elyro.project.idle",
      };
    case "exited":
    case "stopped":
      return {
        label: "Stopped",
        detail: "The Linux Workspace can be started again",
        icon: "debug-stop",
        contextValue: "elyro.project.idle",
      };
    default:
      return {
        label: snapshot.workspace.status || "Available",
        detail: "Open project details for the current Elyro state",
        icon: "circle-outline",
        contextValue: "elyro.project.idle",
      };
  }
}

export function projectActions(snapshot: ProjectSnapshot): ProjectAction[] {
  if (snapshot.phase === "loading") {
    return [];
  }

  if (snapshot.phase === "attention") {
    return [
      action(
        "elyro.runDoctor",
        "Run Doctor",
        "Review guided checks for this project",
        "pulse",
      ),
      action(
        "elyro.refresh",
        "Check again",
        "Refresh this project's Elyro state",
        "refresh",
      ),
      action(
        "elyro.showOutput",
        "Show output",
        "Review Elyro integration details",
        "output",
      ),
    ];
  }

  if (snapshot.phase === "setup" || !snapshot.workspace) {
    return [
      action(
        "elyro.openDocumentation",
        "Get Elyro",
        "Install or update the Elyro CLI",
        "book",
      ),
      action(
        "elyro.refresh",
        "Check again",
        "Refresh this window after setup",
        "refresh",
      ),
      action(
        "elyro.showOutput",
        "Show output",
        "Review Elyro integration details",
        "output",
      ),
    ];
  }

  if (snapshot.workspace.status === "running") {
    return [
      action(
        "elyro.open",
        "Open Workspace",
        "Continue in the Linux Workspace",
        "remote-explorer",
      ),
      action(
        "elyro.openShell",
        "Open Shell",
        "Start an integrated Linux terminal",
        "terminal",
      ),
      action(
        "elyro.showStatus",
        "Workspace Details",
        "Inspect paths, state, and published ports",
        "list-tree",
      ),
      action(
        "elyro.runDoctor",
        "Run Doctor",
        "Check this project and the local Elyro setup",
        "pulse",
      ),
      action(
        "elyro.stop",
        "Stop Workspace…",
        "Remove managed runtime state after confirmation",
        "stop-circle",
      ),
    ];
  }

  return [
    action(
      "elyro.startAndOpen",
      "Start and Open",
      "Prepare Linux and continue in this editor",
      "remote-explorer",
    ),
    action(
      "elyro.start",
      "Start Workspace",
      "Prepare Linux without opening a new window",
      "play",
    ),
    action(
      "elyro.showStatus",
      "Workspace Details",
      "Inspect the current Elyro state",
      "list-tree",
    ),
    action(
      "elyro.runDoctor",
      "Run Doctor",
      "Check this project and the local Elyro setup",
      "pulse",
    ),
  ];
}

export function shouldShowGlobalSetup(
  snapshots: readonly ProjectSnapshot[],
): boolean {
  return (
    snapshots.length > 0 &&
    snapshots.every((snapshot) => snapshot.phase === "setup")
  );
}

export function shouldExpandProject(
  snapshot: ProjectSnapshot,
  projectCount: number,
  selected: boolean,
): boolean {
  return (
    projectCount === 1 || selected || snapshot.workspace?.status === "running"
  );
}

function action(
  command: string,
  label: string,
  description: string,
  icon: string,
): ProjectAction {
  return { command, label, description, icon };
}
