# Contributing

I maintain this fork on my own and tune it to my own setup, so it can differ from the original VRCX project. Please open an issue before sending a PR. Unsolicited PRs will likely be closed, which wastes your time.

If you want to help regularly, open an issue first and we can agree on workflow and style before any code is written. I'm happy to work with people who stick around.

## Building and testing

You need Node.js 24.15 or newer with npm 11.5 or newer (`package.json` enforces both) and the .NET 10 SDK. `global.json` pins 10.0.203 and rolls forward to newer feature bands. The Windows app only builds on Windows.

Install the packages, then run the frontend checks:

```
npm ci
npm run typecheck
npm run lint
npm run lint:css
npm run format:check
npm test
npm run prod
```

`npm run format` and `npm run lint:fix` fix most findings for you. `npm run dev` serves the web UI on its own. For the full app, run `pwsh build-scripts/build-all.ps1`. It reinstalls `node_modules`, builds the Windows app, then makes the zip and installer, so it needs 7-Zip and NSIS 3.

For the C# side:

```
dotnet restore VRCX.slnx -p:Platform=x64 --locked-mode
dotnet format VRCX.slnx --verify-no-changes --no-restore
dotnet build VRCX.slnx -c Release -p:Platform=x64
dotnet run .github/lint/CSharpStyle.cs -- .
```

There are no .NET test projects. The tests are the Vitest suites under `tests`.

CI also runs a spelling check (`uv run --frozen typos --config .github/lint/typos.toml .`), workflow checks, a style check (`python -B .github/lint/style_check.py`), PowerShell style rules and shell style rules. The repo has git hooks in `.githooks`. Turn them on with `git config core.hooksPath .githooks`. The pre-push hook runs those checks, a secrets scan with `gitleaks`, the C# build and the tests before every push. It needs `uv`, `gitleaks`, PowerShell 7 and the shell lint tools.

Commit subjects must start with a type: `feat`, `fix`, `chore`, `ci`, `docs`, `refactor`, `revert`, `test`, `perf`, `diag` or `style`, such as `fix: stop the sidebar crash`. A subject can carry one build version in parentheses, never more. Commit messages can't contain `#123` style references or the name of the original project's organization. The commit hook and CI both enforce this. If a PR fails only that check, say so in the PR.

Bugs and questions are welcome as issues. Security problems go through [the security policy](.github/SECURITY.md).

Please keep references to the original VRCX project as plain text. Don't link to its issues or pull requests, mention its authors with `@`, or use its issue and PR numbers here, since that cross-links and notifies people who have nothing to do with this fork.
