# Architecture

`elyro-vscode` is a local UI extension. It runs beside the macOS editor process so it can invoke the host-installed `elyro` executable even when an editor window opens a Linux Workspace through Elyro's SSH handoff.

## Boundaries

- `src/extension.ts` owns VS Code commands, status, progress, confirmation, Quick Pick presentation, and integrated terminals.
- `src/elyroClient.ts` owns direct argv process execution, cancellation, stream capture, and JSON decoding.
- `src/contracts.ts` validates the public Elyro JSON schemas consumed by version 0.1.0.
- `src/presentation.ts` maps Elyro states to stable editor-native labels, icons, and tones.
- `src/sidebar.ts` maps cached project snapshots to native Tree View summaries and actions without importing VS Code APIs.

The extension never calls Docker or SSH directly, reads the Elyro registry, or reproduces Toolchain detection and lifecycle planning. It previews mutations through `elyro up --dry-run --json` and `elyro down --dry-run --json`, then invokes the matching public operation.

## UI model

The Elyro Activity Bar contains one native Projects Tree View. Every editor workspace folder is a top-level project, with expanded action rows and small contextual buttons derived from its current Workspace state. Multi-root windows therefore expose all projects without relying on the active editor.

The extension performs one initial refresh and refreshes on explicit user request, workspace-folder changes, or executable configuration changes. It does not poll Docker or run an extension-owned daemon. Background discovery failures become neutral setup states in the Tree View; only explicit user actions show error notifications.

The status bar is deliberately secondary. It stays hidden for unopened folders, unavailable Elyro installations, and projects without a running Workspace. While the selected or active project is running, one neutral Elyro item provides a fast path back to its action menu. Detailed status and Doctor reports continue to use Quick Pick because it stays keyboard-accessible, theme-aware, and consistent in VS Code and Cursor.

There is no custom webview or extension-owned Workspace control plane.
