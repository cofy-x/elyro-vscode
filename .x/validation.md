# Validation Matrix

| Changed scope                             | Minimum checks                                     | Integration checks                                                                      |
| :---------------------------------------- | :------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| TypeScript implementation                 | format, lint, typecheck, unit tests                | Extension Host test for affected commands                                               |
| Elyro process invocation or JSON decoding | unit tests with argv and stream fixtures           | installed Elyro CLI smoke on macOS                                                      |
| VS Code or Cursor UI behavior             | command, sidebar action, manifest, and state tests | manual Activity Bar, multi-root, quiet inactive-project, VS Code, and Cursor acceptance |
| Packaging metadata                        | manifest validation and clean package contents     | install generated VSIX in a clean editor profile                                        |
| Release automation                        | workflow syntax and dry-run package build          | Marketplace publish followed by searchable install verification                         |
| Documentation                             | link and copied-command checks                     | verify published Marketplace presentation                                               |

Always run `git diff --check`. Keep Marketplace credentials and machine-specific state out of the repository.

For a stable release, the full candidate sequence is `npm ci`, `npm audit --audit-level=low`, `npm run check`, `npm run test:integration`, `npm run package`, and `npm run package:verify`. Real Workspace lifecycle acceptance runs on macOS with the installed Elyro release; GitHub Linux runners must not imitate it through direct Docker or SSH calls.
