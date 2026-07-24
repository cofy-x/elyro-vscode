# Elyro for VS Code and Cursor

<p align="center">
  <img src="media/icon.png" alt="Elyro" width="112" height="112">
</p>

Elyro brings a clear, native control surface for [Elyro](https://github.com/cofy-x/elyro) Linux Workspaces into VS Code and Cursor. Edit on macOS, run in Linux, and keep the Elyro CLI as the single source of truth.

## What you can do

- See whether the current project's Linux Workspace is running, stopped, or not started.
- Start a Workspace, then open it in the current editor.
- Open an integrated Linux shell.
- Run Elyro Doctor and review every check in a focused native list.
- Stop a Workspace with an explicit confirmation that project files are preserved.
- Inspect the exact Elyro commands and diagnostics in the Elyro output channel.

The extension uses VS Code's status bar, Quick Pick, notifications, progress, and integrated terminal. It does not add a custom webview or a second Workspace control plane.

## Requirements

- macOS on Apple Silicon or Intel
- [Elyro](https://github.com/cofy-x/elyro) 0.1.5 or newer available on `PATH`
- VS Code 1.99 or newer, or a compatible Cursor version
- Docker Desktop or another Elyro-compatible local Docker runtime

If Elyro is installed at a custom location, set `elyro.executablePath` in VS Code machine settings.

## Quick start

1. Open a project folder in VS Code or Cursor.
2. Select the Elyro status item in the lower-left status bar.
3. Choose **Start and Open Workspace**.
4. Use **Open Shell** whenever you want a Linux terminal for the project.

You can also run every action from the Command Palette by entering `Elyro`.

## Commands

| Command                           | Purpose                                                                |
| :-------------------------------- | :--------------------------------------------------------------------- |
| `Elyro: Open Workspace Menu`      | Show the native action menu for the current project                    |
| `Elyro: Show Workspace Status`    | Show project, Linux mount, state, and published ports                  |
| `Elyro: Start Workspace`          | Start or reuse the Workspace without opening another window            |
| `Elyro: Start and Open Workspace` | Start or reuse the Workspace and continue in the current editor family |
| `Elyro: Open Workspace`           | Open a running Workspace in VS Code or Cursor                          |
| `Elyro: Open Workspace Shell`     | Create an integrated terminal backed by `elyro shell`                  |
| `Elyro: Run Doctor`               | Show Elyro system, project, Workspace, and editor checks               |
| `Elyro: Stop Workspace`           | Preview and confirm removal of managed runtime state                   |
| `Elyro: Refresh Workspace Status` | Refresh the status bar without background polling                      |
| `Elyro: Show Output`              | Open command and diagnostic output                                     |

## Safety and privacy

- Workspace-changing commands require VS Code Workspace Trust.
- Stop always requires explicit confirmation.
- Elyro is invoked with direct arguments; the extension does not construct shell command strings.
- The extension does not call Docker or SSH directly and does not read Elyro's internal registry.
- The extension has no telemetry, account, hosted service, or network API.

## Troubleshooting

Run **Elyro: Run Doctor** first. If a command fails, choose **Show Output** from the error notification to see the Elyro diagnostic stream.

If the status bar reports that Elyro is unavailable, verify the host installation:

```bash
elyro version --json
elyro doctor --json
```

For product behavior and CLI documentation, see the [Elyro repository](https://github.com/cofy-x/elyro). For extension issues, use the [elyro-vscode issue tracker](https://github.com/cofy-x/elyro-vscode/issues).

## Development

```bash
npm ci
npm run check
npm run test:integration
npm run package
npm run package:verify
```

The generated VSIX is written to `artifacts/elyro-<version>.vsix` and is intentionally excluded from Git.

## License

Apache-2.0
