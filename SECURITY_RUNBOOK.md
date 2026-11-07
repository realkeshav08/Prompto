# Prompto repository security runbook

This runbook reduces the chance of reintroducing the known malware. It cannot
guarantee that a repository, dependency, developer laptop, or deployment host
will never be compromised. Treat every new commit and dependency as untrusted
until reviewed. Stop on a failed gate; do not override it to make a build pass.

## Incident record and current state

- In October 2026, Defender detected `Trojan:NPM/PolinRider.SF` in obfuscated
  `node.exe -e` commands referring to `95.135.181.151`. The Windows incident
  also involved an injected npm shim, `.npm-ws` loader, and injected VS
  Code/Cursor entry points. Those confirmed live components were removed, but
  the Windows host remains **PARTIALLY REMEDIATED**, not verified clean. Do not
  use that host to enter new production secrets.
- Prompto's remote `client/vite.config.js` previously had obfuscated JavaScript
  appended after its normal export. The infected Git blob was
  `f3b102a47edb9ded2a96eca5bd2c0f38cbba1dde`; the reviewed clean blob is
  `616a36ed022fad4f7e5f84c160775704ba75e8fa`. Security commits repaired
  both branch tips and made client CI manual-only. The unsafe
  `deploy/setup.sh` (pipe-to-shell provisioning) was then removed from both
  current branch tips. It was unsafe deployment code, not confirmed malware.
- Older commits can still contain the infected blob and removed script. A full
  clone, `fetch --unshallow`, old-commit checkout, or history merge may bring
  them back as Git objects or working files. `Prompto-clean` was created as a
  shallow, reviewed current-tip clone. Historical objects are not active
  execution, but do not check them out or run them.
- This record is dated 2026-11-07. Branch tips change: verify live remote
  hashes and contents each time rather than trusting a hash in a document.

## Known indicators and evidence

Investigate these as evidence, not proof that every matching string is
malicious. A mention in notes or logs is not an executable payload.
Matches in this runbook are intentional documentation; inspect the file path
and execution context before classifying a search hit.

- Host C2 indicators: `95.135.181.151` (observed), and the related runbook's
  `194.11.226.41:4000` and `150.251.113.223:8443`. Do not contact them to
  test availability.
- Prompto injection: a long obfuscated tail in `client/vite.config.js`
  containing `global['!']`, `function y7(`, or `_0x551b`. The normal Vite
  config does not need a dynamically constructed function after its export.
- Other campaign markers: `NPM_WS_SHIM`, `.npm-ws-runner.js`, `main.inz.cjs`,
  `VSCodeUpdater`, `tg14xq`, `Request._target`, and `fa-solid-400.woff2` at the
  identified malicious size/blob. A filename alone is insufficient evidence.
- Automatic execution surfaces: `.vscode/tasks.json` with `runOn: folderOpen`,
  `task.allowAutomaticTasks: true`, Git hooks, `.gitattributes` filters or
  smudge processes, `package.json` lifecycle scripts, editor/agent hooks, and
  deployment commands that pipe downloaded or generated text to a shell.

## Before cloning or opening a workspace

1. Use a trusted, disposable inspection environment. Do not clone straight
   into a live project folder. Do not execute repository files during review.
2. Fetch the intended branch **shallow and without checkout**. On Windows,
   disable hooks for each Git command with `-c core.hooksPath=NUL`; on Linux,
   use `-c core.hooksPath=/dev/null`. Do not recurse into submodules.
3. Record `git rev-parse HEAD` and compare it with a separately checked live
   remote ref. Inspect the tree with `git ls-tree -r HEAD`, read any
   `.gitattributes` for `filter=`/`smudge=`, and inspect `.vscode`, `.cursor`,
   agent hooks, package scripts, lockfiles, build configs, and deployment files
   with `git show`/`git grep`. Search tracked files **and** ignored/untracked
   working files after checkout. A string search alone is not clearance: the
   Prompto payload hid its endpoint inside obfuscated code.
4. Stop if the reviewed commit contains a known malicious blob, unexplained
   obfuscated executable tail, checkout filter, or folder-open task. Do not
   checkout it. If it passes, checkout only the reviewed current tree with
   hooks disabled; re-scan working files before opening an editor. Keep
   automatic tasks off and workspace trust prompts on.

## Before fetching, pulling, or switching branches

- Check `git status --short` and preserve user work. Read live branch refs with
  `git ls-remote --heads origin`. Fetch without checkout, then inspect the new
  commit, changed paths, `.gitattributes`, task/editor configs, package scripts,
  build configs, and newly introduced executable files. A remote hash alone is
  not proof that the tree is safe.
