import * as vscode from "vscode";
import {
  doctorArgs,
  downArgs,
  downPlanArgs,
  openArgs,
  shellArgs,
  statusArgs,
  upArgs,
  upPlanArgs,
  versionArgs,
} from "./commands";
import {
  isDoctorPayload,
  isVersionPayload,
  isWorkspacePayload,
  isWorkspacePlan,
  type DoctorPayload,
  type WorkspacePlan,
  type WorkspaceView,
} from "./contracts";
import {
  commandFailureMessage,
  ElyroClient,
  ElyroCommandError,
} from "./elyroClient";
import { humanize, presentWorkspace } from "./presentation";
import { compareVersions } from "./version";

const minimumElyroVersion = "0.1.5";

export function activate(context: vscode.ExtensionContext): void {
  const controller = new ElyroController();
  context.subscriptions.push(controller);
  controller.register();
  void controller.refresh(true);
}

export function deactivate(): void {}

class ElyroController implements vscode.Disposable {
  private readonly output = vscode.window.createOutputChannel("Elyro", {
    log: true,
  });
  private readonly statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    30,
  );
  private readonly disposables: vscode.Disposable[] = [];
  private currentWorkspace: WorkspaceView | undefined;
  private selectedFolderUri: string | undefined;
  private busy = false;

  constructor() {
    this.statusBar.command = "elyro.openMenu";
    this.statusBar.name = "Elyro Workspace";
    this.setIdleStatus("Loading…", "Elyro is checking this project");
    this.statusBar.show();
  }

  register(): void {
    const commands: Record<string, () => Promise<void> | void> = {
      "elyro.openMenu": async () => this.openMenu(),
      "elyro.showStatus": async () => this.showStatus(),
      "elyro.start": async () => this.start(false),
      "elyro.startAndOpen": async () => this.start(true),
      "elyro.open": async () => this.openWorkspace(),
      "elyro.openShell": async () => this.openShell(),
      "elyro.runDoctor": async () => this.runDoctor(),
      "elyro.stop": async () => this.stop(),
      "elyro.refresh": async () => this.refresh(false),
      "elyro.showOutput": () => {
        this.output.show(true);
      },
    };

    for (const [command, handler] of Object.entries(commands)) {
      this.disposables.push(
        vscode.commands.registerCommand(command, async () => {
          try {
            await handler();
          } catch (error) {
            await this.presentError(error);
          }
        }),
      );
    }
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.selectedFolderUri = undefined;
        void this.refresh(true);
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("elyro.executablePath")) {
          void this.refresh(true);
        }
      }),
      vscode.window.onDidChangeActiveTextEditor(() => void this.refresh(true)),
    );
    this.disposables.push(this.output, this.statusBar);
  }

  async refresh(silent: boolean): Promise<void> {
    if (this.busy) {
      return;
    }
    if (process.platform !== "darwin") {
      this.currentWorkspace = undefined;
      this.setWarningStatus(
        "macOS required",
        "Elyro currently supports macOS hosts",
      );
      return;
    }
    const folder = await this.resolveProjectFolder(silent);
    if (!folder) {
      this.currentWorkspace = undefined;
      this.setIdleStatus("Open a folder", "Open a project folder to use Elyro");
      return;
    }

    try {
      const result = await this.client().runJson(
        statusArgs(folder.uri.fsPath),
        folder.uri.fsPath,
        isWorkspacePayload,
      );
      if (result.exitCode !== 0) {
        throw new ElyroCommandError(commandFailureMessage(result), result);
      }
      this.currentWorkspace = result.data.workspace;
      this.updateStatusBar(result.data.workspace);
      if (!silent) {
        void vscode.window.showInformationMessage(
          `Elyro: ${presentWorkspace(result.data.workspace).label}`,
        );
      }
    } catch (error) {
      this.currentWorkspace = undefined;
      this.setErrorStatus("Unavailable", errorMessage(error));
      if (!silent) {
        throw error;
      }
    }
  }

  private async openMenu(): Promise<void> {
    const folder = await this.requireProjectFolder();
    await this.refresh(true);
    const presentation = this.currentWorkspace
      ? presentWorkspace(this.currentWorkspace)
      : undefined;
    const items: ElyroQuickPickItem[] = [
      {
        label: presentation
          ? `$(${presentation.icon}) ${presentation.label}`
          : "$(warning) Elyro unavailable",
        description: folder.name,
        detail: presentation?.detail ?? "Open output for diagnostic details",
        command: "elyro.showStatus",
      },
      { label: "", kind: vscode.QuickPickItemKind.Separator },
    ];

    if (this.currentWorkspace?.status === "running") {
      items.push(
        action(
          "$(link-external) Open Workspace",
          "Open this project through Elyro",
          "elyro.open",
        ),
        action(
          "$(terminal) Open Shell",
          "Start an integrated Linux shell",
          "elyro.openShell",
        ),
      );
    } else {
      items.push(
        action(
          "$(remote-explorer) Start and Open Workspace",
          "Prepare Linux and continue in this editor",
          "elyro.startAndOpen",
        ),
        action(
          "$(play) Start Workspace",
          "Prepare Linux without opening a new window",
          "elyro.start",
        ),
      );
    }
    items.push(
      action(
        "$(stethoscope) Run Doctor",
        "Check Elyro, Docker, SSH, and this project",
        "elyro.runDoctor",
      ),
      action(
        "$(refresh) Refresh",
        "Read the current Workspace status",
        "elyro.refresh",
      ),
    );
    if (this.currentWorkspace?.status === "running") {
      items.push(
        { label: "", kind: vscode.QuickPickItemKind.Separator },
        action(
          "$(stop-circle) Stop Workspace…",
          "Remove managed runtime state",
          "elyro.stop",
        ),
      );
    }

    const picked = await vscode.window.showQuickPick(items, {
      title: "Elyro",
      placeHolder: "Choose what to do with this Linux Workspace",
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (picked?.command) {
      await vscode.commands.executeCommand(picked.command);
    }
  }

  private async showStatus(): Promise<void> {
    const folder = await this.requireProjectFolder();
    await this.withProgress(
      "Reading Elyro Workspace status…",
      async (token) => {
        const result = await this.client().runJson(
          statusArgs(folder.uri.fsPath),
          folder.uri.fsPath,
          isWorkspacePayload,
          token,
        );
        ensureSuccess(result);
        this.currentWorkspace = result.data.workspace;
        this.updateStatusBar(result.data.workspace);
        const workspace = result.data.workspace;
        const presentation = presentWorkspace(workspace);
        await vscode.window.showQuickPick(
          [
            {
              label: `$(${presentation.icon}) ${presentation.label}`,
              detail: presentation.detail,
            },
            { label: "$(folder) Project", description: workspace.project_dir },
            {
              label: "$(remote) Linux mount",
              description: workspace.mount_dir,
            },
            {
              label: "$(radio-tower) Published ports",
              description:
                workspace.published_ports.length > 0
                  ? workspace.published_ports.join(", ")
                  : "None",
            },
          ],
          {
            title: `Elyro · ${workspace.name}`,
            placeHolder: "Workspace details",
          },
        );
      },
    );
  }

  private async start(openAfterStart: boolean): Promise<void> {
    const folder = await this.requireTrustedProjectFolder();
    await this.withBusy(async () => {
      await this.assertCompatibleVersion(folder.uri.fsPath);
      const planResult = await this.client().runJson(
        upPlanArgs(folder.uri.fsPath),
        folder.uri.fsPath,
        isWorkspacePlan,
      );
      ensureSuccess(planResult);
      const plan = planResult.data;
      if (!(await this.confirmUpPlan(plan))) {
        return;
      }

      await this.withProgress(
        `Elyro is ${upProgressVerb(plan.action)} the Workspace…`,
        async (token) => {
          const result = await this.client().runJson(
            upArgs(folder.uri.fsPath),
            folder.uri.fsPath,
            isWorkspacePayload,
            token,
          );
          ensureSuccess(result);
          this.currentWorkspace = result.data.workspace;
          this.updateStatusBar(result.data.workspace);
          void vscode.window.showInformationMessage(
            `Elyro Workspace ${humanize(result.data.action ?? "ready").toLowerCase()} in ${formatDuration(result.data.duration_ms)}.`,
          );
        },
      );

      if (openAfterStart) {
        await this.openWorkspace(folder);
      }
    });
  }

  private async openWorkspace(folder?: vscode.WorkspaceFolder): Promise<void> {
    const project = folder ?? (await this.requireTrustedProjectFolder());
    const editor = detectEditor();
    const result = await this.client().run(
      openArgs(project.uri.fsPath, editor),
      project.uri.fsPath,
    );
    ensureSuccess(result);
  }

  private async openShell(): Promise<void> {
    const folder = await this.requireTrustedProjectFolder();
    const terminal = vscode.window.createTerminal({
      name: `Elyro · ${folder.name}`,
      iconPath: new vscode.ThemeIcon("terminal-linux"),
      cwd: folder.uri,
      shellPath: this.executablePath(),
      shellArgs: shellArgs(folder.uri.fsPath),
      isTransient: true,
    });
    terminal.show();
  }

  private async runDoctor(): Promise<void> {
    const folder = await this.requireProjectFolder();
    await this.withProgress("Running Elyro Doctor…", async (token) => {
      const result = await this.client().runJson(
        doctorArgs(folder.uri.fsPath),
        folder.uri.fsPath,
        isDoctorPayload,
        token,
      );
      await this.showDoctorReport(result.data);
    });
  }

  private async showDoctorReport(report: DoctorPayload): Promise<void> {
    const items = report.checks.map((check) => ({
      label: `${doctorIcon(check.status)} ${humanize(check.name)}`,
      description: humanize(check.scope),
      detail: check.message,
    }));
    await vscode.window.showQuickPick(items, {
      title: report.healthy
        ? "Elyro Doctor · Ready"
        : "Elyro Doctor · Attention needed",
      placeHolder: report.healthy
        ? "All required checks passed"
        : "Review checks that need attention",
      matchOnDescription: true,
      matchOnDetail: true,
    });
  }

  private async stop(): Promise<void> {
    const folder = await this.requireTrustedProjectFolder();
    const planResult = await this.client().runJson(
      downPlanArgs(folder.uri.fsPath),
      folder.uri.fsPath,
      isWorkspacePlan,
    );
    ensureSuccess(planResult);
    const plan = planResult.data;
    if (plan.action === "none") {
      void vscode.window.showInformationMessage(
        "Elyro Workspace is already absent.",
      );
      await this.refresh(true);
      return;
    }
    const removes =
      plan.removes?.map(humanize).join(", ") || "managed runtime state";
    const choice = await vscode.window.showWarningMessage(
      `Stop ${plan.workspace.name}? Elyro will remove ${removes}. Project files are preserved.`,
      { modal: true },
      "Stop Workspace",
    );
    if (choice !== "Stop Workspace") {
      return;
    }

    await this.withBusy(async () => {
      await this.withProgress("Stopping Elyro Workspace…", async (token) => {
        const result = await this.client().runJson(
          downArgs(folder.uri.fsPath),
          folder.uri.fsPath,
          isWorkspacePayload,
          token,
        );
        ensureSuccess(result);
        this.currentWorkspace = result.data.workspace;
        this.updateStatusBar(result.data.workspace);
        void vscode.window.showInformationMessage(
          "Elyro Workspace stopped. Project files were preserved.",
        );
      });
    });
  }

  private async confirmUpPlan(plan: WorkspacePlan): Promise<boolean> {
    if (plan.action === "none" || plan.action === "reuse") {
      return true;
    }
    const reason = plan.reasons?.map(humanize).join(", ");
    const detail = [
      plan.workspace.toolchain ? humanize(plan.workspace.toolchain) : undefined,
      plan.workspace.platform,
      reason,
    ]
      .filter(Boolean)
      .join(" · ");
    const label =
      plan.action === "recreate" ? "Recreate Workspace" : "Start Workspace";
    const choice = await vscode.window.showInformationMessage(
      `${humanize(plan.action)} ${plan.workspace.name}${detail ? ` · ${detail}` : ""}`,
      { modal: plan.action === "recreate" },
      label,
    );
    return choice === label;
  }

  private async assertCompatibleVersion(cwd: string): Promise<void> {
    const result = await this.client().runJson(
      versionArgs(),
      cwd,
      isVersionPayload,
    );
    ensureSuccess(result);
    const current = result.data.version.replace(/^v/, "");
    if (compareVersions(current, minimumElyroVersion) < 0) {
      throw new Error(
        `Elyro ${minimumElyroVersion} or newer is required; found ${result.data.version}.`,
      );
    }
  }

  private async requireProjectFolder(): Promise<vscode.WorkspaceFolder> {
    const folder = await this.resolveProjectFolder(false);
    if (!folder) {
      throw new Error("Open a project folder to use Elyro.");
    }
    return folder;
  }

  private async requireTrustedProjectFolder(): Promise<vscode.WorkspaceFolder> {
    if (!vscode.workspace.isTrusted) {
      throw new Error("Trust this workspace before running Elyro commands.");
    }
    return await this.requireProjectFolder();
  }

  private async resolveProjectFolder(
    silent: boolean,
  ): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (activeUri) {
      const activeFolder = vscode.workspace.getWorkspaceFolder(activeUri);
      if (activeFolder) {
        this.selectedFolderUri = activeFolder.uri.toString();
        return activeFolder;
      }
    }
    const selectedFolder = folders.find(
      (folder) => folder.uri.toString() === this.selectedFolderUri,
    );
    if (selectedFolder) {
      return selectedFolder;
    }
    if (folders.length === 1 || silent) {
      const folder = folders[0];
      this.selectedFolderUri = folder?.uri.toString();
      return folder;
    }
    const folder = await vscode.window.showWorkspaceFolderPick({
      placeHolder: "Choose the project to use with Elyro",
    });
    this.selectedFolderUri = folder?.uri.toString();
    return folder;
  }

  private client(): ElyroClient {
    return new ElyroClient(this.executablePath(), (line) =>
      this.output.info(line),
    );
  }

  private executablePath(): string {
    return (
      vscode.workspace
        .getConfiguration("elyro")
        .get<string>("executablePath", "elyro")
        .trim() || "elyro"
    );
  }

  private async withProgress<T>(
    title: string,
    operation: (token: vscode.CancellationToken) => Promise<T>,
  ): Promise<T> {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: true,
      },
      async (_progress, token) => await operation(token),
    );
  }

  private async withBusy(operation: () => Promise<void>): Promise<void> {
    if (this.busy) {
      throw new Error("Another Elyro operation is already running.");
    }
    this.busy = true;
    this.statusBar.text = "$(sync~spin) Elyro";
    try {
      await operation();
    } finally {
      this.busy = false;
      await this.refresh(true);
    }
  }

  private updateStatusBar(workspace: WorkspaceView): void {
    const presentation = presentWorkspace(workspace);
    this.statusBar.text = `$(${presentation.icon}) Elyro: ${presentation.label}`;
    this.statusBar.tooltip = new vscode.MarkdownString(
      `**${workspace.name}**  \n${presentation.detail}  \n\nClick for Workspace actions.`,
    );
    this.statusBar.backgroundColor =
      presentation.tone === "warning"
        ? new vscode.ThemeColor("statusBarItem.warningBackground")
        : undefined;
  }

  private setIdleStatus(label: string, tooltip: string): void {
    this.statusBar.text = `$(terminal-linux) Elyro: ${label}`;
    this.statusBar.tooltip = tooltip;
    this.statusBar.backgroundColor = undefined;
  }

  private setWarningStatus(label: string, tooltip: string): void {
    this.statusBar.text = `$(warning) Elyro: ${label}`;
    this.statusBar.tooltip = tooltip;
    this.statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
  }

  private setErrorStatus(label: string, tooltip: string): void {
    this.statusBar.text = `$(error) Elyro: ${label}`;
    this.statusBar.tooltip = tooltip;
    this.statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
  }

  private async presentError(error: unknown): Promise<void> {
    const detail = errorMessage(error);
    this.output.error(detail);
    const action = await vscode.window.showErrorMessage(
      `Elyro: ${detail}`,
      "Show Output",
    );
    if (action === "Show Output") {
      this.output.show(true);
    }
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}

