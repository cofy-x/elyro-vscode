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
} from "./contracts";
import {
  commandFailureMessage,
  ElyroClient,
  ElyroCommandError,
} from "./elyroClient";
import { humanize, presentWorkspace } from "./presentation";
import {
  projectActions,
  shouldShowGlobalSetup,
  summarizeProject,
  type ProjectAction,
  type ProjectSnapshot,
} from "./sidebar";
import { compareVersions } from "./version";

const minimumElyroVersion = "0.1.5";
const documentationUrl = "https://github.com/cofy-x/elyro#installation";

export function activate(context: vscode.ExtensionContext): void {
  const controller = new ElyroController();
  context.subscriptions.push(controller);
  controller.register();
  void controller.refreshProjects();
}

export function deactivate(): void {}

interface ProjectEntry {
  folder: vscode.WorkspaceFolder;
  snapshot: ProjectSnapshot;
}

type ProjectTreeNode = ProjectTreeItem | SetupTreeItem | ActionTreeItem;

class ElyroProjectsProvider
  implements vscode.TreeDataProvider<ProjectTreeNode>, vscode.Disposable
{
  private readonly changeEmitter = new vscode.EventEmitter<
    ProjectTreeNode | undefined | null | void
  >();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly getProjects: () => readonly ProjectEntry[]) {}

  refresh(): void {
    this.changeEmitter.fire();
  }

  getTreeItem(element: ProjectTreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProjectTreeNode): ProjectTreeNode[] {
    if (!element) {
      const projects = this.getProjects();
      if (shouldShowGlobalSetup(projects.map((entry) => entry.snapshot))) {
        return [new SetupTreeItem(projects[0]!)];
      }
      return projects.map((entry) => new ProjectTreeItem(entry));
    }
    if (element instanceof ActionTreeItem) {
      return [];
    }
    if (element instanceof SetupTreeItem) {
      return projectActions(element.entry.snapshot).map(
        (descriptor) => new ActionTreeItem(element.entry.folder, descriptor),
      );
    }
    return projectActions(element.entry.snapshot).map(
      (descriptor) => new ActionTreeItem(element.entry.folder, descriptor),
    );
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }
}

class SetupTreeItem extends vscode.TreeItem {
  constructor(readonly entry: ProjectEntry) {
    super("Set up Elyro", vscode.TreeItemCollapsibleState.Expanded);
    this.id = "elyro.environment.setup";
    this.contextValue = "elyro.environment.setup";
    this.iconPath = new vscode.ThemeIcon("circle-outline");
    this.tooltip = entry.snapshot.message ?? "Install or update the Elyro CLI";
    this.command = {
      command: "elyro.openDocumentation",
      title: "Get Elyro",
    };
    this.accessibilityInformation = { label: "Set up Elyro" };
  }
}

class ProjectTreeItem extends vscode.TreeItem {
  constructor(readonly entry: ProjectEntry) {
    const summary = summarizeProject(entry.snapshot);
    super(entry.folder.name, vscode.TreeItemCollapsibleState.Expanded);
    this.id = `elyro.project:${entry.folder.uri.toString()}`;
    this.description = summary.label;
    this.contextValue = summary.contextValue;
    this.iconPath = new vscode.ThemeIcon(
      summary.icon,
      entry.snapshot.workspace?.status === "running"
        ? new vscode.ThemeColor("testing.iconPassed")
        : undefined,
    );
    this.tooltip = new vscode.MarkdownString(
      `**${entry.folder.name}**  \n${summary.detail}  \n\nSelect for project actions.`,
    );
    this.command = {
      command: "elyro.openMenu",
      title: "Manage Elyro Project",
      arguments: [entry.folder.uri],
    };
    this.accessibilityInformation = {
      label: `${entry.folder.name}, ${summary.label}`,
    };
  }
}

class ActionTreeItem extends vscode.TreeItem {
  constructor(
    readonly folder: vscode.WorkspaceFolder,
    descriptor: ProjectAction,
  ) {
    super(descriptor.label, vscode.TreeItemCollapsibleState.None);
    this.id = `${folder.uri.toString()}:${descriptor.command}`;
    this.contextValue = "elyro.action";
    this.iconPath = new vscode.ThemeIcon(descriptor.icon);
    this.command = {
      command: descriptor.command,
      title: descriptor.label,
      arguments: [folder.uri],
    };
    this.tooltip = descriptor.description;
    this.accessibilityInformation = { label: descriptor.label };
  }
}