- Compare the new tree and diff to the reviewed tip. Search for the indicators
  above and new high-entropy/obfuscated tails even if no C2 literal is present.
  Review source hosts and integrity fields in lockfiles.
- Only after clearance, use a fast-forward update to the reviewed commit with
  hooks disabled. If history is unrelated, a merge conflicts, or Git asks to
  deepen the shallow clone, **stop**. Do not use `fetch --unshallow`, checkout
  old commits, reset to an unreviewed ref, or run a blind `git pull`.
- New branches or tags must pass the same gates. Never assume that `main` and
  `development` are identical until their current trees are compared.

## Before committing and pushing

- Inspect `git status`, `git diff`, `git diff --cached --name-status`, and the
  recent log. Stage only intended paths. Check that `.env`, credentials,
  `node_modules`, venvs, caches, generated builds, and incident samples are not
  staged. Confirm `.gitignore` still covers private/local files.
- Review changes to `package.json`, lockfiles, `.github/workflows`, build
  configuration, Git attributes, editor settings, deployment scripts, and agent
  instructions as security-sensitive. Reject unexplained `node -e`, encoded
  PowerShell, `eval`/dynamic `Function`, and pipe-to-shell changes.
- Use reviewed PRs, protected branches, required reviewers, and fast-forward
  pushes where possible. Do not force-push or rewrite shared history without
  a coordinated recovery plan. GitHub branch protection and CI checks must
  be configured in GitHub; this Markdown file does **not** enforce them.
- Client CI is currently **manual-only**. Do not restore push/PR triggers
  until secrets have been assessed and workflow/build inputs reviewed on a
  trusted runner. Vercel's Git integration is separate from GitHub Actions;
  verify its deployment settings independently.

## Before installing, building, testing, or deploying

- A clean clone is not permission to run install hooks. Inspect lifecycle
  scripts and native dependency build approvals first. In a disposable trusted
  environment, use a frozen lockfile and ignore scripts for an initial
  dependency review; approve only understood build steps afterward.
- The backend `server/package.json` has `start`, `dev`, and `test`, but no
  `build` script. The Python service and pinned requirements are separate.
  Recreate `node_modules` and the Python venv from trusted sources; never copy
  executable dependencies from an incident-era working tree.
- `deploy/setup.sh` was removed. Do not fetch it from raw GitHub, restore it
  from history, or run the archived Azure notes as commands. For a new GCP
  Compute Engine host, provision Node, pnpm, Python, Redis, Nginx, TLS, and
  PM2 through a separately reviewed procedure. Do not pipe network downloads
  or PM2-generated output into a shell.
- Keep the Python AI service on `127.0.0.1:8000`; expose only reviewed public
  ports through the GCP firewall and reverse proxy. Validate Node's `/health`
  response, service logs, package versions, and network owners on a clean host
  before sending production traffic. Do not run project tests/builds on a host
  whose trust has not been established.

## Secrets and incident response

- Never paste `.env` values, private keys, browser data, tokens, or sensitive
  logs into an AI chat or upload them to a scanner. Review variable **names**
  without exposing values. The copied `.env` files in `Prompto-clean` were
  kept locally and ignored by Git; they may have been exposed by the earlier
  host compromise.
- Rotate affected database, AI, Stripe, image, email, internal API, JWT,
  GitHub, Vercel, and hosting credentials from a trusted device before
  production use. Assess what infected Vercel/client CI builds could access;
  a GitHub workflow does not automatically receive every repository secret
  unless provided, but its checkout token and Vercel build variables may
  have been accessible.
- If an indicator returns, stop builds and deployments, isolate the host,
  preserve hashes/logs, identify the launcher, and obtain approval for targeted
  quarantine/removal. Do not delete projects or legitimate runtimes based only
  on names. Notify repository owners and review CI/deployment runs.

## Verification checklist and limits

- [ ] Live remote ref and exact reviewed commit recorded.
- [ ] No unreviewed checkout filters, hooks, automatic tasks, or submodules.
- [ ] Current tree and changed working files scanned for known and variant IOCs.
- [ ] `client/vite.config.js` is the reviewed clean config; removed setup script
      is absent from the **current tree**, not merely the working directory.
- [ ] Dependency sources, install scripts, CI permissions, and deploy commands
      reviewed before execution.
- [ ] Secrets are ignored by Git and rotated from a trusted device.
- [ ] Processes, persistence, network connections, and Defender findings
      rechecked after approved remediation or first run.

A zero-threat scan, absence of known strings, or this checklist alone cannot
prove every file benign or a previously compromised host `CLEAN — VERIFIED`.
For high assurance, use professional incident response or a controlled clean
host rebuild with verified backups and recovery keys.
