# Agent instructions

## Project context

- Read [CONTEXT.md](CONTEXT.md) for the implementation map, sibling collection system, current real-data limitations and continuation references. For cross-project work, also read the [workspace handoff](../CONTEXT.md) when present.
- Read [`project.md`](project.md) before working on the project. It contains the agreed project vision, product scope, technical direction, data assumptions and references.
- Do not edit `project.md` unless the project owner explicitly asks for that file to be edited. Add evolving agent guidance and brief working context here, or use other appropriate files when the owner requests them.
- The project name is undecided. Do not imply the project is an official agency system or claim agency data access or partnerships that have not been confirmed.

## Git and GitHub

- Check `git status --short --branch` before changes, preserve unrelated work, and stage only the files relevant to each change.
- Make small, atomic commits with clear messages that describe the change. Review the staged diff before committing; run checks appropriate to the work.
- The private repository is `MaenExists/hackathon`; `main` tracks `origin/main` and the remote uses HTTPS. Check the current branch and remote before operating, since these may change.
- Git and `gh` work using the machine's configured identity and GitHub authentication for `MaenExists`. Use them directly and non-interactively; do not request, print, copy or store credentials. Use `gh auth status` if authentication needs checking.
- Use `gh` for GitHub operations and normal Git commands for commits and pushes. For example, inspect a repository with `gh repo view` and check the remote branch with `git ls-remote --heads origin main`. Supply explicit titles and bodies for pull requests and use `--yes` when renaming a repository.
- Push when the owner has requested or otherwise authorized it. Verify the result and report any failure accurately.