class ElyroController implements vscode.Disposable {
  private readonly output = vscode.window.createOutputChannel("Elyro", {
    log: true,
  });
  private readonly statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    30,
  );
  private readonly projectsProvider = new ElyroProjectsProvider(
    () => this.projects,
  );
  private readonly projectsView = vscode.window.createTreeView(
    "elyro.projects",
    {
      treeDataProvider: this.projectsProvider,
      showCollapseAll: false,
    },
  );
  private readonly disposables: vscode.Disposable[] = [];
  private projects: ProjectEntry[] = [];
  private selectedFolderUri: string | undefined;
  private refreshGeneration = 0;
  private busy = false;

  constructor() {
    this.statusBar.name = "Elyro Workspace";
    this.statusBar.hide();
    this.projectsView.description = "Local Linux workspaces";
  }

  register(): void {
    const commands: Record<string, (target?: unknown) => Promise<void> | void> =
      {
        "elyro.openMenu": async (target) => this.openMenu(target),
        "elyro.showStatus": async (target) => this.showStatus(target),
        "elyro.start": async (target) => this.start(false, target),
        "elyro.startAndOpen": async (target) => this.start(true, target),
        "elyro.open": async (target) => this.openWorkspace(undefined, target),
        "elyro.openShell": async (target) => this.openShell(target),
        "elyro.runDoctor": async (target) => this.runDoctor(target),
        "elyro.stop": async (target) => this.stop(target),
        "elyro.refresh": async () => this.refreshProjects(),
        "elyro.showOutput": () => this.output.show(true),
        "elyro.openDocumentation": async () => {
          await vscode.env.openExternal(vscode.Uri.parse(documentationUrl));
        },
      };

    for (const [command, handler] of Object.entries(commands)) {
      this.disposables.push(
        vscode.commands.registerCommand(command, async (target?: unknown) => {
          try {
            await handler(target);
          } catch (error) {
            await this.presentError(error);
          }
        }),
      );
    }

    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.selectedFolderUri = undefined;
        void this.refreshProjects();
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("elyro.executablePath")) {
          void this.refreshProjects();
        }
      }),
      vscode.window.onDidChangeActiveTextEditor(() => this.updateStatusBar()),
      this.projectsView.onDidChangeSelection((event) => {
        const selected = event.selection[0];
        const folder =
          selected instanceof ProjectTreeItem
            ? selected.entry.folder
            : selected instanceof SetupTreeItem
              ? selected.entry.folder
              : selected instanceof ActionTreeItem
                ? selected.folder
                : undefined;
        if (folder) {
          this.selectedFolderUri = folder.uri.toString();
          this.updateStatusBar(folder);
        }
      }),
      this.output,
      this.statusBar,
      this.projectsProvider,
      this.projectsView,
    );
  }

  async refreshProjects(): Promise<void> {
    if (this.busy) {
      return;
    }
    const generation = ++this.refreshGeneration;

    const folders = vscode.workspace.workspaceFolders ?? [];
    void vscode.commands.executeCommand(
      "setContext",
      "elyro.hasWorkspaceFolders",
      folders.length > 0,
    );
    if (folders.length === 0) {
      this.projects = [];
      this.projectsProvider.refresh();
      this.statusBar.hide();
      return;
    }

    this.projects = folders.map((folder) => ({
      folder,
      snapshot: { phase: "loading" },
    }));
    this.projectsProvider.refresh();

    if (process.platform !== "darwin") {
      this.setAllProjectsToSetup(
        "Elyro currently manages projects from a macOS host.",
      );
      return;
    }

    const cwd = folders[0]!.uri.fsPath;
    try {
      const versionResult = await this.client().runJson(
        versionArgs(),
        cwd,
        isVersionPayload,
      );
      ensureSuccess(versionResult);
      const version = versionResult.data.version.replace(/^v/, "");
      if (compareVersions(version, minimumElyroVersion) < 0) {
        if (generation !== this.refreshGeneration) {
          return;
        }
        this.setAllProjectsToSetup(
          `Update Elyro ${versionResult.data.version} to ${minimumElyroVersion} or newer.`,
        );
        return;
      }
    } catch (error) {
      if (generation !== this.refreshGeneration) {
        return;
      }
      this.output.warn(errorMessage(error));
      this.setAllProjectsToSetup("Install Elyro to manage Linux workspaces.");
      return;
    }

    const projects = await Promise.all(
      folders.map(async (folder): Promise<ProjectEntry> => {
        try {
          const result = await this.client().runJson(
            statusArgs(folder.uri.fsPath),
            folder.uri.fsPath,
            isWorkspacePayload,
          );
          ensureSuccess(result);
          return {
            folder,
            snapshot: { phase: "ready", workspace: result.data.workspace },
          };
        } catch (error) {
          this.output.warn(`${folder.name}: ${errorMessage(error)}`);
          return {
            folder,
            snapshot: {
              phase: "attention",
              message: "Run Doctor for guided setup checks.",
            },
          };
        }
      }),
    );
    if (generation !== this.refreshGeneration) {
      return;
    }
    this.projects = projects;
    this.projectsProvider.refresh();
    this.updateStatusBar();
  }

  private setAllProjectsToSetup(message: string): void {
    this.projects = this.projects.map(({ folder }) => ({
      folder,
      snapshot: { phase: "setup", message },
    }));
    this.projectsProvider.refresh();
    this.statusBar.hide();
  }

  private async openMenu(target?: unknown): Promise<void> {
    const folder = await this.requireProjectFolder(target);
    const entry = this.entryFor(folder);
    const summary = summarizeProject(entry?.snapshot ?? { phase: "loading" });
    const actions = projectActions(entry?.snapshot ?? { phase: "loading" });
    const items: ElyroQuickPickItem[] = [
      {
        label: `$(${summary.icon}) ${summary.label}`,
        description: folder.name,
        detail: summary.detail,
      },
      { label: "", kind: vscode.QuickPickItemKind.Separator },
      ...actions.map((descriptor) => ({
        label: `$(${descriptor.icon}) ${descriptor.label}`,
        detail: descriptor.description,
        command: descriptor.command,
      })),
    ];
    const picked = await vscode.window.showQuickPick(items, {
      title: `Elyro · ${folder.name}`,
      placeHolder: "Manage this Linux Workspace",
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (picked?.command) {
      await vscode.commands.executeCommand(picked.command, folder.uri);
    }
  }

  private async showStatus(target?: unknown): Promise<void> {
    const folder = await this.requireProjectFolder(target);
    const workspace = await this.withProgress(
      `Reading ${folder.name} Workspace status…`,
      async (token) => {
        const result = await this.client().runJson(
          statusArgs(folder.uri.fsPath),
          folder.uri.fsPath,
          isWorkspacePayload,
          token,
        );
        ensureSuccess(result);
        this.updateProject(folder, {
          phase: "ready",
          workspace: result.data.workspace,
        });
        return result.data.workspace;
      },
    );
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
  }

  private async start(
    openAfterStart: boolean,
    target?: unknown,
  ): Promise<void> {
    const folder = await this.requireTrustedProjectFolder(target);
    await this.withBusy(folder, async () => {
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
        `Elyro is ${upProgressVerb(plan.action)} ${folder.name}…`,
        async (token) => {
          const result = await this.client().runJson(
            upArgs(folder.uri.fsPath),
            folder.uri.fsPath,
            isWorkspacePayload,
            token,
          );
          ensureSuccess(result);
          this.updateProject(folder, {
            phase: "ready",
            workspace: result.data.workspace,
          });
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

  private async openWorkspace(
    folder?: vscode.WorkspaceFolder,
    target?: unknown,
  ): Promise<void> {
    const project = folder ?? (await this.requireTrustedProjectFolder(target));
    const result = await this.client().run(
      openArgs(project.uri.fsPath, detectEditor()),
      project.uri.fsPath,
    );
    ensureSuccess(result);
  }

  private async openShell(target?: unknown): Promise<void> {
    const folder = await this.requireTrustedProjectFolder(target);
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

  private async runDoctor(target?: unknown): Promise<void> {
    const folder = await this.requireProjectFolder(target);
    const report = await this.withProgress(
      `Running Elyro Doctor for ${folder.name}…`,
      async (token) => {
        const result = await this.client().runJson(
          doctorArgs(folder.uri.fsPath),
          folder.uri.fsPath,
          isDoctorPayload,
          token,
        );
        return result.data;
      },
    );
    await this.showDoctorReport(report);
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

  private async stop(target?: unknown): Promise<void> {
    const folder = await this.requireTrustedProjectFolder(target);
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
      await this.refreshProjects();
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

    await this.withBusy(folder, async () => {
      await this.withProgress(
        `Stopping ${folder.name} Workspace…`,
        async (token) => {
          const result = await this.client().runJson(
            downArgs(folder.uri.fsPath),
            folder.uri.fsPath,
            isWorkspacePayload,
            token,
          );
          ensureSuccess(result);
          this.updateProject(folder, {
            phase: "ready",
            workspace: result.data.workspace,
          });
          void vscode.window.showInformationMessage(
            "Elyro Workspace stopped. Project files were preserved.",
          );
        },
      );
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

  private async requireProjectFolder(
    target?: unknown,
  ): Promise<vscode.WorkspaceFolder> {
    const folder = await this.resolveProjectFolder(false, target);
    if (!folder) {
      throw new Error("Open a project folder to use Elyro.");
    }
    return folder;
  }

  private async requireTrustedProjectFolder(
    target?: unknown,
  ): Promise<vscode.WorkspaceFolder> {
    if (!vscode.workspace.isTrusted) {
      throw new Error("Trust this workspace before running Elyro commands.");
    }
    return await this.requireProjectFolder(target);
  }

  private async resolveProjectFolder(
    silent: boolean,
    target?: unknown,
  ): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }

    const targetedTreeFolder =
      target instanceof ProjectTreeItem || target instanceof SetupTreeItem
        ? target.entry.folder
        : target instanceof ActionTreeItem
          ? target.folder
          : undefined;
    if (targetedTreeFolder) {
      this.selectedFolderUri = targetedTreeFolder.uri.toString();
      return targetedTreeFolder;
    }

    if (target instanceof vscode.Uri) {
      const targeted = folders.find(
        (folder) => folder.uri.toString() === target.toString(),
      );
      if (targeted) {
        this.selectedFolderUri = targeted.uri.toString();
        return targeted;
      }
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
      placeHolder: "Choose the project to manage with Elyro",
    });
    this.selectedFolderUri = folder?.uri.toString();
    return folder;
  }

  private entryFor(folder: vscode.WorkspaceFolder): ProjectEntry | undefined {
    return this.projects.find(
      (entry) => entry.folder.uri.toString() === folder.uri.toString(),
    );
  }

  private updateProject(
    folder: vscode.WorkspaceFolder,
    snapshot: ProjectSnapshot,
  ): void {
    const existing = this.entryFor(folder);
    if (existing) {
      existing.snapshot = snapshot;
    } else {
      this.projects.push({ folder, snapshot });
    }
    this.projectsProvider.refresh();
    this.updateStatusBar(folder);
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

  private async withBusy(
    folder: vscode.WorkspaceFolder,
    operation: () => Promise<void>,
  ): Promise<void> {
    if (this.busy) {
      throw new Error("Another Elyro operation is already running.");
    }
    this.busy = true;
    this.statusBar.text = "$(sync~spin) Elyro";
    this.statusBar.tooltip = `Updating ${folder.name}`;
    this.statusBar.show();
    try {
      await operation();
    } finally {
      this.busy = false;
      await this.refreshProjects();
    }
  }

  private updateStatusBar(preferredFolder?: vscode.WorkspaceFolder): void {
    if (this.busy) {
      return;
    }
    const folder = preferredFolder ?? this.cachedActiveProjectFolder();
    const entry = folder ? this.entryFor(folder) : undefined;
    const workspace = entry?.snapshot.workspace;
    if (!folder || !workspace || workspace.status !== "running") {
      this.statusBar.hide();
      return;
    }
    this.statusBar.text = "$(vm-active) Elyro";
    this.statusBar.tooltip = new vscode.MarkdownString(
      `**${folder.name}** is running in Linux.  \n\nSelect for project actions.`,
    );
    this.statusBar.command = {
      command: "elyro.openMenu",
      title: "Manage Elyro Project",
      arguments: [folder.uri],
    };
    this.statusBar.backgroundColor = undefined;
    this.statusBar.show();
  }

  private cachedActiveProjectFolder(): vscode.WorkspaceFolder | undefined {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    const activeFolder = activeUri
      ? vscode.workspace.getWorkspaceFolder(activeUri)
      : undefined;
    return (
      activeFolder ??
      folders.find(
        (folder) => folder.uri.toString() === this.selectedFolderUri,
      ) ??
      folders[0]
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
      return "creating";
    case "recreate":
      return "recreating";
    case "start":
      return "starting";
    case "reuse":
    case "none":
      return "checking";
    default:
      return "preparing";
  }
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) {
    return "a moment";
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