interface ElyroQuickPickItem extends vscode.QuickPickItem {
  command?: string;
}

function action(
  label: string,
  detail: string,
  command: string,
): ElyroQuickPickItem {
  return { label, detail, command };
}

function ensureSuccess(result: {
  exitCode: number;
  stderr: string;
  stdout: string;
}): void {
  if (result.exitCode !== 0) {
    throw new ElyroCommandError(commandFailureMessage(result), result);
  }
}

function detectEditor(): "cursor" | "code" {
  return vscode.env.appName.toLowerCase().includes("cursor")
    ? "cursor"
    : "code";
}

function doctorIcon(status: "ok" | "warn" | "fail"): string {
  switch (status) {
    case "ok":
      return "$(pass-filled)";
    case "warn":
      return "$(warning)";
    case "fail":
      return "$(error)";
  }
}

function upProgressVerb(action: string): string {
  switch (action) {
    case "create":
    case "start":
      return "starting";
    case "recreate":
      return "recreating";
    default:
      return "preparing";
  }
}

function formatDuration(durationMS: number | undefined): string {
  if (durationMS === undefined) {
    return "a moment";
  }
  if (durationMS < 1000) {
    return `${durationMS} ms`;
  }
  return `${(durationMS / 1000).toFixed(1)} s`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
