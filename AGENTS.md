# Agent instructions

## Project context

- Read [`project.md`](project.md) before working on the project. It contains the agreed project vision, product scope, technical direction, data assumptions and references.
- Do not edit `project.md` unless the project owner explicitly asks for that file to be edited. Add evolving agent guidance and brief working context here, or use other appropriate files when the owner requests them.
- The project name is undecided. Do not imply the project is an official agency system or claim agency data access or partnerships that have not been confirmed.

## Git and GitHub

- Check `git status --short --branch` before changes, preserve unrelated work, and stage only the files relevant to each change.
- Make small, atomic commits with clear messages that describe the change. Review the staged diff before committing; run checks appropriate to the work.
- The current branch is `main`, tracking `origin/main`; inspect the current branch and remote rather than assuming they have not changed.
- The owner uses the existing machine Git identity and GitHub authentication. Never request, print, copy or store authentication tokens.
- **GitHub CLI (`gh`)**: `gh` is pre-installed in PATH and authenticated (account: `MaenExists`). The Git credential helper is already configured to use `gh auth git-credential`.
  - Use `gh` for GitHub actions: `gh repo create`, `gh repo rename`, `gh pr create`, `gh issue list`, etc.
  - Standard Git HTTPS commands (`git push`, `git pull`, `git clone`) authenticate automatically via `gh`. Do not prompt the user for GitHub credentials.
  - Run commands non-interactively and do not ask the owner to set up SSH keys. For example, supply explicit titles and bodies for pull requests and use `--yes` when renaming a repository.
  - When authorized to create a repository, use `gh repo create <name> --private --source=. --remote=origin --push` to create a private repository and push the current branch.
- Push when the owner has requested or otherwise authorized it. Check the result and report the commit and any failure accurately; never claim a commit or push succeeded without verification.
- Some agent sessions may have a read-only `.git` directory or no network access. If Git or GitHub operations are blocked, complete the permitted work, explain the specific failure and leave the owner clear instructions for completing the remaining steps. Do not bypass sandbox restrictions.
