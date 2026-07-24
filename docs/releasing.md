# Releasing

## Candidate

1. Confirm `package.json` and `CHANGELOG.md` use the intended stable version.
2. Run `npm ci`, `npm audit --audit-level=low`, `npm run check`, `npm run test:integration`, `npm run package`, and `npm run package:verify`.
3. Install the generated VSIX in clean VS Code and Cursor profiles on macOS.
4. Exercise status, Doctor, start, open, shell, and confirmed stop against an installed Elyro release.
5. Confirm the GitHub Actions CI run for the release commit is green and download its `elyro-vsix` artifact for comparison.

## Marketplace

The initial stable release is uploaded manually through the `cofy-x` Visual Studio Marketplace publisher page. Upload only the VSIX that passed the candidate checks, confirm the extension identifier is `cofy-x.elyro`, then verify the public listing and install it from Marketplace in a clean VS Code profile.

Marketplace credentials, Personal Access Tokens, VSIX packages, and signing material must not be committed. Adding automated publishing is a separate security decision and should use Microsoft Entra ID rather than a long-lived PAT.
