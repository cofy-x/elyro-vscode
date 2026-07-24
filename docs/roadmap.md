# Elyro VS Code Roadmap

`elyro-vscode` makes the host-installed Elyro CLI visible and discoverable in VS Code and Cursor while keeping Elyro as the only Workspace lifecycle implementation.

## Initial release

- Run as a local UI extension and locate the host `elyro` binary.
- Activate through explicit Elyro commands without background Docker polling.
- Show the current project's Elyro status through stable JSON output.
- Start a Workspace and hand off to the editor through existing Elyro CLI commands.
- Run Elyro Doctor and present actionable diagnostics.
- Open an Elyro shell from an explicit user command.
- Stop a Workspace only after explicit confirmation.
- Package one VSIX and validate it in both VS Code and Cursor.
- Publish a searchable stable version to the Visual Studio Marketplace.

## Non-goals

- reimplementing Workspace lifecycle, Toolchain detection, image management, or SSH trust
- reading internal Elyro state or invoking Docker directly
- an Activity Bar dashboard, custom webview, or background daemon
- running or configuring coding agents
- remote Workspace, team, multi-tenant, or enterprise management

## Product test

A feature belongs here only when it makes Elyro discovery, lifecycle visibility, diagnostics, or editor handoff clearer without creating behavior that the Elyro CLI does not own.
