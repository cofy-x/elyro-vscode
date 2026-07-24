# Architecture

`elyro-vscode` is a local UI extension. It runs beside the macOS editor process so it can invoke the host-installed `elyro` executable even when an editor window opens a Linux Workspace through Elyro's SSH handoff.

## Boundaries

- `src/extension.ts` owns VS Code commands, status, progress, confirmation, Quick Pick presentation, and integrated terminals.
- `src/elyroClient.ts` owns direct argv process execution, cancellation, stream capture, and JSON decoding.
- `src/contracts.ts` validates the public Elyro JSON schemas consumed by version 0.1.0.
- `src/presentation.ts` maps Elyro states to stable editor-native labels, icons, and tones.

The extension never calls Docker or SSH directly, reads the Elyro registry, or reproduces Toolchain detection and lifecycle planning. It previews mutations through `elyro up --dry-run --json` and `elyro down --dry-run --json`, then invokes the matching public operation.

## UI model

The status bar provides ambient state without polling. Selecting it opens one native action menu whose contents follow the current Workspace state. Detailed status and Doctor reports use Quick Pick because it stays keyboard-accessible, theme-aware, and consistent in VS Code and Cursor.

There is no Activity Bar container, Tree View, webview, or extension-owned daemon in 0.1.0.
