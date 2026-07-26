# AGENTS.md

## Purpose

`elyro-vscode` is the VS Code and Cursor companion extension for Elyro. It presents the existing Elyro CLI lifecycle inside the editor without implementing a second Workspace control plane.

## Context Loading

1. Always read the [repository context index](.x/README.md), then load only the context required for the task.
2. Product direction and scope decisions require the [product roadmap](docs/roadmap.md).
3. Read the [validation matrix](.x/validation.md) before final verification.

## Product Boundaries

- The Elyro CLI and its stable JSON output are the only Workspace behavior contract.
- The extension must run as a local UI extension when it needs the host-installed `elyro` binary.
- Invoke `elyro` with direct argv execution. Do not construct shell command strings.
- Do not read Elyro registry files, infer private Docker labels, or call Docker or SSH directly.
- Do not duplicate Toolchain detection, lifecycle planning, image resolution, or diagnostics in TypeScript.
- Do not run, authenticate, proxy, or configure coding agents.
- Keep destructive actions such as `down` behind explicit user confirmation.
- Respect VS Code Workspace Trust before executing project-scoped commands.

## Change Discipline

- Keep the UI native and small: one Activity Bar container, one Projects Tree View, Command Palette, Quick Pick, notifications, output, and at most one conditional status bar item.
- Prefer stable VS Code APIs supported by both VS Code and Cursor; do not use proposed APIs without an explicit product decision.
- Preserve JSON stdout as machine data and surface stderr as diagnostic output.
- Add tests for command argv, JSON decoding, workspace identity, cancellation, and error presentation.
- Update user documentation and the validation matrix when behavior or release requirements change.
- Do not commit generated packages, credentials, Personal Access Tokens, publisher secrets, or machine-specific state.
- Do not commit, push, tag, publish a VSIX, or change Marketplace state unless the user explicitly requests that operation.
