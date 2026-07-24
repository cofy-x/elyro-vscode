# Elyro VS Code Repository Context

This index is the required entrypoint after the root `AGENTS.md`.

| Task                                                     | Required context                                                                             |
| :------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| Product direction, commands, views, or lifecycle surface | [Product roadmap](../docs/roadmap.md)                                                        |
| Process, contract, UI, or extension-host boundaries      | [Architecture](../docs/architecture.md)                                                      |
| Extension host placement or Remote SSH behavior          | [Product roadmap](../docs/roadmap.md) and the relevant VS Code Extension API documentation   |
| Packaging, Marketplace publishing, or release automation | [Release guide](../docs/releasing.md), [Validation matrix](validation.md), and official docs |
| Final verification for any change                        | [Validation matrix](validation.md)                                                           |

The Elyro CLI repository owns Workspace behavior and JSON contracts. This repository owns only the editor integration that consumes those public contracts.
